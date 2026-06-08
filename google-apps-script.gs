/** Gestión de Equipos Críticos — puente con Google Sheets.
 *
 *  CONFIGURACIÓN (una sola vez):
 *  1) Crea/abre una Google Sheet.
 *  2) Extensiones → Apps Script. Borra lo que haya y pega TODO este archivo. Guarda.
 *  3) Implementar → Nueva implementación → (engranaje) «App web».
 *       - Ejecutar como: Yo
 *       - Con acceso:    Cualquiera
 *     Implementar y autoriza los permisos.
 *  4) Copia la URL que termina en /exec y pégala en la app
 *     (Configuración → Guardar en Google Sheets → Guardar URL).
 *
 *  La hoja «_gec_datos» guarda el estado exacto de la app (para volver a cargarlo);
 *  las hojas «Registros» e «Inventario» son la vista legible de los datos.
 *  No requiere claves: el App web se ejecuta con tu propia cuenta.
 */
var DATOS_TAB = '_gec_datos';
var CHUNK = 45000; // máx. ~50.000 caracteres por celda

function doGet(e) {
  var p = (e && e.parameter) || {}, cb = p.callback || '', out;
  try {
    if (p.action === 'ping') out = { ok: true, updated: prop_('updated'), registros: Number(prop_('rows') || 0) };
    else out = { ok: true, datos: leerDatos_(), comprimido: (prop_('comp') !== 'no'), updated: prop_('updated') };
  } catch (err) { out = { ok: false, error: String(err) }; }
  return responder_(out, cb);
}

function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e.postData.contents);
    guardarDatos_(String(body.datos || ''));
    prop_('comp', body.comprimido ? 'si' : 'no');
    var nreg = 0;
    if (body.hojas) body.hojas.forEach(function (h) { if (h && h.nombre) { escribirHoja_(h.nombre, h.filas); if (h.nombre === 'Registros') nreg = Math.max(0, (h.filas || []).length - 1); } });
    if (body.registros) escribirHoja_('Registros', body.registros);
    if (body.inventario) escribirHoja_('Inventario', body.inventario);
    prop_('updated', new Date().toISOString());
    prop_('rows', String(nreg || (body.registros ? Math.max(0, body.registros.length - 1) : 0)));
    out = { ok: true, updated: prop_('updated') };
  } catch (err) { out = { ok: false, error: String(err) }; }
  return responder_(out, '');
}

function responder_(obj, cb) {
  var js = JSON.stringify(obj);
  if (cb) return ContentService.createTextOutput(cb + '(' + js + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(js).setMimeType(ContentService.MimeType.JSON);
}
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function prop_(k, v) { var ps = PropertiesService.getDocumentProperties(); if (v === undefined) return ps.getProperty(k); ps.setProperty(k, v); return v; }
function tab_(name) { var ss = ss_(); return ss.getSheetByName(name) || ss.insertSheet(name); }
function guardarDatos_(s) {
  var sh = tab_(DATOS_TAB); sh.clear();
  var rows = [], i = 0;
  while (i < s.length) { rows.push([s.substr(i, CHUNK)]); i += CHUNK; }
  if (!rows.length) rows = [['']];
  sh.getRange(1, 1, rows.length, 1).setNumberFormat('@').setValues(rows);
  try { sh.hideSheet(); } catch (e) {} // hoja de sistema: oculta
}
function leerDatos_() {
  var sh = ss_().getSheetByName(DATOS_TAB); if (!sh) return '';
  var last = sh.getLastRow(); if (!last) return '';
  return sh.getRange(1, 1, last, 1).getValues().map(function (r) { return r[0]; }).join('');
}
function escribirHoja_(name, filas) {
  var sh = tab_(name); sh.clear();
  if (!filas || !filas.length) return;
  var n = filas[0].length;
  filas = filas.map(function (r) { r = r.slice(0, n); while (r.length < n) r.push(''); return r; });
  var rng = sh.getRange(1, 1, filas.length, n);
  rng.setNumberFormat('@'); // texto: las fechas (AAAA-MM-DD) y series se ven tal cual, sin convertirse
  rng.setValues(filas);
}
