import { cpSync,rmSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
const source=resolve('docs'),output=resolve('dist');
if(!existsSync(resolve(source,'index.html')))throw Error('Missing docs/index.html');
rmSync(output,{recursive:true,force:true});
cpSync(source,output,{recursive:true});
if(!existsSync(resolve(output,'static/app.js'))||
 !existsSync(resolve(output,'config.js')))throw Error('Incomplete static assets');
console.log('Prepared BilaBot static assets for Cloudflare Pages');
