import http from 'node:http';
import {gzipSync} from 'node:zlib';
export async function fixture(){
 const requests=[];let origin;
 const routes=['/','/about/','/contact/','/old-services/','/retired/','/lost/','/chain/','/loop/','/blocked/'];
 const filler='A considered website gives visitors useful information, clear choices and an easy way to contact the business. '.repeat(12);
 const server=http.createServer((req,res)=>{
  requests.push({method:req.method,url:req.url,host:req.headers.host,cookie:req.headers.cookie,authorization:req.headers.authorization});const url=new URL(req.url,origin),parts=url.pathname.split('/').filter(Boolean),variant=parts.shift(),route='/'+parts.join('/')+(parts.length?'/':'');
  const send=(status,body='',type='text/html')=>{res.writeHead(status,{'Content-Type':type});res.end(req.method==='HEAD'?'':body);};
  if(url.pathname==='/robots.txt')return send(200,'User-agent: *\nDisallow: /*/blocked/\n','text/plain');
  if(url.pathname==='/slow'){setTimeout(()=>send(200,'slow'),160);return;}
  if(url.pathname==='/compressed'){res.writeHead(200,{'Content-Type':'text/html','Content-Encoding':'gzip'});res.end(gzipSync('<p>'+filler.repeat(100)+'</p>'));return;}
  if(url.pathname==='/redirect-private'){res.writeHead(302,{Location:'http://169.254.169.254/latest/meta-data/'});res.end();return;}
  if(!['before','broken','ready'].includes(variant))return send(404,'Not found');
  const base=origin+'/'+variant+'/';
  if(parts.join('/')==='sitemap_index.xml')return send(200,`<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${base}pages.xml.gz</loc></sitemap></sitemapindex>`,'application/xml');
  if(parts.join('/')==='pages.xml.gz'){const list=variant==='before'?routes:[...routes,'/services/'];res.writeHead(200,{'Content-Type':'application/gzip'});res.end(gzipSync(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${list.map(r=>`<url><loc>${base+r.slice(1)}</loc></url>`).join('')}</urlset>`));return;}
  if(parts.join('/')==='image.svg')return send(200,'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="teal"/></svg>','image/svg+xml');
  if(parts.join('/')==='broken.svg')return send(404,'Missing');
  if(parts.join('/')==='html-image.svg')return send(200,'<html><body>Image not found</body></html>');
  if(route==='/retired/'&&variant!=='before')return send(410,'This service has been retired.');
  if(route==='/old-services/'&&variant==='ready'){res.writeHead(301,{Location:base+'services/'});res.end();return;}
  if(route==='/old-services/'&&variant==='broken')return send(404,'Gone');
  if(route==='/lost/'&&variant==='broken'){res.writeHead(301,{Location:base});res.end();return;}
  if(route==='/chain/'&&variant==='broken'){res.writeHead(302,{Location:base+'hop/'});res.end();return;}
  if(route==='/hop/'&&variant==='broken'){res.writeHead(301,{Location:base+'about/'});res.end();return;}
  if(route==='/loop/'&&variant==='broken'){res.writeHead(302,{Location:base+'loop/'});res.end();return;}
  if(!routes.includes(route)&&route!=='/services/')return send(404,'Missing page');
  const damaged=variant==='broken'&&route==='/about/';const title=route.includes('services')?'Our services':route==='/'?'Brightfield Studio':route==='/contact/'?'Contact Brightfield':'About the studio';
  const form=route==='/contact/'&&variant!=='broken'?'<form method="post" action="/never-submit"><label for="email">Email</label><input id="email" name="email" type="email" required><label for="message">Your project</label><textarea id="message" name="message"></textarea><button>Send enquiry</button></form>':'';
  const contact=route==='/contact/'?`<a href="tel:${variant==='broken'?'+441111111111':'+442080641002'}">Call</a><a href="mailto:hello@brightfield.example">Email</a>`:'';
  send(200,`<!doctype html><html lang="en"><head><title>${title}</title>${damaged?'<title>Duplicate SEO title</title>':''}<meta name="description" content="A useful page about the Brightfield Studio website."><link rel="canonical" href="${damaged?'https://staging.wrong.example/about/':base+route.slice(1)}">${damaged?'<meta name="robots" content="noindex">':''}</head><body><header><a href="${base}">Home</a></header><main>${damaged?'':`<h1>${title}</h1>`}<p>${damaged?'Loading the new page…':filler}</p>${routes.filter(r=>r!=='/blocked/'&&!(variant==='ready'&&r==='/retired/')).map(r=>`<a href="${base+r.slice(1)}">${r}</a>`).join('')}${form}${contact}<img src="${base}image.svg" alt="A decorative square">${variant==='broken'&&route==='/'?`<img src="${base}broken.svg" alt="Missing photo"><img src="${base}html-image.svg" alt="Invalid photo">`:''}</main></body></html>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 return {origin,requests,config:{paths:{'/old-services/':'/services/'},retired:['/retired/']},close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
