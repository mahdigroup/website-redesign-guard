import {parseHTML,DOMParser} from 'linkedom';
import {emptyData,cleanLink} from './model.js';
const text=n=>(n?.textContent||'').replace(/\s+/g,' ').trim();
const unique=list=>[...new Set(list)];
export function extractPage(html,url){
 let {document}=parseHTML(html);if(!document.documentElement)document=parseHTML('<html><body>'+html+'</body></html>').document;const d=emptyData();
 // HTML attribute names are case-insensitive, including manually authored tags.
 for(const node of document.querySelectorAll('*'))for(const a of [...node.attributes])if(a.name!==a.name.toLowerCase()){node.setAttribute(a.name.toLowerCase(),a.value);node.removeAttribute(a.name);}
 d.titles=[...document.querySelectorAll('title')].map(text);d.descriptions=[...document.querySelectorAll('meta')].filter(n=>(n.getAttribute('name')||'').toLowerCase()==='description').map(n=>n.getAttribute('content')||'');
 d.canonicals=[...document.querySelectorAll('link')].filter(n=>(n.getAttribute('rel')||'').toLowerCase().split(/\s+/).includes('canonical')).map(n=>cleanLink(n.getAttribute('href'),url)||'');
 d.robots=[...document.querySelectorAll('meta')].filter(n=>['robots','googlebot'].includes((n.getAttribute('name')||'').toLowerCase())).map(n=>n.getAttribute('content')||'');d.h1=[...document.querySelectorAll('h1')].map(text);
 const anchors=[...document.querySelectorAll('a[href]')];d.links=unique(anchors.map(n=>cleanLink(n.getAttribute('href'),url)).filter(Boolean)).slice(0,5000);
 d.phones=unique(anchors.map(n=>n.getAttribute('href')).filter(h=>/^tel:/i.test(h)).map(h=>h.replace(/[^\d+]/g,'')));d.emails=unique(anchors.map(n=>n.getAttribute('href')).filter(h=>/^mailto:/i.test(h)).map(h=>h.slice(7).split('?')[0].toLowerCase()));
 d.images=unique([...document.querySelectorAll('img')].map(n=>cleanLink(n.getAttribute('src'),url)).filter(Boolean)).slice(0,500);
 d.forms=[...document.querySelectorAll('form')].slice(0,50).map(form=>{
  const fields=[...form.querySelectorAll('input,textarea,select')].filter(n=>!['hidden','submit','button','reset'].includes((n.getAttribute('type')||'').toLowerCase())&&!n.closest('[hidden],[aria-hidden="true"]')).map(n=>{
   const id=n.getAttribute('id'),aria=n.getAttribute('aria-labelledby');const label=!!n.closest('label')||!!n.getAttribute('aria-label')||!!(aria&&aria.split(/\s+/).every(part=>text(document.getElementById(part))))||!!(id&&[...document.querySelectorAll('label')].some(l=>l.getAttribute('for')===id&&text(l)));
   return {name:n.getAttribute('name')||id||'',type:n.localName==='input'?(n.getAttribute('type')||'text').toLowerCase():n.localName,labelled:label,required:n.hasAttribute('required')};
  });return {method:(form.getAttribute('method')||'GET').toUpperCase(),action:cleanLink(form.getAttribute('action')||url,url),fields,hasEmail:fields.some(f=>f.type==='email'||/email/i.test(f.name)),hasMessage:fields.some(f=>f.type==='textarea'||/message|brief|enquiry/i.test(f.name))};
 });
 for(const node of document.querySelectorAll('script,style,noscript,template,svg,[hidden],[aria-hidden="true"]'))node.remove();
 d.text=text(document.querySelector('main')||document.querySelector('article')||document.body||document).slice(0,20000);d.wordCount=d.text?d.text.split(/\s+/).length:0;
 return d;
}
export function parseSitemap(xml){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('DTD and entity declarations are not supported in sitemaps.');
 const doc=new DOMParser().parseFromString(xml,'text/xml'),root=doc.documentElement;
 if(!root||!['urlset','sitemapindex'].includes(root.localName))throw Error('Not a supported XML sitemap.');
 const children=[...root.children];const locations=children.map(n=>[...n.children].find(c=>c.localName==='loc')?.textContent?.trim()).filter(Boolean);
 return {index:root.localName==='sitemapindex',locations};
}
