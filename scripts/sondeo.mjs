import { writeFileSync, mkdirSync } from 'node:fs';
const UA='Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const urls=[
 'https://www.fahorro.com/catalogsearch/result/?q=losartan',
 'https://www.fahorro.com/',
 'https://www.farmaciasanpablo.com.mx/search/?text=losartan',
 'https://www.farmaciasanpablo.com.mx/rest/v2/fsp/products/search?query=losartan&fields=FULL',
 'https://www.farmaciasanpablo.com.mx/',
 'https://www.farmaciasdesimilares.com/',
 'https://www.farmaciasdesimilares.com/api/catalog_system/pub/products/search?ft=losartan',
 'https://www.farmaciasdesimilares.com/losartan?_q=losartan&map=ft',
 'https://farmaciasdesimilares.com/search?q=losartan',
];
const out={};
for(const u of urls){try{const r=await fetch(u,{headers:{'User-Agent':UA,'Accept':'text/html,application/json;q=0.9,*/*;q=0.8','Accept-Language':'es-MX,es;q=0.9'},redirect:'follow'});const t=await r.text();
 const hints=[...new Set((t.match(/https?:\/\/[^"' <>]*(unbxd|vtex|algolia|searchspring|klevu|constructor|bloomreach|api)[^"' <>]*/gi)||[]))].slice(0,40);
 const keys=[...new Set((t.match(/(unbxd|siteKey|apiKey|api_key|sitekey|vtex|account|appId|x-algolia)[^,;\n]{0,90}/gi)||[]))].slice(0,30);
 out[u]={status:r.status,final:r.url,len:t.length,server:r.headers.get('server'),ct:r.headers.get('content-type'),hints,keys,head:t.slice(0,1500),precio:(t.match(/\$\s?\d{1,4}(?:\.\d{2})/g)||[]).slice(0,15)}}catch(e){out[u]={err:e.message}}}
mkdirSync('debug',{recursive:true});writeFileSync('debug/sondeo_farmacias.json',JSON.stringify(out,null,1));
