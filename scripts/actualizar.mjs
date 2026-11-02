// Plato Justo · actualiza precios.json con datos de PROFECO (Quién es Quién en los Precios)
// Corre en GitHub Actions todos los días. Node 20+, sin dependencias.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';

const API = 'https://qqp.profeco.gob.mx/api';
const CIUDADES = (process.env.CIUDADES || '0901').split(',').map(s => s.trim()).filter(Boolean);
const PAUSA = 800;
const DIAS_VALIDOS = 35; // ignora observaciones más viejas que esto respecto a la más reciente

const N = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// u: kg | l | pz  →  precio por kilo, por litro o por pieza (igual que la app)
const R = {
  pechuga:   { q: ['pechuga', 'pollo'], u: 'kg', m: /PECHUGA/, x: /EMPANIZ|NUGGET|ROSTIZ|JAMON|SALCHICHA|CALDO|CONSOME|SOPA|PAVO|CONGELAD/ },
  pierna:    { q: ['pierna', 'pollo'], u: 'kg', m: /PIERNA|MUSLO/, x: /EMPANIZ|ROSTIZ|CERDO|PAVO|ADOBAD|CONGELAD/ },
  molida:    { q: ['carne molida', 'res'], u: 'kg', m: /MOLIDA/, x: /CERDO|PUERCO|PAVO|POLLO|SOYA|PERRO|GATO/ },
  bistec:    { q: ['bistec', 'res'], u: 'kg', m: /BISTEC|BISTEK|BISTE\b/, x: /CERDO|PUERCO|POLLO|PAVO|EMPANIZ/ },
  cerdo:     { q: ['cerdo', 'puerco'], u: 'kg', m: /BISTEC|BISTEK|PULPA|LOMO|CHULETA|PIERNA/, x: /JAMON|CHORIZO|CHICHARR|MANTECA|SALCHICHA|TOCINO|AHUMAD|ENLATAD/ },
  chorizo:   { q: ['chorizo'], u: 'kg', m: /CHORIZO/, x: /SORIA|ESPANOL|PAVO|POLLO|SALAMI/ },
  jamon:     { q: ['jamon'], u: 'kg', m: /PAVO/, x: /SERRANO|IBERICO|PIERNA AHUMADA/ },
  salchicha: { q: ['salchicha'], u: 'kg', m: /SALCHICHA/, x: /COCTEL|PERRO|LATA/ },
  atun:      { q: ['atun'], u: 'pz', m: /AGUA/, x: /ACEITE|ENSALADA|MAYONESA|CHIPOTLE|PERRO|GATO/, g: [120, 190] },
  tilapia:   { q: ['tilapia', 'pescado'], u: 'kg', m: /TILAPIA/, x: /EMPANIZ|NUGGET/ },
  huevo:     { q: ['huevo'], u: 'pz', m: /HUEVO/, x: /POLVO|CODORNIZ|DESHIDR|CHOCOLATE|PASCUA|LIQUIDO/ },
  leche:     { q: ['leche'], u: 'l', m: /LECHE/, x: /POLVO|EVAPORADA|CONDENSADA|SABOR|CHOCOLATE|FRESA|VAINILLA|SOYA|ALMENDRA|AVENA|COCO|ARROZ|BEBE|INFANTIL|FORMULA|NINOS|KINDER|CORPORAL|CREMA|MAGNESIA|LIMPIADORA|CAJETA|DULCE|ATOLE/ },
  oaxaca:    { q: ['queso oaxaca', 'queso'], u: 'kg', m: /OAXACA/, x: /BOTANA|PIZZA/ },
  panela:    { q: ['queso panela', 'queso'], u: 'kg', m: /PANELA/, x: /BOTANA/ },
  crema:     { q: ['crema'], u: 'l', m: /CREMA/, x: /CACAHUATE|AVELLANA|BATIDA|CAFE|PEINAR|CORPORAL|DENTAL|DIENTES|CABELLO|PIEL|MANOS|LIMPIADORA|SOPA|AFEITAR|COCO|CHANTILLY|ELOTE|CHAMPI|ROSTRO|FACIAL|ANTIARRUG|HIDRATANTE|HELADO|GALLETA|ENJUAGUE|POLVO|VEGETAL|PARA BATIR/ },
  yogur:     { q: ['yoghurt', 'yogurt', 'yogur'], u: 'kg', m: /NATURAL|GRIEGO/, x: /BEBIBLE|FRESA|DURAZNO|MANGO|NUEZ|CEREAL|PINA|ZARZAMORA|MIEL|VAINILLA/ },
  tortilla:  { q: ['tortilla'], u: 'kg', m: /MAIZ|TORTILLA/, x: /HARINA|TOSTADA|TOTOPO|INTEGRAL|NOPAL|CHIPS|DORADA/ },
  harina:    { q: ['tortilla de harina', 'tortilla'], u: 'kg', m: /HARINA/, x: /INTEGRAL|MAIZ|NOPAL/ },
  bolillo:   { q: ['bolillo', 'pan blanco'], u: 'pz', m: /BOLILLO/, x: /CAJA|MOLIDO/ },
  tostada:   { q: ['tostada'], u: 'pz', m: /TOSTADA/, x: /PAN TOSTADO|HORNEADA DE NOPAL/ },
  arroz:     { q: ['arroz'], u: 'kg', m: /ARROZ/, x: /INTEGRAL|INSTANT|SABOR|LECHE|ATOLE|CEREAL|HARINA|JAZMIN|BASMATI|ARBORIO|VERDE|ROJO|PREPARADO|INFLADO|GALLETA|BEBIDA|POLVO|PAPILLA/ },
  frijol:    { q: ['frijol'], u: 'kg', m: /FRIJOL/, x: /REFRITO|LATA|SOBRE|GUISADO|PREPARADO|COCIDO|CON |BOLSA STAND|SOPA|PAQUETE LISTO/ },
  lenteja:   { q: ['lenteja'], u: 'kg', m: /LENTEJA/, x: /LATA|SOPA|PREPARAD/ },
  pasta:     { q: ['pasta', 'spaghetti', 'fideo'], u: 'kg', m: /PASTA|SPAGHETTI|ESPAGUETI|FIDEO|CODO|MACARRON/, x: /DENTAL|DIENTES|INSTANT|VASO|LASANA|TOMATE|CAJA|QUESO|CHAROLA|HOJALDRE|PUREE/ },
  avena:     { q: ['avena'], u: 'kg', m: /AVENA/, x: /BEBIDA|GALLET|BARRA|SABOR|INSTANT|LECHE|CEREAL|JABON|SHAMPOO|CREMA/ },
  pozolero:  { q: ['maiz pozolero', 'pozole'], u: 'kg', m: /POZOL/, x: /SOPA|LATA PREPARAD/ },
  panmolido: { q: ['pan molido'], u: 'kg', m: /MOLIDO/, x: /AZUCAR|SAL/ },
  aceite:    { q: ['aceite'], u: 'l', m: /VEGETAL|CANOLA|SOYA|MAIZ|GIRASOL|CARTAMO|MIXTO|COMESTIBLE/, x: /OLIVA|AEROSOL|SPRAY|BEBE|MOTOR|AUTOMOTRIZ|CORPORAL|COCO|AGUACATE|ATUN|SARDINA|CABELLO|MASAJE|LUBRICANTE/ },
  chipotle:  { q: ['chile chipotle', 'chipotle', 'chiles'], u: 'pz', m: /CHIPOTLE/, x: /SALSA|POLVO|ATUN|MAYO|ADEREZO|SOPA|CREMA|SAZON/, g: [90, 260] },
  guajillo:  { q: ['guajillo', 'chile seco', 'chile'], u: 'kg', m: /GUAJILLO/, x: /SALSA|POLVO|MOLIDO/ },
  papa:      { q: ['papa'], u: 'kg', m: /\bPAPA\b/, x: /PAPAS|FRITA|CHIP|SABRITAS|PAPILLA|CONGEL|PURE|HASH|GAJO|BOTANA/ },
  jitomate:  { q: ['jitomate'], u: 'kg', m: /JITOMATE/, x: /PURE|SALSA|LATA|PASTA|CATSUP|CALDO|POLVO|DESHIDR|SAZON|CONSOME|JUGO|PICADO/ },
  cebolla:   { q: ['cebolla'], u: 'kg', m: /CEBOLLA/, x: /POLVO|DESHIDR|SAL |SOPA|AROS|ENCURT|CAMBRAY|MORADA|CHIPS|SAZON/ },
  ajo:       { q: ['ajo'], u: 'kg', m: /\bAJO\b/, x: /POLVO|SAL |PASTA|MOLIDO|CAPSULA|ACEITE|SAZON|PICADO|ENCURT|JOVEN/ },
  serrano:   { q: ['chile serrano', 'chile'], u: 'kg', m: /SERRANO/, x: /LATA|ENCURT|RAJAS|ESCABECHE|POLVO|SALSA|FRASCO|JAMON/ },
  cilantro:  { q: ['cilantro'], u: 'pz', m: /CILANTRO/, x: /POLVO|DESHIDR|SEMILLA|MOLIDO/ },
  lechuga:   { q: ['lechuga'], u: 'pz', m: /LECHUGA/, x: /BOLSA|ENSALADA|MIX|PICADA|CHAROLA|ORGANICA/ },
  aguacate:  { q: ['aguacate'], u: 'kg', m: /AGUACATE/, x: /ACEITE|GUACAMOLE|SALSA|CREMA|SHAMPOO|PULPA/ },
  limon:     { q: ['limon'], u: 'kg', m: /LIMON/, x: /JUGO|AGUA|SABOR|CONCENTR|REFRESCO|LIMPIA|DETERG|JABON|TE |GALLETA|POLVO|SAL |CLORO|AROMA|AMARILLO|REAL/ },
  calabacita:{ q: ['calabacita', 'calabaza'], u: 'kg', m: /CALABACITA|CALABAZA ITALIANA|CALABAZA/, x: /SEMILLA|PEPITA|DULCE|CREMA|SOPA|CONGEL|FLOR|PURE|CASTILLA/ },
  zanahoria: { q: ['zanahoria'], u: 'kg', m: /ZANAHORIA/, x: /JUGO|LATA|PICADA|CONGEL|PAPILLA|BEBE|BABY|RALLADA/ },
  nopal:     { q: ['nopal'], u: 'kg', m: /NOPAL/, x: /LATA|FRASCO|ENCURT|CAPSUL|ESCABECHE|TORTILLA|TOSTADA|POLVO|SALMUERA/ },
  platano:   { q: ['platano'], u: 'kg', m: /PLATANO/, x: /DESHIDR|FRITO|CHIP|PAPILLA|SABOR|PAN |MACHO|DOMINICO|MANZANO/ },
  manzana:   { q: ['manzana'], u: 'kg', m: /MANZANA/, x: /JUGO|NECTAR|COMPOTA|SIDRA|PAPILLA|SABOR|VINAGRE|TE |REFRESCO|DESHIDR|CHIPS|SHAMPOO|AROMA/ },
  pina:      { q: ['pina'], u: 'kg', m: /\bPINA\b/, x: /LATA|ALMIBAR|JUGO|NECTAR|COLADA|SABOR|REFRESCO|DESHIDR|PICADA|ENCHILADA|MIEL/ },
  champi:    { q: ['champinon', 'champinones'], u: 'kg', m: /CHAMPI/, x: /LATA|SOPA|CREMA|FRASCO|SALSA|EN SALMUERA|CONSOME|POLVO/ },
  morron:    { q: ['pimiento', 'chile morron'], u: 'kg', m: /MORRON|PIMIENTO/, x: /LATA|FRASCO|POLVO|EN TIRAS|ASADO|PIMIENTA|SALSA/ },
  tomverde:  { q: ['tomate verde', 'tomate'], u: 'kg', m: /TOMATE/, x: /JITOMATE|PURE|SALSA|LATA|PASTA|CATSUP|CALDO|POLVO|DESHIDR|SAZON|CONSOME|JUGO|ROJO|CHERRY|BOLA|SALADET|PICADO/ },
  granola:   { q: ['granola'], u: 'kg', m: /GRANOLA/, x: /BARRA|YOG|BEBIDA|GALLET/ },
};

// Cadenas de PROFECO → tiendas de la app (el orden importa)
function tienda(cadena) {
  const c = N(cadena);
  if (/AURRERA/.test(c)) return 'aurrera';
  if (/SORIANA/.test(c)) return 'soriana';
  if (/CHEDRAUI|SUPER CHE\b/.test(c)) return 'chedraui';
  if (/LA COMER|FRESKO|CITY MARKET|SUMESA/.test(c)) return 'lacomer';
  if (/WAL ?MART|SUPERAMA/.test(c)) return 'walmart';
  if (/\b3 ?B\b|TRES B/.test(c)) return '3b';
  if (/MERCADO|CENTRAL DE ABAST|TIANGUIS|TORTILLERIA/.test(c)) return 'mercado';
  return null;
}

// Tamaño de la presentación: { g } gramos / { ml } mililitros / { pz } piezas
function tamano(t) {
  const s = N(t).replace(/(\d),(\d)/g, '$1.$2');
  const out = {};
  const num = x => parseFloat(x);
  let m;
  const multi = s.match(/(\d+)\s*(?:PZAS?|PIEZAS?|LATAS?|PZ)\s*(?:DE|X|C\/)\s*(\d+(?:\.\d+)?)\s*(KG|G|GR|GRS|GRAMOS|ML|L|LT|LTS)\b/);
  const pzm = s.match(/(?:C\/|CON\s*)?(\d+)\s*(?:PZAS?|PIEZAS?|PZ|UNIDADES|TORTILLAS|HUEVOS)\b/);
  if (pzm) out.pz = num(pzm[1]);
  const re = /(\d+(?:\.\d+)?)\s*(KG|KILOS?|KGS|G|GR|GRS|GRAMOS|L|LT|LTS|LITROS?|ML|MILILITROS)\b/g;
  let last = null;
  while ((m = re.exec(s))) last = m;
  if (last) {
    const v = num(last[1]), u = last[2];
    if (/^K/.test(u)) out.g = v * 1000;
    else if (/^G/.test(u)) out.g = v;
    else if (/^M/.test(u)) out.ml = v;
    else out.ml = v * 1000;
  } else if (/\bKG\b|KILO|GRANEL/.test(s)) out.g = 1000;
  else if (/\bLITRO\b|\bLT\b/.test(s)) out.ml = 1000;
  if (multi) {
    const k = num(multi[1]), v = num(multi[2]), u = multi[3];
    const total = /^K/.test(u) ? v * 1000 * k : /^(G)/.test(u) ? v * k : /^M/.test(u) ? v * k : v * 1000 * k;
    if (/^(K|G)/.test(u)) { out.g = total; out.each = /^K/.test(u) ? v * 1000 : v; } else { out.ml = total; out.each = /^M/.test(u) ? v : v * 1000; }
    out.pz = k;
  }
  return out;
}

// Precio por unidad de la app
function unitario(rule, r, sz) {
  const precio = Number(r.precio);
  if (!(precio > 0)) return null;
  if (rule.u === 'kg') {
    if (sz.g) return precio / (sz.g / 1000);
    if (sz.ml) return precio / (sz.ml / 1000); // crema/yogur a veces en ml
    return null;
  }
  if (rule.u === 'l') {
    if (sz.ml) return precio / (sz.ml / 1000);
    if (sz.g) return precio / (sz.g / 1000);
    return null;
  }
  // piezas
  if (rule.g) { // latas: revisa el gramaje
    const each = sz.each || (sz.g && sz.pz ? sz.g / sz.pz : sz.g);
    if (!each || each < rule.g[0] || each > rule.g[1]) return null;
    return precio / (sz.pz || 1);
  }
  if (rule === R.huevo) {
    if (sz.pz) return precio / sz.pz;
    if (sz.g) return precio / (sz.g / 1000) / 16; // ~16 huevos por kilo
    return null;
  }
  if (rule === R.tostada) return sz.pz ? precio / sz.pz : null;
  return precio / (sz.pz || 1);
}

const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); const i = (a.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const r2 = x => Math.round(x * 100) / 100;

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (PlatoJusto precios; +https://github.com/leonre09-hub)' }, signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.log('  intento', i + 1, 'falló:', url, e.message);
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

function filas(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (json.data && Array.isArray(json.data.productos)) return json.data.productos;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.productos)) return json.productos;
  return [];
}

async function main() {
  mkdirSync('debug', { recursive: true });
  const ciud = await getJSON(API + '/ciudades');
  writeFileSync('debug/ciudades.json', JSON.stringify(ciud, null, 1));

  const cache = {}; // busqueda|ciudad → filas
  const muestras = {};
  const terms = [...new Set(Object.values(R).flatMap(r => r.q))];
  for (const city of CIUDADES) {
    for (const t of terms) {
      const url = `${API}/precios?clave_ciudad=${encodeURIComponent(city)}&busqueda=${encodeURIComponent(t)}`;
      const j = await getJSON(url);
      const rows = filas(j);
      cache[t + '|' + city] = rows;
      muestras[t + '|' + city] = { n: rows.length, ejemplo: rows.slice(0, 2), nombres: [...new Set(rows.map(r => r.producto))].slice(0, 40), cadenas: [...new Set(rows.map(r => r.cadena_comercial))] };
      console.log(`${city} · ${t}: ${rows.length} filas`);
      await sleep(PAUSA);
    }
  }
  writeFileSync('debug/muestras.json', JSON.stringify(muestras, null, 1));

  const items = {};
  const revision = {};
  for (const [id, rule] of Object.entries(R)) {
    const seen = new Set();
    let obs = [];
    for (const city of CIUDADES) for (const t of rule.q) for (const r of cache[t + '|' + city] || []) {
      const txt = N((r.tipo_producto || '') + ' ' + (r.producto || ''));
      const prod = N(r.producto);
      if (!rule.m.test(txt) || rule.x.test(prod)) continue;
      const st = tienda(r.cadena_comercial);
      if (!st) continue;
      const key = [st, N(r.establecimiento), prod, r.fecha_observacion].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const sz = tamano(r.producto);
      const pu = unitario(rule, r, sz);
      if (!pu || !isFinite(pu)) continue;
      obs.push({ st, pu, prod: r.producto, precio: Number(r.precio), fecha: r.fecha_observacion || '', est: r.establecimiento });
    }
    if (!obs.length) { revision[id] = { n: 0 }; continue; }
    const maxF = obs.map(o => o.fecha).sort().pop();
    if (maxF) {
      const lim = new Date(new Date(maxF).getTime() - DIAS_VALIDOS * 864e5).toISOString().slice(0, 10);
      obs = obs.filter(o => !o.fecha || o.fecha >= lim);
    }
    // quita valores absurdos (fuera de 0.33x – 3x de la mediana general)
    const med = pct(obs.map(o => o.pu), 0.5);
    obs = obs.filter(o => o.pu > med / 3 && o.pu < med * 3);
    const stores = {};
    for (const st of [...new Set(obs.map(o => o.st))]) {
      const os = obs.filter(o => o.st === st);
      // "calidad-precio": el cuartil bajo, no el más barato raro ni el premium
      const p = pct(os.map(o => o.pu), os.length >= 4 ? 0.25 : 0.5);
      const rep = os.reduce((a, b) => Math.abs(b.pu - p) < Math.abs(a.pu - p) ? b : a);
      stores[st] = { p: r2(p), prod: rep.prod, precio: r2(rep.precio), fecha: rep.fecha, n: os.length };
    }
    items[id] = { u: rule.u, ref: r2(pct(Object.values(stores).map(s => s.p), 0.5)), stores };
    revision[id] = { n: obs.length, tiendas: Object.fromEntries(Object.entries(stores).map(([k, v]) => [k, `${v.p} · ${v.prod}`])) };
  }
  writeFileSync('debug/revision.json', JSON.stringify(revision, null, 1));

  const total = Object.keys(items).length;
  if (total < 10) {
    console.log('Muy pocos productos con precio (' + total + '); no se reemplaza precios.json');
    process.exitCode = existsSync('precios.json') ? 0 : 1;
    return;
  }
  const fechas = Object.values(items).flatMap(i => Object.values(i.stores).map(s => s.fecha)).filter(Boolean).sort();
  const out = {
    v: 1,
    actualizado: new Date().toISOString(),
    datos_hasta: fechas[fechas.length - 1] || null,
    fuente: 'PROFECO, Programa Quién es Quién en los Precios (QQP)',
    ciudades: CIUDADES,
    items,
  };
  writeFileSync('precios.json', JSON.stringify(out));
  console.log('Listo:', total, 'productos con precio');
}

main().catch(e => { console.error(e); process.exit(1); });
