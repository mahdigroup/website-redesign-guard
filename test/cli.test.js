import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture} from './fixture.js';
const exec=promisify(execFile),cli=fileURLToPath(new URL('../bin/guard.js',import.meta.url));
async function run(args){try{const r=await exec(process.execPath,[cli,...args],{timeout:30000});return {...r,code:0};}catch(error){return {code:error.code,stdout:error.stdout,stderr:error.stderr};}}
test('CLI snapshots, mapped comparison, offline reports, exit codes and overwrite protection work end to end',async()=>{
 const f=await fixture(),dir=await mkdtemp(path.join(tmpdir(),'ewb guard test '));try{
  const before=path.join(dir,'before.json'),html=path.join(dir,'report.html'),json=path.join(dir,'report.json'),after=path.join(dir,'after.json'),config=path.join(dir,'changes.json');await writeFile(config,JSON.stringify(f.config));
  const first=await run(['snapshot','--url',f.origin+'/before/','--out',before,'--allow-private']);assert.equal(first.code,0,first.stderr);const original=await readFile(before,'utf8');assert.ok(JSON.parse(original).pages.length>=8);
  const duplicate=await run(['snapshot','--url',f.origin+'/before/','--out',before,'--allow-private']);assert.equal(duplicate.code,2);assert.equal(await readFile(before,'utf8'),original);
  const bad=await run(['compare','--before',before,'--url',f.origin+'/broken/','--out',html,'--json',json,'--save-after',after,'--config',config,'--allow-private']);assert.equal(bad.code,1,bad.stderr);assert.ok(JSON.parse(await readFile(json,'utf8')).summary.errors>0);assert.match(await readFile(html,'utf8'),/production page requests no indexing/);
  const offline=await run(['analyse','--before',before,'--after',after,'--out',html,'--config',config,'--force','--fail-on','none']);assert.equal(offline.code,0,offline.stderr);
  const good=await run(['compare','--before',before,'--url',f.origin+'/ready/','--out',html,'--config',config,'--allow-private','--force']);assert.equal(good.code,0,good.stderr);
  const same=await run(['analyse','--before',before,'--after',after,'--out',before,'--force']);assert.equal(same.code,2);assert.equal(await readFile(before,'utf8'),original);
  const invalid=await run(['snapshot','--url',f.origin,'--out',path.join(dir,'bad.json'),'--max-pages','999']);assert.equal(invalid.code,2);
  assert.ok(f.requests.every(r=>['GET','HEAD'].includes(r.method)));
 }finally{await f.close();const parent=await realpath(tmpdir()),target=await realpath(dir);if(!target.startsWith(parent+path.sep)||!path.basename(target).startsWith('ewb guard test '))throw Error('Unexpected cleanup target.');await rm(target,{recursive:true,force:true});}
});
