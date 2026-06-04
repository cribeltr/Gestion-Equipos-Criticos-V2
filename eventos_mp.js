/* ============================================================================
 * eventos_mp.js — Lógica de "Generador de Eventos MP"
 *
 * Transforma la Programación de Mantenciones Preventivas (.xlsm, hojas
 * Carta Gantt + Registro) en una lista de eventos "una fila por evento".
 * Portado del archivo "Generador de Eventos MP" (SIGEM); para LEER el .xlsm
 * usa la librería global XLSX (SheetJS). La escritura del .xlsx la hace la
 * aplicación con su propio XLSXWriter (no requiere ExcelJS).
 * ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EventosMP = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var XLSXlib = (typeof window !== 'undefined' && window.XLSX) || (typeof XLSX !== 'undefined' ? XLSX : null);
  function X() { return (typeof window !== 'undefined' && window.XLSX) || XLSXlib; }

  // ---- Layout (índices base 0: A=0, B=1, …) ----
  var MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var EQUIP_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // B..N
  var GANTT_MONTH_COLS = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]; // T..AE
  var REG_RESULT_COLS = [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42];  // U,W,…,AQ
  var COL_ID = 1;  // B
  var COL_INV = 3; // D

  var VALID_TIPOS = { X: 1, R: 1, RA: 1, PM: 1 };
  var VALID_RES = { Si: 1, No: 1, Baja: 1, NU: 1, C1: 1, C2: 1, C3: 1, C4: 1, C5: 1, C6: 1, C7: 1, C8: 1 };
  var RESULTADO_PENDIENTE = 'Pendiente';

  var OUT_HEADERS = [
    'ID', 'N° Carpeta', 'N° Inventario', 'Equipo', 'Servicio', 'Unidad',
    'Ubicación', 'Procedencia', 'Marca', 'Modelo', 'Serie',
    'Año Instalación', 'Vida Útil Residual', 'Mes', 'Tipo', 'Resultado'
  ];
  var OUT_WIDTHS = [6, 9, 14, 26, 22, 22, 22, 13, 18, 22, 16, 9, 9, 6, 6, 10];
  var INT_OUT_COLS = { 0: 1, 1: 1, 11: 1, 12: 1 }; // ID, N° Carpeta, Año Inst., Vida Útil
  var TEXT_OUT_COL = 2;                            // N° Inventario -> texto

  // ---- Leyenda de códigos ----
  var LEYENDA = [
    ['Tipo de programación', ''],
    ['X', 'Mantención preventiva programada'],
    ['R', 'Mantención preventiva reprogramada'],
    ['RA', 'Mantención preventiva reprogramada (pendiente) del año anterior'],
    ['PM', 'Puesta en marcha del equipo médico crítico'],
    ['', ''],
    ['Resultado', ''],
    ['Si', 'Mantención realizada'],
    ['No', 'Mantención no realizada'],
    ['Baja', 'Equipo dado de baja'],
    ['NU', 'Sigla sin definición en la leyenda del archivo original'],
    ['Pendiente', 'Sin resultado registrado (ej. mes aún por ejecutar)'],
    ['C1 a C8', 'Mantención reprogramada por causa (ver detalle)'],
    ['', ''],
    ['Causas de reprogramación', ''],
    ['C1', 'Imposibilidad de desocupar el equipo del paciente por indicación clínica'],
    ['C2', 'Equipo se encuentra en servicio técnico'],
    ['C3', 'Equipo no operativo a la espera de repuesto o accesorios'],
    ['C4', 'Equipo no ubicado'],
    ['C5', 'No disponibilidad de horas hombre del funcionario de la SEC por alta carga laboral'],
    ['C6', 'No disponibilidad de horas hombre del servicio técnico externo'],
    ['C7', 'No disponibilidad de técnico del hospital por ausencia justificada >15 días o vacaciones'],
    ['C8', 'Contingencia hospitalaria']
  ];

  // ---- Lectura de celdas ----
  function getCell(ws, r, c) {
    var addr = X().utils.encode_cell({ r: r, c: c });
    var cell = ws[addr];
    return cell ? cell.v : undefined;
  }
  function detectYear(name) { var m = String(name).match(/(20\d{2})/); return m ? m[1] : null; }
  function findHeaderRow(ws) {
    for (var r = 0; r < 20; r++) {
      var v = getCell(ws, r, COL_ID);
      if (v !== undefined && v !== null && String(v).trim().toUpperCase() === 'ID') return r;
    }
    return 6;
  }
  function equipmentRows(ws, headerRow) {
    var rows = [];
    var range = X().utils.decode_range(ws['!ref']);
    for (var r = headerRow + 1; r <= range.e.r; r++) {
      var v = getCell(ws, r, COL_ID);
      if (v !== undefined && v !== null && String(v).trim() !== '') rows.push(r);
    }
    return rows;
  }

  // ---- Normalizaciones ----
  function normTipo(v) {
    if (v === undefined || v === null) return null;
    var s = String(v).replace(/\s+/g, '').toUpperCase();
    return VALID_TIPOS[s] ? s : null;
  }
  function normRes(v) {
    if (v === undefined || v === null) return null;
    var s = String(v).replace(/\s+/g, '');
    if (s === '') return null;
    var up = s.toUpperCase();
    if (up === 'SI') return 'Si';
    if (up === 'NO') return 'No';
    if (up === 'BAJA') return 'Baja';
    if (up === 'NU') return 'NU';
    if (/^C[1-8]$/.test(up)) return up;
    return null;
  }
  function asIntOrText(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return Math.trunc(v) === v ? Math.trunc(v) : v;
    var s = String(v).trim();
    if (s === '') return null;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    return s;
  }
  function invText(v) { return (v === undefined || v === null) ? '' : String(v).trim(); }
  function plain(v) { return (v === undefined || v === null) ? '' : String(v).trim(); }

  // ---- Emparejamiento Gantt <-> Registro: ID, luego N° Inventario, luego posición ----
  function buildMatcher(reg, regRows) {
    var byId = {};
    for (var i = 0; i < regRows.length; i++) {
      var rr = regRows[i];
      var id = plain(getCell(reg, rr, COL_ID));
      (byId[id] = byId[id] || []).push(rr);
    }
    return function (gid, ginv, gpos) {
      var id = plain(gid);
      var cands = byId[id] || [];
      if (cands.length === 1) return cands[0];
      if (cands.length > 1) {
        var inv = plain(ginv); var hit = [];
        for (var k = 0; k < cands.length; k++) {
          if (inv && plain(getCell(reg, cands[k], COL_INV)) === inv) hit.push(cands[k]);
        }
        if (hit.length === 1) return hit[0];
      }
      if (gpos >= 0 && gpos < regRows.length) return regRows[gpos];
      return null;
    };
  }

  // ---- Transformación principal ----
  function transform(wb) {
    if (!wb || !wb.SheetNames || wb.SheetNames.length < 2) {
      throw new Error('El libro debe tener al menos dos hojas (Carta Gantt y Registro).');
    }
    var gantt = wb.Sheets[wb.SheetNames[0]];
    var reg = wb.Sheets[wb.SheetNames[1]];
    var year = detectYear(wb.SheetNames[0]) || detectYear(wb.SheetNames[1]) || '';

    var gRows = equipmentRows(gantt, findHeaderRow(gantt));
    var rRows = equipmentRows(reg, findHeaderRow(reg));
    var match = buildMatcher(reg, rRows);

    var events = [], byTipo = {}, byRes = {}, bajaIncluidas = 0, bajaFuera = [];

    for (var gpos = 0; gpos < gRows.length; gpos++) {
      var gr = gRows[gpos];
      var gid = getCell(gantt, gr, COL_ID);
      var ginv = getCell(gantt, gr, COL_INV);
      var rr = match(gid, ginv, gpos);

      var equip = [];
      for (var ci = 0; ci < EQUIP_COLS.length; ci++) {
        var col = EQUIP_COLS[ci];
        var raw = getCell(gantt, gr, col);
        if (col === COL_INV) equip.push(invText(raw));
        else if (col === 1 || col === 2 || col === 12 || col === 13) equip.push(asIntOrText(raw));
        else equip.push(plain(raw));
      }

      for (var mi = 0; mi < 12; mi++) {
        var tipo = normTipo(getCell(gantt, gr, GANTT_MONTH_COLS[mi]));
        var resNorm = null;
        if (rr !== null && rr !== undefined) resNorm = normRes(getCell(reg, rr, REG_RESULT_COLS[mi]));
        if (resNorm === 'Baja') {
          if (tipo !== null) bajaIncluidas++;
          else bajaFuera.push([plain(gid), MESES[mi]]);
        }
        if (tipo === null) continue;
        var resultado = VALID_RES[resNorm] ? resNorm : RESULTADO_PENDIENTE;
        events.push(equip.concat([MESES[mi], tipo, resultado]));
        byTipo[tipo] = (byTipo[tipo] || 0) + 1;
        byRes[resultado] = (byRes[resultado] || 0) + 1;
      }
    }

    return {
      events: events,
      stats: {
        year: year, total: events.length, byTipo: byTipo, byRes: byRes,
        bajaIncluidas: bajaIncluidas, bajaFuera: bajaFuera, nGantt: gRows.length, nReg: rRows.length
      }
    };
  }

  // ---- Extrae los datos de TODOS los equipos del Gantt (para actualizar el inventario) ----
  var EQUIP_KEYS = ['id', 'carpeta', 'inventario', 'equipo', 'servicio', 'unidad', 'ubicacion', 'procedencia', 'marca', 'modelo', 'serie', 'anio', 'vida_util'];
  function extractEquipos(wb) {
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) return [];
    var gantt = wb.Sheets[wb.SheetNames[0]];
    var gRows = equipmentRows(gantt, findHeaderRow(gantt));
    var out = [];
    gRows.forEach(function (gr) {
      var rec = {};
      for (var ci = 0; ci < EQUIP_COLS.length; ci++) {
        var col = EQUIP_COLS[ci], raw = getCell(gantt, gr, col), val;
        if (col === COL_INV) val = invText(raw);
        else if (col === 1 || col === 2 || col === 12 || col === 13) { var n = asIntOrText(raw); val = (n == null ? '' : String(n)); }
        else val = plain(raw);
        rec[EQUIP_KEYS[ci]] = val;
      }
      if (rec.id || rec.inventario) out.push(rec);
    });
    return out;
  }

  // ---- Apoyos para la integración en la app ----
  function mesANumero(mes) {
    var i = MESES.indexOf(mes);
    return i >= 0 ? (i + 1) : 0;
  }
  // Estado físico que implica un evento MP según su resultado (null = no lo define).
  function estadoFromResultado(res) {
    if (res === 'Si') return 'Operativo';           // mantención realizada
    if (res === 'Baja') return 'No operativo';       // equipo dado de baja
    if (res === 'C2') return 'Servicio técnico';     // en servicio técnico
    if (res === 'C3') return 'No operativo';         // no operativo a la espera de repuesto
    return null;
  }

  return {
    transform: transform,
    extractEquipos: extractEquipos,
    OUT_HEADERS: OUT_HEADERS,
    OUT_WIDTHS: OUT_WIDTHS,
    INT_OUT_COLS: INT_OUT_COLS,
    TEXT_OUT_COL: TEXT_OUT_COL,
    MESES: MESES,
    LEYENDA: LEYENDA,
    mesANumero: mesANumero,
    estadoFromResultado: estadoFromResultado
  };
});
