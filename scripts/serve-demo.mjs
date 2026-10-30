import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files=new Map([['/','index.html'],['/index.html','index.html'],['/styles.css','styles.css'],['/guard-demo.js','guard-demo.js'],['/regression-report.html','regression-report.html'],['/ready-report.html','ready-report.html'],['/data/regression.json','data/regression.json'],['/data/ready.json','data/ready.json']]);
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',json:'application/json'};
files.set('/embed.html','embed.html');files.set('/guard-embed.js','guard-embed.js');
const server=http.createServer(async(req,res)=>{const file=files.get(new URL(req.url,'http://localhost').pathname);if(!file||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end('Not found');return;}try{const data=await readFile(new URL('../demo/'+file,import.meta.url));res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?'':data);}catch{res.writeHead(404);res.end('Not built. Run npm run build first.');}});
server.listen(Number(process.env.GUARD_PORT??4175),'127.0.0.1',()=>console.log('Demo: http://127.0.0.1:'+server.address().port+'/'));
