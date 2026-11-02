import { writeFileSync, mkdirSync } from 'node:fs';
const UA='Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const H={'User-Agent':UA,'Accept':'application/json,text/html;q=0.9,*/*;q=0.8','Accept-Language':'es-MX,es;q=0.9'};
mkdirSync('debug/sondeo',{recursive:true});
const save=async(name,u,opt={})=>{try{const r=await fetch(u,{headers:{...H,...(opt.h||{})},redirect:'follow'});const t=await r.text();writeFileSync('debug/sondeo/'+name,`${r.status} ${r.url}\n${t.slice(0,opt.max||400000)}`)}catch(e){writeFileSync('debug/sondeo/'+name,'ERR '+e.message)}};
const API='https://api.coxdka37yz-unifarsad1-p2-public.model-t.cc.commerce.ondemand.com';
await save('sim.json','https://www.farmaciasdesimilares.com/api/catalog_system/pub/products/search?ft=losartan&_from=0&_to=4',{max:60000});
await save('ahorro.html','https://www.fahorro.com/catalogsearch/result/?q=losartan');
await save('sp_home.html','https://www.farmaciasanpablo.com.mx/',{max:20000});
for(const p of ['/occ/v2/basesites?fields=FULL','/occ/v2/fsp/products/search?query=losartan&fields=FULL&pageSize=5','/occ/v2/farmaciasanpablo/products/search?query=losartan&fields=FULL&pageSize=5','/occ/v2/sanpablo/products/search?query=losartan&fields=FULL&pageSize=5','/rest/v2/fsp/products/search?query=losartan&fields=FULL&pageSize=5'])
 await save('sp'+p.replace(/[^a-z0-9]/gi,'_').slice(0,60)+'.txt',API+p,{max:30000});
