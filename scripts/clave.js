/* Compra Justa · agrupa el mismo medicamento aunque cada farmacia lo escriba distinto.
   Mismo código en la tarea diaria (Node) y en la app. */
var FJ = (function () {
  var NN = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };
  var STOP = /^(CAJA|CON|FRASCO|ORAL|TABS?|TABLETAS?|COMPRIMIDOS?|CAPSULAS?|CAPS?|GRAGEAS?|SOBRES?|SOLUCION|SUSPENSION|INYECTABLE|MARCA|DEL|AHORRO|GENERICO|GI|SIMI|SIMILARES|POTASICO|SODICO|SODICA|CALCICO|CLORHIDRATO|MALEATO|BESILATO|SUCCINATO|TARTRATO|LIBERACION|PROLONGADA|PUNTO|DE|LA|EL|Y|EN|PARA|LOS|LAS|ADULTO|INFANTIL|S\/M|PICK|UP|MG|ML|G|MCG|UI|PZA|PZAS|PIEZAS?|ENVASE|BLISTER|COMP|OVULOS?|GOTAS|JARABE|CREMA|GEL|POMADA|UNGUENTO|FCO|EFERVESCENTES?|MASTICABLES?|RECUBIERTAS?|DISPERSABLES?|SUBLINGUALES?|SOLUBLES?|CAPSULA|TABLETA|GRAGEA|TAB|LIQ)$/;
  function partes(nombre) {
    var t = NN(nombre).replace(/(\d),(\d)/g, '$1.$2');
    var esProfeco = /,\s*(S\/M|[A-Z0-9 .\-]+),/.test(t) && t.indexOf(',') < 40;
    var base = esProfeco ? t.split(',')[0] : t.replace(/\d+(?:\.\d+)?\s*(MCG|MG|ML|G|UI|%)?/g, ' ');
    var mols = base.split(/[\s\/\-+.,()]+/).filter(function (w) { return w.length > 3 && !STOP.test(w) && /^[A-Z]+$/.test(w); });
    var fuerzas = [];
    var re = /(\d+(?:\.\d+)?)\s*(MCG|MG|G|UI|%)(?!\s*\/\s*ML)/g, m;
    while ((m = re.exec(t))) { var v = parseFloat(m[1]); if (m[2] === 'G') { v = v * 1000; } fuerzas.push(String(v) + (m[2] === 'G' ? 'MG' : m[2])); }
    // combinaciones escritas "50/12.5 MG" o "50 MG/ 12.5 MG"
    var combo = t.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*MG/);
    if (combo) fuerzas = [parseFloat(combo[1]) + 'MG', parseFloat(combo[2]) + 'MG'];
    var cm = t.match(/\b(\d{1,3})\s*(?:TABS?|TABLETAS?|COMPRIMIDOS?|COMP|CAPS?|CAPSULAS?|GRAGEAS?|SOBRES?|OVULOS?|PZAS?|PIEZAS?)\b/) || t.match(/(?:C\/|CON\s+|X\s*)(\d{1,3})\b(?!\s*(?:ML|MG|G|MCG)\b)(?!\s*(?:ML|MG))/);
    var n = cm ? parseInt(cm[1], 10) : null;
    var ml = t.match(/(\d+(?:\.\d+)?)\s*ML\b(?!\s*\))/);
    var liquido = /SUSPENSION|JARABE|SOLUCION|GOTAS|\bML\b/.test(t) && !(/TABS?\b|TABLETAS?|COMPRIMIDOS?|CAPSULAS?|GRAGEAS?/.test(t));
    var forma = liquido ? 'L' : /CREMA|GEL\b|POMADA|UNGUENTO/.test(t) ? 'C' : 'S';
    if (forma !== 'S') n = null;
    return { mols: mols.slice(0, 3), fuerzas: fuerzas.slice(0, 3), n: n, ml: ml ? parseFloat(ml[1]) : null, forma: forma };
  }
  function clave(nombre) {
    var p = partes(nombre);
    if (!p.mols.length || !p.fuerzas.length) return null;
    var cant = p.forma === 'S' ? p.n : p.ml;
    if (!cant) return null;
    var mols = p.mols.slice(0, p.fuerzas.length > 1 ? 2 : 1).map(function (w) { return w.slice(0, 6); }).sort();
    var fz = p.fuerzas.slice().sort();
    return mols.join('+') + '|' + fz.join('+') + '|' + p.forma + cant;
  }
  function titulo(nombre) {
    var p = partes(nombre), tc = function (w) { return w.charAt(0) + w.slice(1).toLowerCase(); };
    var T = NN(nombre), fw = /CAPSULA|CAPS\b/.test(T) ? 'cápsulas' : /GRAGEA/.test(T) ? 'grageas' : /SOBRE/.test(T) ? 'sobres' : /OVULO/.test(T) ? 'óvulos' : 'tabletas';
    var cant = p.forma === 'S' ? (p.n ? p.n + ' ' + fw : '') : (p.ml ? p.ml + ' ml' : '');
    var fz = p.fuerzas.map(function (f) { return f.replace('MG', ' mg').replace('MCG', ' mcg').replace('UI', ' UI'); }).join(' / ');
    var mols = p.mols.slice(0, p.fuerzas.length > 1 ? 2 : 1).map(tc).join(' / ');
    return { mol: mols || nombre, pres: [fz, cant].filter(Boolean).join(' · ') };
  }
  /* ofertas [{st,p,nm,src,f,pr}] → grupos [{k,mol,pres,o:[...]}] */
  function agrupar(ofertas, previos) {
    var G = previos || {};
    ofertas.forEach(function (o) {
      if (!(o.p > 0) || !o.st || !o.nm) return;
      var k = clave(o.nm) || ('x:' + NN(o.nm).slice(0, 70));
      var g = G[k];
      if (!g) { var t = titulo(o.nm); g = G[k] = { k: k, mol: k.charAt(0) === 'x' ? o.nm : t.mol, pres: k.charAt(0) === 'x' ? '' : t.pres, o: [] }; }
      var dup = g.o.filter(function (x) { return x.st === o.st && NN(x.nm) === NN(o.nm) && x.src === o.src; })[0];
      if (dup) { if (o.p < dup.p) { dup.p = o.p; dup.pr = o.pr; dup.f = o.f; } return; }
      g.o.push(o);
    });
    return G;
  }
  /* fuentes en línea: url de búsqueda y lectura de la respuesta */
  var SP_API = 'https://api.coxdka37yz-unifarsad1-p2-public.model-t.cc.commerce.ondemand.com';
  var WEB = {
    similares: { url: function (q) { return 'https://www.farmaciasdesimilares.com/api/catalog_system/pub/products/search?ft=' + encodeURIComponent(q) + '&_from=0&_to=49'; },
      leer: function (j, f) { return (j || []).map(function (p) { var it = p.items && p.items[0], s = it && it.sellers && it.sellers[0], o = s && s.commertialOffer; if (!o) return null; var lp = o.ListPrice || o.Price, pr = o.Price && o.Price < lp ? o.Price : null; return { st: 'similares', p: lp, pr: pr, nm: p.productName, src: 'w', f: f, u: p.link }; }).filter(Boolean); } },
    ahorro: { url: function (q) { return 'https://www.fahorro.com/graphql?query=' + encodeURIComponent('{products(search:' + JSON.stringify(q) + ',pageSize:50){items{name url_key price_range{minimum_price{regular_price{value} final_price{value}}}}}}'); },
      leer: function (j, f) { var its = j && j.data && j.data.products && j.data.products.items || []; return its.map(function (p) { var m = p.price_range && p.price_range.minimum_price; if (!m) return null; var lp = m.regular_price.value, fp = m.final_price.value; return { st: 'ahorro', p: lp, pr: fp < lp ? fp : null, nm: p.name, src: 'w', f: f, u: 'https://www.fahorro.com/' + p.url_key + '.html' }; }).filter(Boolean); } },
    sanpablo: { url: function (q) { return SP_API + '/rest/v2/fsp/products/search?query=' + encodeURIComponent(q) + '&fields=FULL&pageSize=50'; },
      leer: function (j, f) { return (j && j.products || []).map(function (p) { if (!p.price) return null; var extra = String(p.additionalDescription || ''); if (p.brandName) extra = extra.split(p.brandName).join(' '); return { st: 'sanpablo', p: p.price.value, pr: null, nm: (p.name + ' ' + extra).replace(/\s+/g, ' ').trim(), marca: p.brandName || '', src: 'w', f: f, u: 'https://www.farmaciasanpablo.com.mx' + p.url }; }).filter(Boolean); } }
  };
  return { NN: NN, clave: clave, titulo: titulo, partes: partes, agrupar: agrupar, WEB: WEB };
})();
if (typeof module !== 'undefined') module.exports = FJ;
