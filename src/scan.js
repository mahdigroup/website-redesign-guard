import robotsParser from 'robots-parser';
import {gunzipSync} from 'node:zlib';
import {NetworkClient,AGENT} from './network.js';
import {extractPage,parseSitemap} from './extract.js';
import {VERSION,siteURL,routeOf,pageURL,emptyData} from './model.js';
const excluded=/\/(wp-admin|wp-login\.php|wp-json|cart|checkout|my-account)(\/|$)|\.(pdf|zip|png|jpe?g|gif|webp|avif|svg|css|js|woff2?)(\?|$)/i;
export async function scanSite(input,options={}){
 const base=siteURL(input),maxPages=options.maxPages??50,maxAssets=options.maxAssets??40;
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>200||!Number.isInteger(maxAssets)||maxAssets<0||maxAssets>100)throw Error('Use 1–200 pages and 0–100 assets.');
 const client=options.client||new NetworkClient({allowPrivate:!!options.allowPrivate,timeout:options.timeout??8000,maxRequests:Math.min(650,maxPages*3+maxAssets*2+30)});
 const coverage={maxPages,maxAssets,requests:0,pageLimitReached:false,assetLimitReached:false,robotsChecked:false,sitemapsChecked:0,skipped:[],warnings:[]};
 let robots=null,robotsText='';const robotsURL=new URL('/robots.txt',base).href;
 try{const r=await client.fetch(robotsURL,{maxBytes:500000});if(r.status===200){robotsText=r.body.toString('utf8');robots=robotsParser(robotsURL,robotsText);coverage.robotsChecked=true;}else if([401,403].includes(r.status)){coverage.warnings.push('robots.txt is access restricted; pages were not fetched.');robots=robotsParser(robotsURL,'User-agent: *\nDisallow: /');}else if(r.status>=500){coverage.warnings.push('robots.txt is unavailable; pages were not fetched.');robots=robotsParser(robotsURL,'User-agent: *\nDisallow: /');}}catch{coverage.warnings.push('robots.txt could not be checked; pages were not fetched.');robots=robotsParser(robotsURL,'User-agent: *\nDisallow: /');}
 const scopedFetch=(url,opts={})=>client.fetch(url,{scopeOrigin:new URL(base).origin,canFetch:value=>robots?.isAllowed(value,'EWBRedesignGuard')!==false,...opts});
 const pending=[],queued=new Set(),visited=new Set(),pages=[],assets=[],assetSeen=new Set();
 const enqueue=value=>{try{const url=new URL(value,base);url.hash='';const route=routeOf(url.href,base);if(route===null||url.username||url.password||!['http:','https:'].includes(url.protocol)||excluded.test(url.pathname))return;if(queued.size>=2000){coverage.pageLimitReached=true;return;}if(!queued.has(route)){queued.add(route);pending.push(route);}}catch{}};
 enqueue(base);for(const route of options.routes??[])enqueue(pageURL(base,route));
 if(options.sitemap&&new URL(options.sitemap,base).origin!==new URL(base).origin)throw Error('The sitemap must be on the selected site.');
 const sitemapQueue=options.sitemap?[new URL(options.sitemap,base).href]:[...robotsText.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m=>m[1]);if(!sitemapQueue.length)sitemapQueue.push(new URL('sitemap_index.xml',base).href,new URL('sitemap.xml',base).href);
 const sitemapSeen=new Set();while(sitemapQueue.length&&sitemapSeen.size<10){
  const url=sitemapQueue.shift();if(sitemapSeen.has(url)||new URL(url).origin!==new URL(base).origin)continue;sitemapSeen.add(url);
  if(robots?.isAllowed(url,AGENT)===false){coverage.skipped.push({url,reason:'robots.txt sitemap restriction'});continue;}
  try{const r=await scopedFetch(url,{maxBytes:2_000_000});coverage.sitemapsChecked++;if(r.status!==200||new URL(r.url).origin!==new URL(base).origin)continue;let body=r.body;if(body[0]===31&&body[1]===139)body=gunzipSync(body,{maxOutputLength:2_000_000});const sitemap=parseSitemap(body.toString('utf8'));if(sitemap.index)sitemapQueue.push(...sitemap.locations.slice(0,20));else for(const loc of sitemap.locations.slice(0,2000))enqueue(loc);}catch{coverage.warnings.push('A sitemap could not be read: '+url);}
 }
 async function inspect(route){
  const url=pageURL(base,route);
  if(robots?.isAllowed(url,AGENT)===false){coverage.skipped.push({route,reason:'robots.txt restriction'});return null;}
  try{
   // Redirects may lead outside the site. They are recorded, never crawled onward.
   const r=await scopedFetch(url),contentType=(r.headers['content-type']||'').toLowerCase();
   const data=r.status===200&&contentType.includes('text/html')?extractPage(r.body.toString('utf8'),r.url):emptyData();
   const record={route,url,status:r.status,finalURL:r.url,redirects:r.redirects,contentType,headerRobots:String(r.headers['x-robots-tag']||''),data};
   if(new URL(r.url).origin!==new URL(base).origin)record.offsite=true;
   if(!record.offsite&&r.status===200){for(const link of data.links)enqueue(link);}
   return record;
  }catch(error){return {route,url,status:0,finalURL:url,redirects:[],error:error.message,data:emptyData()};}
 }
 // Two workers per batch keep scans modest and output deterministic.
 while(pending.length&&visited.size<maxPages){const batch=[];while(pending.length&&batch.length<2&&visited.size<maxPages){const route=pending.shift();if(!visited.has(route)){visited.add(route);batch.push(route);}}const results=await Promise.all(batch.map(inspect));pages.push(...results.filter(Boolean));}
 coverage.pageLimitReached=coverage.pageLimitReached||pending.length>0;
 for(const p of pages)for(const image of p.data.images){
  if(assetSeen.has(image)||new URL(image).origin!==new URL(base).origin)continue;assetSeen.add(image);
  if(assets.length>=maxAssets){coverage.assetLimitReached=true;continue;}
  if(robots?.isAllowed(image,AGENT)===false){coverage.skipped.push({url:image,reason:'robots.txt asset restriction'});continue;}
  try{let r=await scopedFetch(image,{method:'HEAD'});if([405,501].includes(r.status))r=await scopedFetch(image,{maxBytes:2_000_000});assets.push({url:image,status:r.status,finalURL:r.url,contentType:String(r.headers['content-type']||'')});}catch(error){assets.push({url:image,status:0,error:error.message});}
 }
 coverage.requests=client.requests;
 return {version:VERSION,createdAt:new Date().toISOString(),base,engine:'Website Redesign Guard 1.0.0',robots:{available:coverage.robotsChecked,crawlerBlocked:robots?.isAllowed(base,AGENT)===false,googlebotBlocked:robots?.isAllowed(base,'Googlebot')===false},pages,assets,coverage};
}
