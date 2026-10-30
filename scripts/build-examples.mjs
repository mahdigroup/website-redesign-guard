import {writeFile,mkdir} from 'node:fs/promises';
import {fixture} from '../test/fixture.js';
import {scanSite} from '../src/scan.js';
import {compareSnapshots} from '../src/compare.js';
import {renderHtml} from '../src/report.js';
const root=new URL('../',import.meta.url),f=await fixture();
try{
 const before=await scanSite(f.origin+'/before/',{allowPrivate:true,maxPages:30});const routes=[...before.pages.map(p=>p.route),'/services/'];
 const broken=await scanSite(f.origin+'/broken/',{allowPrivate:true,maxPages:30,routes}),ready=await scanSite(f.origin+'/ready/',{allowPrivate:true,maxPages:30,routes});
 function sanitise(data,prefix,domain){return JSON.parse(JSON.stringify(data).replaceAll(f.origin+'/before/','https://before.brightfield.example/').replaceAll(f.origin+'/'+prefix+'/',domain).replaceAll(f.origin,'https://fixture.brightfield.example').replaceAll(/\d{4}-\d\d-\d\dT[^" ]+/g,'2026-10-30T10:00:00.000Z'));}
 const original=sanitise(before,'before','https://before.brightfield.example/'),regression=sanitise(broken,'broken','https://after.brightfield.example/'),repaired=sanitise(ready,'ready','https://after.brightfield.example/');
 await mkdir(new URL('demo/data/',root),{recursive:true});await mkdir(new URL('examples/',root),{recursive:true});
 for(const [name,data] of Object.entries({before:original,broken:regression,ready:repaired}))await writeFile(new URL('examples/'+name+'.json',root),JSON.stringify(data,null,2)+'\n');
 await writeFile(new URL('examples/changes.json',root),JSON.stringify(f.config,null,2)+'\n');
 const samples={};for(const [name,after] of [['regression',regression],['ready',repaired]]){const report=compareSnapshots(original,after,{config:f.config});report.createdAt='2026-10-30T10:00:00.000Z';report.sample=true;samples[name]=report;await writeFile(new URL('demo/data/'+name+'.json',root),JSON.stringify(report,null,2)+'\n');await writeFile(new URL('demo/'+name+'-report.html',root),renderHtml(report));}
 await writeFile(new URL('demo/samples.js',root),'export default '+JSON.stringify(samples)+';\n');
 console.log('Built synthetic example snapshots and reports. No client data included.');
}finally{await f.close();}
