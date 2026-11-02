import { writeFileSync, mkdirSync } from 'node:fs';
const terms=['paracetamol','ibuprofeno','omeprazol','losartan','metformina','amoxicilina','naproxeno','loratadina','suero','vida suero oral','pañal','jabon','detergente','papel higienico','suavizante','shampoo','pasta dental','desodorante','cloro','servilleta','azucar','sal'];
const out={};
for(const c of ['0901','1502'])for(const t of terms){try{const r=await fetch(`https://qqp.profeco.gob.mx/api/precios?clave_ciudad=${c}&busqueda=${encodeURIComponent(t)}`,{headers:{Accept:'application/json'}});const j=await r.json();const rows=(j.data&&j.data.productos)||[];
out[c+'|'+t]={n:rows.length,cadenas:[...new Set(rows.map(x=>x.cadena_comercial))],nombres:[...new Set(rows.map(x=>x.producto))].slice(0,15),fecha:rows.map(x=>x.fecha_observacion).sort().pop()}}catch(e){out[c+'|'+t]={err:e.message}}await new Promise(r=>setTimeout(r,700))}
mkdirSync('debug',{recursive:true});writeFileSync('debug/sondeo.json',JSON.stringify(out,null,1));
