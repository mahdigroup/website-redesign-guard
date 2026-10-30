import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.js';
import {scanSite} from '../src/scan.js';
import {compareSnapshots} from '../src/compare.js';
import {renderHtml} from '../src/report.js';
import {parseSitemap,extractPage} from '../src/extract.js';
import {validateSnapshot,validateConfig,siteURL,pageURL,emptyData} from '../src/model.js';
import {parseCSV} from '../bin/guard.js';
test('a realistic broken redesign is diagnosed; repaired and deliberately retired routes pass',async()=>{
 const f=await fixture();try{
  const before=await scanSite(f.origin+'/before/',{allowPrivate:true,maxPages:30});assert.equal(before.pages.length,8);assert.ok(before.coverage.skipped.some(s=>s.route==='/blocked/'));assert.ok(before.pages.some(p=>p.route==='/contact/'&&p.data.forms[0].fields.every(field=>field.labelled)));
  const routes=[...before.pages.map(p=>p.route),'/services/'];const broken=await scanSite(f.origin+'/broken/',{allowPrivate:true,maxPages:30,routes});const report=compareSnapshots(before,broken,{config:f.config});const codes=new Set(report.findings.map(f=>f.code));
  for(const code of ['redirect-missing','homepage-catchall','temporary-redirect','redirect-chain','request-failed','title-duplicate','canonical-different','noindex','heading-missing','content-reduced','form-removed','contact-details-changed','broken-internal-link','broken-image','image-is-html','approved-retirement'])assert.ok(codes.has(code),code);
  const ready=await scanSite(f.origin+'/ready/',{allowPrivate:true,maxPages:30,routes});const good=compareSnapshots(before,ready,{config:f.config});assert.equal(good.summary.errors,0,JSON.stringify(good.findings));assert.equal(good.summary.warnings,0,JSON.stringify(good.findings));assert.ok(good.findings.some(f=>f.code==='approved-retirement'));
  assert.ok(f.requests.every(r=>['GET','HEAD'].includes(r.method)&&!r.cookie&&!r.authorization));assert.ok(!f.requests.some(r=>r.url.includes('/blocked/')||r.url==='/never-submit'));
  const staging=compareSnapshots(before,broken,{config:f.config,environment:'staging'});assert.ok(!staging.findings.some(f=>f.code==='noindex'));assert.equal(staging.findings.find(f=>f.code==='canonical-different').severity,'info');
 }finally{await f.close();}
});
test('page limits and robots blocking do not produce a false clean result',async()=>{
 const f=await fixture();try{const limited=await scanSite(f.origin+'/before/',{allowPrivate:true,maxPages:1,maxAssets:0});const r=compareSnapshots(limited,limited);assert.ok(r.findings.some(f=>f.code==='page-limit'));const empty={version:1,base:'https://empty.example/',pages:[],assets:[],coverage:{}};assert.equal(compareSnapshots(empty,empty).summary.errors,2);}finally{await f.close();}
});
test('HTML extraction keeps exact metadata, label relationships and contact links without executing scripts',()=>{
 const d=extractPage('<html><head><title>A &amp; B</title><meta NAME="description" content="Useful"><link REL="canonical" href="/test/"></head><body><main><h1>Hello</h1><script>throw Error("do not run")</script><a href="tel:020 8064 1002">Call</a><form><label id="description">Your email</label><input type="email" aria-labelledby="description"><label>Message<textarea></textarea></label></form></main></body></html>','https://site.example/test/');assert.deepEqual(d.titles,['A & B']);assert.equal(d.canonicals[0],'https://site.example/test/');assert.equal(d.phones[0],'02080641002');assert.ok(d.forms[0].fields.every(f=>f.labelled));assert.ok(!d.text.includes('throw Error'));
});
test('XML and input validation reject active declarations, malformed snapshots and unsafe configuration',()=>{
 assert.throws(()=>parseSitemap('<!DOCTYPE urlset [<!ENTITY a SYSTEM "file:///etc/passwd">]><urlset/>'),/not supported/);assert.throws(()=>parseSitemap('<html/>'),/not a supported/i);assert.throws(()=>validateSnapshot({version:2,pages:[]}),/version 1/);assert.throws(()=>siteURL('file:///secret'));assert.throws(()=>siteURL('https://user:pass@example.com/'));assert.throws(()=>pageURL('https://site.example/','//evil.example/'));assert.throws(()=>validateConfig({retired:['/']}));assert.throws(()=>validateConfig({allowedChanges:{'/':['noindex']}}));assert.throws(()=>validateConfig({paths:{'/a/':'https://other.example/'}}));
});
test('reports escape hostile content and have no scripts, trackers or automatic form actions',()=>{
 const s={version:1,base:'https://before.example/',pages:[{route:'/',url:'https://before.example/',finalURL:'https://before.example/',status:200,data:{...emptyData(),titles:['<script>alert(1)</script>'],wordCount:150}}],assets:[],coverage:{}};
 const after=structuredClone(s);after.base='https://after.example/';after.pages[0].finalURL='https://after.example/';after.pages[0].data.titles=['<img src=x onerror=alert(1)>'];const html=renderHtml(compareSnapshots(s,after));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>')&&!html.includes('<img src=x'));assert.ok(html.includes("default-src 'none'"));assert.ok(html.includes('https://essexwebsitebuilders.co.uk/'));
});
test('CSV lists support quotes, CRLF and the published route mapping format',()=>{assert.deepEqual(parseCSV('url,note\r\n"https://a.example/?x=1,y=2","A ""quote"""\r\n'),[['url','note'],['https://a.example/?x=1,y=2','A "quote"']]);assert.throws(()=>parseCSV('url\n"unterminated'));assert.equal(pageURL('https://site.example/staging/','/contact/'),'https://site.example/staging/contact/');});
