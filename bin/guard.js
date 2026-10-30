#!/usr/bin/env node
import {readFile,writeFile,mkdir,stat,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanSite} from '../src/scan.js';
import {compareSnapshots} from '../src/compare.js';
import {renderHtml} from '../src/report.js';
import {validateSnapshot,validateConfig,routeOf} from '../src/model.js';
const help=`Website Redesign Guard 1.0.0 — read-only checks by Essex Website Builders

  snapshot --url https://old.example --out reports/before.json
  compare  --before reports/before.json --url https://new.example --out reports/report.html
  analyse  --before reports/before.json --after reports/after.json --out reports/report.html

Options:
  --config FILE         JSON: paths, retired, allowedChanges (see examples/changes.json)
  --json FILE           Also save comparison findings as JSON
  --save-after FILE     Save the fetched target snapshot for reuse
  --urls FILE           Snapshot a URL list (.txt or CSV with a url column)
  --sitemap URL         Use one same-origin sitemap instead of automatic discovery
  --max-pages N         1–200, default 50
  --max-assets N        0–100, default 40; external images are not fetched
  --timeout N           Per-request timeout in milliseconds, 1000–30000, default 8000
  --environment MODE    production (default) or staging
  --fail-on LEVEL       error (default), warning or none
  --allow-private       Explicitly permit local/private staging networks you control
  --force               Permit overwriting output files
  --help / --version

Exit codes: 0 no selected-severity findings; 1 findings; 2 usage/network/output failure.
No logins, cookies, JavaScript execution, form submissions or site changes.
`;
export function parseCSV(input){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){const c=input[i];if(quoted){if(c==='"'&&input[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"'&&!cell)quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('Unclosed quote in CSV.');if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}return rows;
}
async function inputFile(file){const info=await stat(file);if(info.size>10_000_000)throw Error('Input files are limited to 10 MB.');return readFile(file,'utf8');}
async function jsonFile(file){try{return JSON.parse(await inputFile(file));}catch(error){throw Error('Cannot read JSON '+file+': '+error.message);}}
async function main(){
 const args=process.argv.slice(2);if(args.includes('--version')){console.log('1.0.0');return;}if(!args.length||args.includes('--help')){console.log(help);return;}
 const command=args.shift();if(!['snapshot','compare','analyse'].includes(command))throw Error('Unknown command. Use --help.');
 const known=new Set(['url','out','before','after','config','json','save-after','urls','sitemap','max-pages','max-assets','timeout','environment','fail-on','allow-private','force']),flags={};
 while(args.length){const key=args.shift();if(!key.startsWith('--')||!known.has(key.slice(2)))throw Error('Unknown option: '+key);const name=key.slice(2);if(Object.hasOwn(flags,name))throw Error('Duplicate option: '+key);if(['allow-private','force'].includes(name))flags[name]=true;else{const value=args.shift();if(!value||value.startsWith('--'))throw Error('Missing value for '+key);flags[name]=value;}}
 if(!flags.out)throw Error('Choose an output path with --out.');
 const outputs=[flags.out,flags.json,flags['save-after']].filter(Boolean).map(f=>path.resolve(f)),inputs=[flags.before,flags.after,flags.config,flags.urls].filter(Boolean).map(f=>path.resolve(f));
 if(new Set(outputs).size!==outputs.length||outputs.some(f=>inputs.includes(f)))throw Error('Input and output paths must be distinct.');
 for(const file of outputs){if(!flags.force){let exists=true;try{await access(file);}catch{exists=false;}if(exists)throw Error('Output exists; choose another path or use --force: '+file);}}
 const number=(name,def,min,max)=>{const n=flags[name]===undefined?def:Number(flags[name]);if(!Number.isInteger(n)||n<min||n>max)throw Error('Invalid --'+name);return n;};
 const options={allowPrivate:!!flags['allow-private'],maxPages:number('max-pages',50,1,200),maxAssets:number('max-assets',40,0,100),timeout:number('timeout',8000,1000,30000),sitemap:flags.sitemap};
 const config=validateConfig(flags.config?await jsonFile(flags.config):{}),environment=flags.environment||'production',failOn=flags['fail-on']||'error';if(!['error','warning','none'].includes(failOn))throw Error('Invalid --fail-on.');if(!['production','staging'].includes(environment))throw Error('Invalid --environment.');
 const save=async(file,content)=>{await mkdir(path.dirname(path.resolve(file)),{recursive:true});await writeFile(file,content,{flag:flags.force?'w':'wx'});};
 if(command==='snapshot'){
  if(!flags.url)throw Error('snapshot needs --url.');
  if(flags.urls){const value=await inputFile(flags.urls);let urls;if(/\.csv$/i.test(flags.urls)){const rows=parseCSV(value.replace(/^\uFEFF/,''));const index=rows.shift()?.findIndex(v=>v.trim().toLowerCase()==='url');if(index===undefined||index<0)throw Error('CSV needs a url column.');urls=rows.map(r=>r[index]).filter(Boolean);}else urls=value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);if(urls.length>200)throw Error('URL lists are limited to 200 entries.');options.routes=urls.map(u=>{const route=routeOf(u,flags.url.endsWith('/')?flags.url:flags.url+'/');if(route===null)throw Error('URL list contains a route outside the selected site.');return route;});}
  console.error('Capturing source HTML. No forms will be submitted.');const snapshot=await scanSite(flags.url,options);await save(flags.out,JSON.stringify(snapshot,null,2)+'\n');console.log('Saved '+snapshot.pages.length+' page responses to '+flags.out);if(!snapshot.pages.length)process.exitCode=1;return;
 }
 if(!flags.before)throw Error(command+' needs --before.');const before=validateSnapshot(await jsonFile(flags.before));let after;
 if(command==='analyse'){if(!flags.after)throw Error('analyse needs --after.');after=validateSnapshot(await jsonFile(flags.after));}
 else{if(!flags.url)throw Error('compare needs --url.');options.routes=[...new Set(before.pages.flatMap(p=>[p.route,config.paths[p.route]||p.route]))];console.error('Checking target HTML, old routes and mapped destinations.');after=await scanSite(flags.url,options);}
 const report=compareSnapshots(before,after,{config,environment});await save(flags.out,renderHtml(report));if(flags.json)await save(flags.json,JSON.stringify(report,null,2)+'\n');if(flags['save-after'])await save(flags['save-after'],JSON.stringify(after,null,2)+'\n');
 console.log(`${report.summary.errors} errors, ${report.summary.warnings} review items, ${report.summary.info} notes. Report: ${flags.out}`);process.exitCode=failOn==='none'?0:report.summary.errors>0||(failOn==='warning'&&report.summary.warnings>0)?1:0;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))main().catch(error=>{console.error('Redesign Guard: '+error.message);process.exitCode=2;});
