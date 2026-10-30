export const VERSION=1;
export function siteURL(value){
 const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Use an HTTP(S) URL without embedded credentials.');
 if(u.search||u.hash)throw Error('The site base must not contain a query or fragment.');if(!u.pathname.endsWith('/'))u.pathname+='/';return u.href;
}
export function routeOf(value,base){const u=new URL(value,base),b=new URL(base);if(u.origin!==b.origin||!u.pathname.startsWith(b.pathname))return null;return '/'+u.pathname.slice(b.pathname.length)+u.search;}
export function pageURL(base,route){if(typeof route!=='string'||!route.startsWith('/')||route.startsWith('//')||route.includes('\\'))throw Error('Routes must start with one forward slash.');const u=new URL(route.slice(1),siteURL(base));if(u.origin!==new URL(base).origin)throw Error('Routes must stay on the selected site.');u.hash='';return u.href;}
export function cleanLink(value,base){try{const u=new URL(value,base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^(gclid|fbclid)$/i.test(key))u.searchParams.delete(key);return u.href;}catch{return null;}}
export function normalURL(value){try{const u=new URL(value);u.hash='';return u.href;}catch{return '';}}
export function validateSnapshot(s){
 if(!s||s.version!==VERSION||!Array.isArray(s.pages)||s.pages.length>200)throw Error('Expected a version 1 Redesign Guard snapshot with at most 200 pages.');siteURL(s.base);
 const seen=new Set();for(const p of s.pages){if(!p||typeof p.route!=='string'||seen.has(p.route)||!Number.isInteger(p.status)||p.status<0||p.status>599)throw Error('Invalid or duplicate snapshot page.');pageURL(s.base,p.route);seen.add(p.route);if(p.url&&!cleanLink(p.url,s.base))throw Error('Invalid snapshot URL.');if(p.finalURL&&!cleanLink(p.finalURL,s.base))throw Error('Invalid snapshot final URL.');if(!p.data||typeof p.data!=='object')throw Error('Snapshot page data is missing.');for(const field of ['titles','descriptions','canonicals','robots','h1','links','images','phones','emails','forms'])if(!Array.isArray(p.data[field])||p.data[field].length>5000)throw Error('Invalid snapshot '+field);}
 return s;
}
export function validateConfig(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Configuration must be an object.');
 const paths=value.paths??{},retired=value.retired??[],allowedChanges=value.allowedChanges??{};
 if(!paths||typeof paths!=='object'||Array.isArray(paths)||!Array.isArray(retired)||!allowedChanges||typeof allowedChanges!=='object'||Array.isArray(allowedChanges))throw Error('Invalid configuration structure.');
 if(Object.keys(paths).length>200||retired.length>200||Object.keys(allowedChanges).length>200)throw Error('Configuration is limited to 200 routes.');
 for(const [from,to] of Object.entries(paths)){pageURL('https://routes.example/',from);pageURL('https://routes.example/',to);}
 for(const route of retired){if(route==='/')throw Error('The homepage cannot be retired.');pageURL('https://routes.example/',route);}
 for(const [route,codes] of Object.entries(allowedChanges)){pageURL('https://routes.example/',route);if(!Array.isArray(codes)||codes.some(c=>!['title-changed','description-changed','content-reduced','contact-details-changed','form-removed'].includes(c)))throw Error('Only documented change notices can be approved.');}
 return {paths,retired,allowedChanges};
}
export const emptyData=()=>({titles:[],descriptions:[],canonicals:[],robots:[],h1:[],links:[],images:[],phones:[],emails:[],forms:[],wordCount:0,text:''});
