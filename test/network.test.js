import test from 'node:test';
import assert from 'node:assert/strict';
import {NetworkClient,isPublicIP,resolveTarget} from '../src/network.js';
import {fixture} from './fixture.js';
test('private, reserved, mapped IPv4 and mixed DNS answers are blocked by default',async()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.1.2','100.64.1.1','0.0.0.0','192.0.2.10','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])assert.equal(isPublicIP(ip),false,ip);
 assert.ok(isPublicIP('1.1.1.1'));assert.ok(isPublicIP('2606:4700:4700::1111'));
 for(const url of ['http://127.0.0.1/','http://2130706433/','http://[::ffff:127.0.0.1]/','http://169.254.169.254/'])await assert.rejects(resolveTarget(url),/blocked/);
 await assert.rejects(resolveTarget('https://mixed.example/',{lookup:async()=>[{address:'1.1.1.1',family:4},{address:'127.0.0.1',family:4}]}),/blocked/);
});
test('resolved addresses are pinned, limits hold, and only read-only requests are accepted',async()=>{
 const f=await fixture();try{
  let lookups=0;const port=new URL(f.origin).port;const client=new NetworkClient({allowPrivate:true,lookup:async()=>{lookups++;return [{address:'127.0.0.1',family:4}];}});const r=await client.fetch('http://fixture.example:'+port+'/before/');assert.equal(r.status,200);assert.equal(lookups,1);assert.equal(f.requests[0].host,'fixture.example:'+port);
  await assert.rejects(client.once(f.origin,{method:'POST'}),/read-only/);
  await assert.rejects(new NetworkClient({allowPrivate:true,timeout:30}).fetch(f.origin+'/slow'),/timed out/);
  await assert.rejects(new NetworkClient({allowPrivate:true,maxBytes:1000}).fetch(f.origin+'/compressed'),/size limit/);
  await assert.rejects(new NetworkClient({allowPrivate:true,maxRequests:0}).fetch(f.origin),/budget/);
  const scope=new NetworkClient({allowPrivate:true});const redirect=await scope.fetch(f.origin+'/redirect-private',{scopeOrigin:f.origin});assert.equal(redirect.offsite,true);assert.equal(scope.requests,1);
  await assert.rejects(new NetworkClient({allowPrivate:true}).fetch(f.origin+'/broken/loop/'),/loop/);
 }finally{await f.close();}
});
