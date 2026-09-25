import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  publicDir:false,
  build:{
    target:'es2022',outDir:resolve(process.cwd(),'dist'),emptyOutDir:false,
    lib:{entry:resolve(process.cwd(),'cloudflare/src/index.js'),
         formats:['es'],fileName:()=> '_worker.js'},
    rollupOptions:{output:{entryFileNames:'_worker.js'}}
  }
});
