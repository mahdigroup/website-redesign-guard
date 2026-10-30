import http from 'node:http';
import https from 'node:https';
import {lookup as dnsLookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createGunzip,createInflate,createBrotliDecompress} from 'node:zlib';
import ipaddr from 'ipaddr.js';
export const AGENT='EWBRedesignGuard/1.0 (+https://essexwebsitebuilders.co.uk/tools/website-redesign-guard/)';
export function isPublicIP(address){try{return ipaddr.process(address).range()==='unicast';}catch{return false;}}
export async function resolveTarget(input,{allowPrivate=false,lookup=dnsLookup,timeout=8000}={}){
 const u=new URL(input);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Unsupported URL or embedded credentials.');
 const host=u.hostname.replace(/^\[|\]$/g,'');let timer;
 const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await Promise.race([lookup(host,{all:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS lookup timed out.')),timeout);})]).finally(()=>clearTimeout(timer));
 if(!addresses.length||addresses.some(a=>!isIP(a.address)||(!allowPrivate&&!isPublicIP(a.address))))throw Error('Private, reserved or unresolved network target blocked. Use --allow-private only for a local or staging site you control.');
 return {url:u,address:addresses.find(a=>a.family===4)||addresses[0]};
}
export class NetworkClient{
 constructor({allowPrivate=false,timeout=8000,maxRequests=300,maxBytes=2_000_000,lookup=dnsLookup}={}){this.allowPrivate=allowPrivate;this.timeout=timeout;this.maxRequests=maxRequests;this.maxBytes=maxBytes;this.lookup=lookup;this.requests=0;}
 async once(input,{method='GET',maxBytes=this.maxBytes}={}){
  if(!['GET','HEAD'].includes(method))throw Error('Only read-only GET and HEAD requests are supported.');
  if(++this.requests>this.maxRequests)throw Error('Request budget exhausted.');
  const {url,address}=await resolveTarget(input,{allowPrivate:this.allowPrivate,lookup:this.lookup,timeout:this.timeout});
  return new Promise((resolve,reject)=>{
   const transport=url.protocol==='https:'?https:http;
   const request=transport.request(url,{method,agent:false,autoSelectFamily:false,lookup:(_host,_options,done)=>done(null,address.address,address.family),headers:{'User-Agent':AGENT,'Accept':'text/html,application/xml,image/*;q=0.8,*/*;q=0.1','Accept-Encoding':'identity'}},response=>{
    const headers=response.headers,status=response.statusCode||0;
    if(method==='HEAD'||[301,302,303,307,308].includes(status)){response.resume();resolve({status,headers,body:Buffer.alloc(0)});return;}
    let stream=response;const encoding=(headers['content-encoding']||'').toLowerCase();
    if(encoding==='gzip')stream=response.pipe(createGunzip());else if(encoding==='deflate')stream=response.pipe(createInflate());else if(encoding==='br')stream=response.pipe(createBrotliDecompress());else if(encoding&&encoding!=='identity'){response.destroy();reject(Error('Unsupported response encoding.'));return;}
    let bytes=0;const chunks=[];stream.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBytes){reject(Error('Response exceeds the size limit.'));stream.destroy();response.destroy();request.destroy();}else chunks.push(chunk);});
    stream.on('end',()=>resolve({status,headers,body:Buffer.concat(chunks)}));stream.on('error',reject);response.on('error',reject);
   });
   const timer=setTimeout(()=>request.destroy(Error('Request timed out.')),this.timeout);request.on('close',()=>clearTimeout(timer));request.on('error',reject);request.end();
  });
 }
 async fetch(input,{maxRedirects=5,scopeOrigin,canFetch,...options}={}){
  let url=new URL(input).href;const redirects=[],seen=new Set();
  for(let i=0;i<=maxRedirects;i++){
   if(seen.has(url))throw Error('Redirect loop detected.');if(canFetch&&!canFetch(url))throw Error('Redirect destination is restricted by robots.txt.');seen.add(url);const result=await this.once(url,options);
   if([301,302,303,307,308].includes(result.status)){
    if(!result.headers.location)throw Error('Redirect has no Location header.');const destination=new URL(result.headers.location,url);if(!['http:','https:'].includes(destination.protocol)||destination.username||destination.password)throw Error('Unsafe redirect destination blocked.');const next=destination.href;redirects.push({url,status:result.status,to:next});if(scopeOrigin&&destination.origin!==scopeOrigin)return {...result,url:next,redirects,offsite:true};url=next;continue;
   }
   return {...result,url,redirects};
  }
  throw Error('Redirect limit exceeded.');
 }
}
