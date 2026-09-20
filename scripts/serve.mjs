import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav','.json':'application/json','.md':'text/plain'};
const port=Number(process.env.PORT||8043);
const server=createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/'){res.writeHead(302,{Location:'/examples/'}).end();return;}let path=resolve(root,'.'+pathname);if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403).end();return;}if((await stat(path)).isDirectory())path=resolve(path,'index.html');const body=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404).end('Not found');}});
server.listen(port,'127.0.0.1',()=>console.log(`Atari engine examples: http://127.0.0.1:${port}/`));
