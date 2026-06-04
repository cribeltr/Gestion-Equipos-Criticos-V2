/* ============================================================================
 * Gestión de Equipos en Servicio Técnico
 * Aplicación de registro por etapas con persistencia local (localStorage)
 * y exportación a Excel (.xlsx).
 *
 * Cada etapa del proceso se registra como un registro independiente: se crea
 * por sí solo, sin obligar a seguir la secuencia. El folio de la solicitud de
 * trabajo se ingresa manualmente; en todos los casos los técnicos se eligen
 * desde una lista desplegable.
 * ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Constantes
  var STORAGE_KEY = 'gec_v1';

  var TECNICOS_DEFAULT = [
    'Carlos Bahamondes Seguel',
    'Cristián Beltrán Oviedo',
    'Cristina Rozas Urrutia',
    'Daniel Díaz Neira',
    'Ignacio Berner Bergara',
    'Macarena Toledo',
    'Marco Ulloa',
    'Matías Soazo Garrido',
    'Ricardo Matus Aroca',
    'Tito Millapán Riquelme'
  ];
  var SUPERVISOR = 'Cristián Beltrán Oviedo';
  var EMPRESAS_DEFAULT = [];

  // Definición de las etapas (esquema que dirige formularios, tablas y export).
  // tipos de campo: folio_manual | folio_ref | fecha | tecnico | empresa |
  //                 select | equipo | text | numero | textarea
  var ETAPAS = [
    {
      id: 'solicitud', nombre: 'Solicitud de trabajo', icono: '📝',
      grupo: 'Solicitud', via: 'Inicio',
      desc: 'Etapa común de inicio. El folio se ingresa manualmente. Luego el flujo se deriva a la Vía A o a la Vía B.',
      campos: [
        { key: 'folio', label: 'Folio (manual)', tipo: 'folio_manual', req: true, ancho: 14, hint: 'Identificador de la solicitud. Se ingresa manualmente.' },
        { key: 'fecha', label: 'Fecha de solicitud', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'tecnico', label: 'Técnico asignado', tipo: 'tecnico', req: true, ancho: 24 },
        { key: 'via', label: 'Vía', tipo: 'select', opciones: ['Vía A — Servicio técnico', 'Vía B — Visita técnica / diagnóstico'], ancho: 26 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'envio', nombre: 'Envío a servicio técnico', icono: '📤',
      grupo: 'Vía A · Servicio técnico', via: 'Vía A',
      desc: 'Vía A · 6.1 — Salida del equipo a la empresa de servicio técnico. Se cursa sobre solicitudes vigentes / no cerradas.',
      campos: [
        { key: 'folio', label: 'Solicitud de trabajo (folio)', tipo: 'folio_ref', ancho: 14, hint: 'Folio de la solicitud asociada (preferentemente vigente / no cerrada).' },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'fecha', label: 'Fecha del envío', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'numero_envio', label: 'Número de envío', tipo: 'text', ancho: 16 },
        { key: 'tecnico', label: 'Técnico asignado', tipo: 'tecnico', req: true, ancho: 24 },
        { key: 'empresa', label: 'Empresa de servicio técnico', tipo: 'empresa', ancho: 24 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'estado_st', nombre: 'Estado en servicio técnico', icono: '🛠️',
      grupo: 'Vía A · Servicio técnico', via: 'Vía A',
      desc: 'Vía A · 6.2 — Seguimiento intermedio mientras el equipo permanece en el taller.',
      campos: [
        { key: 'folio', label: 'Solicitud de trabajo (folio)', tipo: 'folio_ref', ancho: 14 },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'fecha', label: 'Fecha de actualización', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'estado', label: 'Estado', tipo: 'select', req: true, opciones: ['En diagnóstico', 'En reparación', 'Reparado', 'Sin solución'], ancho: 18 },
        { key: 'tecnico', label: 'Técnico', tipo: 'tecnico', ancho: 24 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'recepcion', nombre: 'Recepción del equipo', icono: '📥',
      grupo: 'Vía A · Servicio técnico', via: 'Vía A',
      desc: 'Vía A · 6.3 — Ingreso del equipo de vuelta y registro de su estado. Exclusiva de la Vía A.',
      campos: [
        { key: 'folio', label: 'Solicitud de trabajo (folio)', tipo: 'folio_ref', ancho: 14 },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'fecha', label: 'Fecha de recepción', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'numero_guia', label: 'N° de guía de despacho', tipo: 'text', ancho: 18 },
        { key: 'tecnico', label: 'Técnico (recibe)', tipo: 'tecnico', ancho: 24 },
        { key: 'estado_equipo', label: 'Estado del equipo', tipo: 'select', opciones: ['Operativo', 'No operativo'], ancho: 16 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'diagnostico', nombre: 'Visita técnica / diagnóstico', icono: '🔍',
      grupo: 'Vía B · En sitio', via: 'Vía B',
      desc: 'Vía B — El equipo permanece en sitio. No hay envío ni recepción. Se registra el estado resultante del diagnóstico.',
      campos: [
        { key: 'folio', label: 'Solicitud de trabajo (folio)', tipo: 'folio_ref', ancho: 14 },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'fecha', label: 'Fecha de diagnóstico', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'tecnico', label: 'Técnico', tipo: 'tecnico', req: true, ancho: 24 },
        { key: 'estado_equipo', label: 'Estado del equipo', tipo: 'select', opciones: ['No operativo', 'Operativo'], def: 'No operativo', ancho: 16 },
        { key: 'observaciones', label: 'Resultado / observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'cotizacion', nombre: 'Solicitud de cotización', icono: '💬',
      grupo: 'Subflujo comercial', via: 'Comercial',
      desc: 'Subflujo comercial · 8.1 — Opcional. Solo cuando la reparación requiere adquisición de bienes o servicios.',
      campos: [
        { key: 'folio', label: 'Solicitud de trabajo (folio)', tipo: 'folio_ref', ancho: 14 },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'fecha', label: 'Fecha de cotización', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'numero_cotizacion', label: 'N° de cotización', tipo: 'text', ancho: 16 },
        { key: 'empresa', label: 'Empresa (proveedor)', tipo: 'empresa', ancho: 24 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'gestion_oc', nombre: 'Gestión de orden de compra', icono: '📑',
      grupo: 'Subflujo comercial', via: 'Comercial',
      desc: 'Subflujo comercial · 8.2 — Dos caminos excluyentes: Trato directo (informe) o Compra ágil.',
      campos: [
        { key: 'folio', label: 'Solicitud de trabajo (folio)', tipo: 'folio_ref', ancho: 14 },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'tipo_compra', label: 'Tipo de compra', tipo: 'select', req: true, opciones: ['Trato directo', 'Compra ágil'], ancho: 16 },
        { key: 'fecha', label: 'Fecha (informe / compra)', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'numero_informe', label: 'N° de informe (trato directo)', tipo: 'text', ancho: 20, hint: 'Solo aplica en Trato directo.' },
        { key: 'tecnico', label: 'Técnico', tipo: 'tecnico', ancho: 24 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'emision_oc', nombre: 'Emisión de orden de compra', icono: '🧾',
      grupo: 'Subflujo comercial', via: 'Comercial',
      desc: 'Subflujo comercial · 8.3 — Se emite tras la aprobación del presupuesto.',
      campos: [
        { key: 'folio', label: 'Solicitud de trabajo (folio)', tipo: 'folio_ref', ancho: 14 },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'fecha', label: 'Fecha de OC', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'numero_oc', label: 'N° de OC', tipo: 'text', ancho: 16 },
        { key: 'tecnico', label: 'Técnico', tipo: 'tecnico', ancho: 24 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'reparacion', nombre: 'Reparación del equipo', icono: '🔧',
      grupo: 'Cierre del ciclo', via: 'Común',
      desc: 'Sección 9 — Intervención sobre el equipo, común a ambas vías.',
      campos: [
        { key: 'folio', label: 'Solicitud de trabajo (folio)', tipo: 'folio_ref', ancho: 14 },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'fecha', label: 'Fecha de reparación', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'tecnico', label: 'Técnico', tipo: 'tecnico', req: true, ancho: 24 },
        { key: 'resultado', label: 'Resultado', tipo: 'select', req: true, opciones: ['Operativo', 'No operativo'], ancho: 16 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'cierre', nombre: 'Cierre del ciclo', icono: '✅',
      grupo: 'Cierre del ciclo', via: 'Cierre',
      desc: 'Sección 10 — El equipo queda Operativo y la solicitud se marca como cerrada.',
      campos: [
        { key: 'folio', label: 'Solicitud de trabajo (folio)', tipo: 'folio_ref', ancho: 14 },
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'fecha', label: 'Fecha de cierre', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'estado_final', label: 'Estado final', tipo: 'select', opciones: ['Operativo', 'No operativo'], def: 'Operativo', ancho: 16 },
        { key: 'tecnico', label: 'Técnico', tipo: 'tecnico', ancho: 24 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'mp', nombre: 'Mantención preventiva', icono: '🧰',
      grupo: 'Mantención preventiva', via: 'Preventiva',
      desc: 'Eventos de mantenimiento preventivo, importados desde la Programación MP (.xlsm) o creados manualmente.',
      campos: [
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'fecha', label: 'Fecha', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'anio', label: 'Año', tipo: 'text', ancho: 8 },
        { key: 'mes', label: 'Mes', tipo: 'select', opciones: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], ancho: 8 },
        { key: 'tipo', label: 'Tipo', tipo: 'select', opciones: ['X', 'R', 'RA', 'PM'], ancho: 8, hint: 'X programada · R reprogramada · RA año anterior · PM puesta en marcha' },
        { key: 'resultado', label: 'Resultado', tipo: 'select', opciones: ['Si', 'No', 'Baja', 'NU', 'Pendiente', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'], ancho: 12 },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'pendiente', nombre: 'Pendiente', icono: '⚠️',
      grupo: 'Gestión', via: 'Pendiente',
      desc: 'Asunto pendiente asociado a un equipo, con seguimiento (estado, tareas y actualizaciones).',
      campos: [
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'tipo', label: 'Tipo de pendiente', tipo: 'select', req: true, opciones: ['Otro', 'Pauta de monitoreo', 'Firma', 'Reporte Interno', 'Reporte Externo'], ancho: 20 },
        { key: 'fecha', label: 'Fecha', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'estado_pendiente', label: 'Estado', tipo: 'select', opciones: ['Pendiente', 'En proceso', 'Resuelto'], def: 'Pendiente', ancho: 14 },
        { key: 'tecnico', label: 'Responsable', tipo: 'tecnico', ancho: 24 },
        { key: 'fecha_resolucion', label: 'Fecha de resolución', tipo: 'fecha', ancho: 16 },
        { key: 'observaciones', label: 'Descripción', tipo: 'textarea', col: 'full', ancho: 44 }
      ]
    }
  ];

  var ETAPAS_BY_ID = {};
  ETAPAS.forEach(function (e, i) { e._orden = i; ETAPAS_BY_ID[e.id] = e; });

  var GRUPOS_NAV = [
    { label: 'Inicio', items: ['__dashboard', '__inventario'] },
    { label: 'Estado de equipos', items: ['__est_st', '__est_operativo', '__est_no_operativo', '__pendientes', '__est_desconocido'] },
    { label: 'Solicitud', items: ['solicitud'] },
    { label: 'Vía A · Servicio técnico', items: ['envio', 'estado_st', 'recepcion'] },
    { label: 'Vía B · En sitio', items: ['diagnostico'] },
    { label: 'Subflujo comercial', items: ['cotizacion', 'gestion_oc', 'emision_oc'] },
    { label: 'Cierre del ciclo', items: ['reparacion', 'cierre'] },
    { label: 'Mantención preventiva', items: ['__mp_import', 'mp'] },
    { label: 'Gestión', items: ['__todos', '__config'] }
  ];

  // Vistas del tablero de estado: cada una filtra el inventario al estado dado.
  var ESTADO_VIEWS = {
    '__est_st': 'Servicio técnico',
    '__est_operativo': 'Operativo',
    '__est_no_operativo': 'No operativo',
    '__est_desconocido': 'Desconocido'
  };

  var EQUIPOS_BASE = window.EQUIPOS || [];

  // ----------------------------------------------------------------- Estado/DB
  var DB = cargarDB();
  var STATE = { view: '__dashboard', editId: null, prefill: null };
  var MP_STATE = { events: null, year: '', equipos: null, stats: null }; // último .xlsm procesado

  function cargarDB() {
    var db = null;
    try { db = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { db = null; }
    if (!db || typeof db !== 'object') db = {};
    if (!db.registros) db.registros = {};
    if (!db.config) db.config = {};
    if (!db.equiposOverrides || typeof db.equiposOverrides !== 'object') db.equiposOverrides = {};
    if (!Array.isArray(db.config.tecnicos) || !db.config.tecnicos.length) db.config.tecnicos = TECNICOS_DEFAULT.slice();
    if (!Array.isArray(db.config.empresas)) db.config.empresas = EMPRESAS_DEFAULT.slice();
    ETAPAS.forEach(function (e) { if (!Array.isArray(db.registros[e.id])) db.registros[e.id] = []; });
    return db;
  }
  function guardarDB() { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); }

  // ---- Inventario mutable: lista base + overrides (editable / actualizable por .xlsm) ----
  var _equiposCache = null;
  function getEquipos() {
    if (_equiposCache) return _equiposCache;
    var ov = DB.equiposOverrides || {};
    var byId = {}, orden = [];
    EQUIPOS_BASE.forEach(function (e) { byId[e.id] = e; orden.push(e.id); });
    Object.keys(ov).forEach(function (id) {
      if (byId[id]) { var m = {}; for (var k in byId[id]) m[k] = byId[id][k]; for (var k2 in ov[id]) m[k2] = ov[id][k2]; byId[id] = m; }
      else { byId[id] = ov[id]; orden.push(id); }
    });
    _equiposCache = orden.map(function (id) { return byId[id]; });
    return _equiposCache;
  }
  function invalidarEquipos() { _equiposCache = null; }

  // Actualiza/inserta equipos del inventario a partir de filas extraídas del .xlsm.
  function actualizarEquipos(filas) {
    var ov = DB.equiposOverrides = DB.equiposOverrides || {};
    var baseById = {}; EQUIPOS_BASE.forEach(function (e) { baseById[e.id] = e; });
    var nuevos = 0, actualizados = 0;
    filas.forEach(function (f) {
      var id = String(f.id == null ? '' : f.id).trim();
      if (!id) return;
      var prev = ov[id] || {};
      var merged = {}; for (var k in prev) merged[k] = prev[k];
      Object.keys(f).forEach(function (k) { if (f[k] !== '' && f[k] != null) merged[k] = f[k]; });
      ov[id] = merged;
      if (baseById[id]) actualizados++; else nuevos++;
    });
    invalidarEquipos();
    return { nuevos: nuevos, actualizados: actualizados };
  }

  // ------------------------------------------------------------------- Helpers
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null) continue;
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
      });
    }
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function hoyISO() {
    var d = new Date(), z = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function cmpNat(a, b) {
    return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'es', { numeric: true, sensitivity: 'base' });
  }
  function fmtFechaHora(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    var z = function (n) { return String(n).padStart(2, '0'); };
    return z(d.getDate()) + '-' + z(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function fmtFecha(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    return p.length === 3 ? (p[2] + '-' + p[1] + '-' + p[0]) : iso;
  }
  function equipoCorto(eq) {
    if (!eq) return '';
    return (eq.inv || '(s/inv)') + ' — ' + (eq.nombre || '');
  }

  // -------------------------------------------------------------- Búsqueda eq.
  function buscarEquipos(q, limite) {
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    var out = [];
    var EQ = getEquipos();
    for (var i = 0; i < EQ.length; i++) {
      var e = EQ[i];
      var hay = ((e.inventario || '') + ' ' + (e.equipo || '') + ' ' + (e.serie || '') + ' ' +
        (e.marca || '') + ' ' + (e.modelo || '') + ' ' + (e.servicio || '') + ' ' +
        (e.unidad || '') + ' ' + (e.ubicacion || '')).toLowerCase();
      var ok = true;
      for (var t = 0; t < tokens.length; t++) { if (hay.indexOf(tokens[t]) < 0) { ok = false; break; } }
      if (ok) { out.push(e); if (out.length >= limite) break; }
    }
    return out;
  }

  // ------------------------------------------------------------------- Toasts
  function toast(msg, tipo) {
    var cont = document.getElementById('toasts');
    var t = el('div', { class: 'toast ' + (tipo || '') }, msg);
    cont.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  // ------------------------------------------------------------- Selector eq.
  // Combobox accesible: búsqueda con teclado (flechas + Enter + Esc) y ARIA.
  function buildEquipoPicker(inicial, onChange) {
    var wrap = el('div', { class: 'equipo-pick' });
    var listId = 'eqlist-' + uid();
    var input = el('input', {
      type: 'text', autocomplete: 'off', placeholder: 'Buscar por inventario, equipo, serie, marca, servicio…',
      role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list', 'aria-controls': listId, 'aria-label': 'Buscar equipo en el listado crítico'
    });
    var results = el('div', { class: 'equipo-results', id: listId, role: 'listbox' });
    var chip = el('div', { class: 'equipo-chip' });
    var selected = inicial || null;
    var items = [], matches = [], hl = -1;

    function onDocClick(e) { if (!wrap.contains(e.target)) cerrar(); }
    function cerrar() {
      results.classList.remove('show');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      document.removeEventListener('click', onDocClick, true);
      hl = -1;
    }
    function abrir() {
      results.classList.add('show');
      input.setAttribute('aria-expanded', 'true');
      document.addEventListener('click', onDocClick, true);
    }
    function setHl(i) {
      if (!items.length) return;
      if (i < 0) i = items.length - 1; else if (i >= items.length) i = 0;
      if (hl >= 0 && items[hl]) { items[hl].classList.remove('hl'); items[hl].setAttribute('aria-selected', 'false'); }
      hl = i;
      items[hl].classList.add('hl');
      items[hl].setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', items[hl].id);
      items[hl].scrollIntoView({ block: 'nearest' });
    }
    function elegir(m) {
      selected = { inv: m.inventario, nombre: m.equipo, servicio: m.servicio, serie: m.serie, marca: m.marca, modelo: m.modelo, unidad: m.unidad, ubicacion: m.ubicacion };
      input.value = ''; cerrar(); pintarChip();
      if (onChange) onChange(selected);
    }

    function pintarChip() {
      if (selected) {
        chip.innerHTML = '<span class="x" title="Quitar" role="button" tabindex="0" aria-label="Quitar equipo seleccionado">✕</span><strong>' + esc(selected.inv || '(sin inventario)') + '</strong> — ' +
          esc(selected.nombre || '') + ' <span style="color:#6b7780">· ' + esc(selected.servicio || '') +
          (selected.serie ? (' · Serie ' + esc(selected.serie)) : '') +
          (selected.ubicacion ? (' · ' + esc(selected.ubicacion)) : '') + '</span>';
        chip.classList.add('show');
        input.style.display = 'none';
        var quitar = function () { selected = null; pintarChip(); input.focus(); if (onChange) onChange(selected); };
        var x = chip.querySelector('.x');
        x.onclick = quitar;
        x.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); quitar(); } };
      } else {
        chip.classList.remove('show');
        input.style.display = '';
      }
    }
    function buscar() {
      var q = input.value.trim();
      results.innerHTML = ''; items = []; matches = []; hl = -1;
      if (!q) { cerrar(); return; }
      matches = buscarEquipos(q, 40);
      if (!matches.length) {
        results.innerHTML = '<div class="empty">Sin coincidencias en el listado crítico</div>';
        abrir(); return;
      }
      matches.forEach(function (m, i) {
        var it = el('div', { class: 'item', id: listId + '-o' + i, role: 'option', 'aria-selected': 'false' });
        it.innerHTML = '<div class="t">' + esc(m.inventario || '(sin inventario)') + ' — ' + esc(m.equipo) + '</div>' +
          '<div class="m">' + esc(m.servicio || '') + ' · ' + esc([m.marca, m.modelo].filter(Boolean).join(' ')) +
          (m.serie ? (' · Serie ' + esc(m.serie)) : '') + (m.ubicacion ? (' · ' + esc(m.ubicacion)) : '') + '</div>';
        it.onclick = function () { elegir(m); };
        it.addEventListener('mousemove', function () { setHl(i); });
        results.appendChild(it); items.push(it);
      });
      abrir();
    }

    input.addEventListener('input', buscar);
    input.addEventListener('keydown', function (e) {
      if (!results.classList.contains('show')) { if (e.key === 'ArrowDown') buscar(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHl(hl + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHl(hl - 1); }
      else if (e.key === 'Enter') { if (hl >= 0 && matches[hl]) { e.preventDefault(); elegir(matches[hl]); } }
      else if (e.key === 'Escape') { cerrar(); }
    });

    wrap.appendChild(input); wrap.appendChild(results); wrap.appendChild(chip);
    pintarChip();
    return { wrap: wrap, get: function () { return selected; } };
  }

  // ----------------------------------------------------------- Form genérico
  function buildForm(etapa, record) {
    var grid = el('div', { class: 'form-grid' });
    var controls = {};

    // Datalist de folios propio del formulario: se filtra al equipo elegido.
    var folioDLId = 'dl-folios-' + uid();
    var folioDL = el('datalist', { id: folioDLId });
    var ctx = { equipoGet: null };
    function actualizarFoliosForm() {
      folioDL.innerHTML = '';
      var sel = ctx.equipoGet ? ctx.equipoGet() : null;
      var folios = (sel && sel.inv) ? foliosDeEquipo(sel.inv) : folioList();
      folios.forEach(function (f) { folioDL.appendChild(el('option', { value: f })); });
    }

    etapa.campos.forEach(function (campo) {
      var clazz = 'field' + (campo.col === 'full' ? ' col-full' : (campo.col === '2' ? ' col-2' : ''));
      var field = el('div', { class: clazz });
      var lbl = el('label', {}, campo.label + ' ');
      if (campo.req) lbl.appendChild(el('span', { class: 'req' }, '*'));
      field.appendChild(lbl);

      var ctrl;
      if (campo.tipo === 'equipo') {
        var picker = buildEquipoPicker(record ? record[campo.key] : null, function () { actualizarFoliosForm(); });
        ctx.equipoGet = function () { return picker.get(); };
        field.appendChild(picker.wrap);
        controls[campo.key] = { get: function () { return picker.get(); } };
      } else if (campo.tipo === 'tecnico') {
        ctrl = el('select');
        ctrl.appendChild(el('option', { value: '' }, '— Seleccionar técnico —'));
        DB.config.tecnicos.forEach(function (t) { ctrl.appendChild(el('option', { value: t }, t)); });
        if (record && record[campo.key]) {
          if (DB.config.tecnicos.indexOf(record[campo.key]) < 0) ctrl.appendChild(el('option', { value: record[campo.key] }, record[campo.key]));
          ctrl.value = record[campo.key];
        }
        field.appendChild(ctrl);
        controls[campo.key] = { get: function () { return ctrl.value; } };
      } else if (campo.tipo === 'select') {
        ctrl = el('select');
        if (!campo.req) ctrl.appendChild(el('option', { value: '' }, '—'));
        campo.opciones.forEach(function (o) { ctrl.appendChild(el('option', { value: o }, o)); });
        var sv = record ? record[campo.key] : campo.def;
        if (sv != null && sv !== '') ctrl.value = sv;
        field.appendChild(ctrl);
        controls[campo.key] = { get: function () { return ctrl.value; } };
      } else if (campo.tipo === 'empresa') {
        ctrl = el('input', { type: 'text', list: 'dl-empresas', placeholder: 'Nombre de la empresa…' });
        if (record && record[campo.key]) ctrl.value = record[campo.key];
        field.appendChild(ctrl);
        controls[campo.key] = { get: function () { return ctrl.value.trim(); } };
      } else if (campo.tipo === 'folio_ref') {
        ctrl = el('input', { type: 'text', list: folioDLId, placeholder: 'Folio… (sugerencias según el equipo elegido)', autocomplete: 'off' });
        if (record && record[campo.key]) ctrl.value = record[campo.key];
        field.appendChild(ctrl);
        controls[campo.key] = { get: function () { return ctrl.value.trim(); } };
      } else if (campo.tipo === 'folio_manual') {
        ctrl = el('input', { type: 'text', placeholder: 'Ingrese el folio manualmente…' });
        if (record && record[campo.key]) ctrl.value = record[campo.key];
        field.appendChild(ctrl);
        controls[campo.key] = { get: function () { return ctrl.value.trim(); } };
      } else if (campo.tipo === 'fecha') {
        ctrl = el('input', { type: 'date' });
        ctrl.value = record ? (record[campo.key] || '') : hoyISO();
        field.appendChild(ctrl);
        controls[campo.key] = { get: function () { return ctrl.value; } };
      } else if (campo.tipo === 'textarea') {
        ctrl = el('textarea', { rows: '2', placeholder: 'Comentarios relevantes…' });
        if (record && record[campo.key]) ctrl.value = record[campo.key];
        field.appendChild(ctrl);
        controls[campo.key] = { get: function () { return ctrl.value.trim(); } };
      } else {
        ctrl = el('input', { type: campo.tipo === 'numero' ? 'number' : 'text' });
        if (record && record[campo.key] != null) ctrl.value = record[campo.key];
        field.appendChild(ctrl);
        controls[campo.key] = { get: function () { return ctrl.value.trim(); } };
      }
      if (campo.hint) field.appendChild(el('div', { class: 'hint' }, campo.hint));
      grid.appendChild(field);
    });

    grid.appendChild(folioDL);
    actualizarFoliosForm(); // estado inicial (considera equipo ya seleccionado al editar)
    return { grid: grid, controls: controls };
  }

  // Folios asociados a un equipo (por N° de inventario), en cualquier etapa.
  function foliosDeEquipo(inv) {
    var s = {};
    ETAPAS.forEach(function (et) {
      DB.registros[et.id].forEach(function (r) {
        if (r.folio && r.equipo && r.equipo.inv === inv) s[r.folio] = 1;
      });
    });
    return Object.keys(s).sort(cmpNat);
  }

  function collectForm(etapa, controls) {
    var rec = {};
    etapa.campos.forEach(function (campo) {
      rec[campo.key] = controls[campo.key].get();
    });
    // Validación de obligatorios
    for (var i = 0; i < etapa.campos.length; i++) {
      var c = etapa.campos[i];
      if (!c.req) continue;
      var v = rec[c.key];
      var vacio = (c.tipo === 'equipo') ? !v : (v == null || v === '');
      if (vacio) throw new Error('Falta completar el campo obligatorio: «' + c.label + '».');
    }
    return rec;
  }

  // --------------------------------------------------------------- Datalists
  function refrescarDatalists() {
    var dlE = document.getElementById('dl-empresas'); dlE.innerHTML = '';
    DB.config.empresas.slice().sort(cmpNat).forEach(function (e) { dlE.appendChild(el('option', { value: e })); });
    var dlF = document.getElementById('dl-folios'); dlF.innerHTML = '';
    folioList().forEach(function (f) { dlF.appendChild(el('option', { value: f })); });
  }
  function folioList() {
    var s = {};
    Object.keys(DB.registros).forEach(function (k) {
      DB.registros[k].forEach(function (r) { if (r.folio) s[r.folio] = 1; });
    });
    return Object.keys(s).sort(cmpNat);
  }

  // ------------------------------------------------------------------ Pills
  function pillFor(key, value) {
    if (!value) return document.createTextNode('');
    var v = String(value);
    var cls = 'pill pill-gray';
    if (key === 'via') cls = /Vía A/.test(v) ? 'pill pill-via-a' : 'pill pill-via-b';
    else if (key === 'estado') cls = /Sin soluci/i.test(v) ? 'pill pill-no' : (/Reparado/i.test(v) ? 'pill pill-ok' : 'pill pill-st');
    else if (key === 'estado_pendiente') cls = /Resuelto/i.test(v) ? 'pill pill-ok' : (/En proceso/i.test(v) ? 'pill pill-st' : 'pill pill-gray');
    else if (key === 'tipo_compra') cls = 'pill pill-via-a';
    else { // estado_equipo, estado_final, resultado (incl. resultados MP: Si/No/Baja/C1..C8/Pendiente/NU)
      if (/^(operativo|si|reparado)$/i.test(v)) cls = 'pill pill-ok';
      else if (/no operativo|^no$|^baja$|^c3$/i.test(v)) cls = 'pill pill-no';
      else if (/servicio|^c2$/i.test(v)) cls = 'pill pill-st';
      else cls = 'pill pill-gray'; // Pendiente, NU, C1, C4..C8
    }
    return el('span', { class: cls }, v);
  }

  // =========================================================== Render general
  var contentEl, viewTitleEl, viewSubEl;

  function navegar(view, editId) {
    STATE.view = view;
    STATE.editId = editId || null;
    render();
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('backdrop').classList.remove('show');
    var mt = document.getElementById('menuToggle'); if (mt) mt.setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);
  }

  function render() {
    refrescarDatalists();
    renderSidebar();
    if (STATE.view === '__dashboard') renderDashboard();
    else if (STATE.view === '__inventario') renderInventario();
    else if (ESTADO_VIEWS[STATE.view]) renderInventario(ESTADO_VIEWS[STATE.view]);
    else if (STATE.view === '__mp_import') renderMPImport();
    else if (STATE.view === '__pendientes') renderPendientes();
    else if (STATE.view === '__todos') renderTodos();
    else if (STATE.view === '__config') renderConfig();
    else renderEtapa(STATE.view);
  }

  function renderSidebar() {
    var nav = document.getElementById('nav');
    nav.innerHTML = '';
    var cerrados = foliosCerrados();
    // Conteos por estado (en vivo) para el tablero de estado del panel izquierdo.
    var invCalc = calcInventario();
    var estCount = { 'Operativo': 0, 'No operativo': 0, 'Servicio técnico': 0, 'Desconocido': 0 }, conEventos = 0;
    invCalc.forEach(function (x) { estCount[x.estado] = (estCount[x.estado] || 0) + 1; if (x.n > 0) conEventos++; });
    GRUPOS_NAV.forEach(function (g) {
      nav.appendChild(el('div', { class: 'group-label' }, g.label));
      g.items.forEach(function (id) {
        var label, icono, badge = null, badgeTitle = null;
        if (id === '__dashboard') { label = 'Resumen'; icono = '📊'; }
        else if (id === '__inventario') { label = 'Inventario de equipos'; icono = '🩺'; badge = conEventos; badgeTitle = 'equipos con eventos'; }
        else if (id === '__est_st') { label = 'En servicio técnico'; icono = '🛠️'; badge = estCount['Servicio técnico']; badgeTitle = 'equipos en este estado'; }
        else if (id === '__est_operativo') { label = 'Operativos'; icono = '✅'; badge = estCount['Operativo']; badgeTitle = 'equipos en este estado'; }
        else if (id === '__est_no_operativo') { label = 'No operativos'; icono = '⛔'; badge = estCount['No operativo']; badgeTitle = 'equipos en este estado'; }
        else if (id === '__est_desconocido') { label = 'Desconocido'; icono = '❔'; badge = estCount['Desconocido']; badgeTitle = 'equipos sin eventos'; }
        else if (id === '__mp_import') { label = 'Importar programación MP'; icono = '📥'; }
        else if (id === '__pendientes') { label = 'Pendientes'; icono = '⚠️'; badge = pendientesAbiertos(); badgeTitle = 'pendientes sin resolver'; }
        else if (id === '__todos') { label = 'Todos los registros'; icono = '🗂️'; badge = totalRegistros(); }
        else if (id === '__config') { label = 'Configuración'; icono = '⚙️'; }
        else {
          var et = ETAPAS_BY_ID[id]; label = et.nombre; icono = et.icono;
          badge = conteoEtapaAbierta(id, cerrados); // solo trabajo abierto (excluye ciclos cerrados)
          badgeTitle = 'Pendientes — excluye los ciclos ya cerrados';
        }
        var activo = STATE.view === id;
        var a = el('a', {
          class: activo ? 'active' : '', role: 'link', tabindex: '0',
          'aria-current': activo ? 'page' : null,
          'aria-label': (badge != null && badge > 0 && badgeTitle) ? (label + ' (' + badge + ' ' + badgeTitle.toLowerCase() + ')') : label
        }, [
          el('span', { class: 'ico', 'aria-hidden': 'true' }, icono),
          el('span', {}, label),
          (badge != null && badge > 0) ? el('span', { class: 'badge', title: badgeTitle }, String(badge)) : null
        ]);
        a.onclick = function () { navegar(id); };
        a.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); navegar(id); } };
        nav.appendChild(a);
      });
    });
  }

  function setTitulo(t, s) { viewTitleEl.textContent = t; viewSubEl.textContent = s || ''; }

  function totalRegistros() {
    var n = 0; ETAPAS.forEach(function (e) { n += DB.registros[e.id].length; }); return n;
  }

  // Folios cuyo ciclo está cerrado (tienen al menos un registro de "Cierre del ciclo").
  function foliosCerrados() {
    var s = {};
    DB.registros.cierre.forEach(function (r) { if (r.folio) s[r.folio] = 1; });
    return s;
  }

  // Conteo de "trabajo abierto" de una etapa: excluye registros de folios cerrados.
  function conteoEtapaAbierta(stageId, cerrados) {
    cerrados = cerrados || foliosCerrados();
    var n = 0;
    DB.registros[stageId].forEach(function (r) { if (!r.folio || !cerrados[r.folio]) n++; });
    return n;
  }

  // ---------------------------------------------------- Antigüedad / SLA
  function diasDesde(iso) {
    if (!iso) return null;
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); if (isNaN(d)) return null;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  }
  function agePill(dias) {
    var cls = dias <= 15 ? 'age-ok' : (dias <= 45 ? 'age-warn' : 'age-bad');
    return el('span', { class: 'age-pill ' + cls, title: 'Días desde la apertura' }, dias + (dias === 1 ? ' día' : ' días'));
  }
  // Solicitudes vigentes (folios no cerrados) con su antigüedad, por la fecha más antigua del folio.
  function solicitudesVigentesAntiguedad() {
    var cerrados = foliosCerrados(), first = {};
    ETAPAS.forEach(function (et) {
      DB.registros[et.id].forEach(function (r) {
        if (!r.folio || cerrados[r.folio]) return;
        var f = r.fecha || (r._createdAt ? r._createdAt.slice(0, 10) : '');
        if (!f) return;
        if (!first[r.folio] || f < first[r.folio].fecha) first[r.folio] = { folio: r.folio, fecha: f, equipo: r.equipo };
      });
    });
    return Object.keys(first).map(function (k) { var o = first[k]; o.dias = diasDesde(o.fecha) || 0; return o; })
      .sort(function (a, b) { return b.dias - a.dias; });
  }

  // ------------------------------------------------------------- Dashboard
  function renderDashboard() {
    setTitulo('Resumen del proceso', 'Gestión de equipos en servicio técnico · versión 2.0');
    contentEl.innerHTML = '';

    var folios = folioList();
    var cerrados = {}; DB.registros.cierre.forEach(function (r) { if (r.folio) cerrados[r.folio] = 1; });
    var equiposSet = {};
    ETAPAS.forEach(function (e) { DB.registros[e.id].forEach(function (r) { if (r.equipo && r.equipo.inv) equiposSet[r.equipo.inv] = 1; }); });
    var vigentes = folios.filter(function (f) { return !cerrados[f]; }).length;

    var antiguedad = solicitudesVigentesAntiguedad();
    var maxDias = antiguedad.length ? antiguedad[0].dias : 0;

    var stats = el('div', { class: 'stat-grid' });
    function stat(n, l, accent) { return el('div', { class: 'stat' + (accent ? ' accent' : '') }, [el('div', { class: 'n' }, String(n)), el('div', { class: 'l' }, l)]); }
    stats.appendChild(stat(totalRegistros(), 'Registros totales'));
    stats.appendChild(stat(folios.length, 'Folios de solicitud'));
    stats.appendChild(stat(vigentes, 'Solicitudes vigentes'));
    stats.appendChild(stat(Object.keys(cerrados).length, 'Ciclos cerrados', true));
    stats.appendChild(stat(Object.keys(equiposSet).length, 'Equipos intervenidos'));
    stats.appendChild(stat(maxDias, 'Antigüedad máx. (días)'));
    contentEl.appendChild(stats);

    var banner = el('div', { class: 'banner' },
      'Cada etapa se registra de forma independiente: puede crear cualquier registro sin necesidad de completar las etapas previas. ' +
      'El folio de la solicitud se ingresa manualmente y, en el resto de las etapas, puede reutilizarlo desde la lista.');
    contentEl.appendChild(banner);

    // Seguimiento de SLA: solicitudes vigentes ordenadas por antigüedad.
    if (antiguedad.length) {
      var cardSLA = el('div', { class: 'card' });
      cardSLA.appendChild(el('div', { class: 'card-head' }, [
        el('h3', {}, '⏱️ Solicitudes vigentes más antiguas'),
        el('span', { class: 'desc' }, 'Verde ≤ 15 días · ámbar ≤ 45 · rojo > 45')
      ]));
      var bodySLA = el('div', { class: 'card-body' });
      var wrapSLA = el('div', { class: 'tabla-wrap' });
      var tSLA = el('table', { class: 'data' });
      tSLA.appendChild(el('thead', {}, el('tr', {}, [th('Folio'), th('Equipo'), th('Apertura'), th('Antigüedad')])));
      var tbSLA = el('tbody');
      antiguedad.slice(0, 8).forEach(function (o) {
        var tr = el('tr', { class: 'row-click' });
        tr.appendChild(td(o.folio || '—'));
        tr.appendChild(td(equipoCorto(o.equipo) || '—'));
        tr.appendChild(td(fmtFecha(o.fecha) || '—'));
        tr.appendChild(td(agePill(o.dias)));
        tr.onclick = function () { navegar('__todos'); };
        tbSLA.appendChild(tr);
      });
      tSLA.appendChild(tbSLA); wrapSLA.appendChild(tSLA); bodySLA.appendChild(wrapSLA);
      cardSLA.appendChild(bodySLA);
      contentEl.appendChild(cardSLA);
    }

    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, 'Etapas del proceso'), el('span', { class: 'desc' }, 'Haga clic en una etapa para registrar.')]));
    var body = el('div', { class: 'card-body' });
    var flow = el('div', { class: 'flow' });
    ETAPAS.forEach(function (et) {
      if (et.id === 'mp' || et.id === 'pendiente') return; // tienen su propia sección
      var step = el('div', { class: 'step' }, [
        el('div', { class: 'tag' }, et.via),
        el('div', { class: 'name' }, et.icono + ' ' + et.nombre),
        el('div', { class: 'cnt' }, DB.registros[et.id].length + ' registro' + (DB.registros[et.id].length === 1 ? '' : 's'))
      ]);
      step.onclick = function () { navegar(et.id); };
      flow.appendChild(step);
    });
    body.appendChild(flow);
    card.appendChild(body);
    contentEl.appendChild(card);

    // Actividad reciente
    var todos = [];
    ETAPAS.forEach(function (et) { DB.registros[et.id].forEach(function (r) { todos.push({ et: et, r: r }); }); });
    todos.sort(function (a, b) { return (b.r._createdAt || '').localeCompare(a.r._createdAt || ''); });
    var recientes = todos.slice(0, 8);

    var card2 = el('div', { class: 'card' });
    card2.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, 'Actividad reciente')]));
    if (!recientes.length) {
      card2.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🗒️'), el('div', {}, 'Aún no hay registros. Comience creando una solicitud de trabajo o cualquier otra etapa.')]));
    } else {
      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [th('Registrado'), th('Etapa'), th('Folio'), th('Equipo'), th('Técnico'), th('Detalle')])));
      var tb = el('tbody');
      recientes.forEach(function (x) {
        tb.appendChild(el('tr', {}, [
          td(fmtFechaHora(x.r._createdAt)),
          td(el('span', { class: 'tag-etapa' }, x.et.nombre)),
          td(x.r.folio || '—'),
          td(equipoCorto(x.r.equipo) || '—'),
          td(x.r.tecnico || '—'),
          td(detalleCorto(x.et, x.r))
        ]));
      });
      t.appendChild(tb);
      wrap.appendChild(t);
      card2.appendChild(wrap);
    }
    contentEl.appendChild(card2);
  }

  function detalleCorto(etapa, r) {
    var partes = [];
    if (r.via) partes.push(r.via);
    if (r.estado) partes.push(r.estado);
    if (r.estado_equipo) partes.push(r.estado_equipo);
    if (r.resultado) partes.push(r.resultado);
    if (r.estado_final) partes.push(r.estado_final);
    if (r.tipo_compra) partes.push(r.tipo_compra);
    if (r.empresa) partes.push(r.empresa);
    return partes.join(' · ') || '—';
  }
  function th(t) { return el('th', {}, t); }
  function td(c) { return el('td', {}, [typeof c === 'object' && c ? c : document.createTextNode(c == null ? '' : String(c))]); }

  // ------------------------------------------------------- Inventario / estado
  // Índice: N° de inventario -> lista de eventos {etapa, registro}
  function buildEquipoIndex() {
    var idx = {};
    ETAPAS.forEach(function (et) {
      DB.registros[et.id].forEach(function (r) {
        if (r.equipo && r.equipo.inv) { (idx[r.equipo.inv] = idx[r.equipo.inv] || []).push({ etapa: et, r: r }); }
      });
    });
    return idx;
  }

  function normEstado(v) {
    if (!v) return null;
    if (/no operativo/i.test(v)) return 'No operativo';
    if (/servicio/i.test(v)) return 'Servicio técnico';
    if (/operativo/i.test(v)) return 'Operativo';
    return null;
  }

  // Estado físico que implica un registro según su etapa (null = no lo define).
  function estadoDesdeRegistro(stageId, r) {
    switch (stageId) {
      case 'cierre': return normEstado(r.estado_final) || 'Operativo';
      case 'reparacion': return normEstado(r.resultado) || 'No operativo';
      case 'recepcion': return normEstado(r.estado_equipo) || 'No operativo';
      case 'diagnostico': return normEstado(r.estado_equipo) || 'No operativo';
      case 'estado_st': return 'Servicio técnico';
      case 'envio': return 'Servicio técnico';
      case 'solicitud': return 'No operativo';
      case 'mp': return (window.EventosMP && window.EventosMP.estadoFromResultado) ? window.EventosMP.estadoFromResultado(r.resultado) : null;
      default: return null; // etapas comerciales no definen estado físico
    }
  }

  function cmpFechaDesc(a, b) {
    var fa = a.fecha || '', fb = b.fecha || '';
    if (fa !== fb) return fa < fb ? 1 : -1;
    var ca = a._createdAt || '', cb = b._createdAt || '';
    return ca < cb ? 1 : (ca > cb ? -1 : 0);
  }

  // Estado actual + fecha de última actualización a partir de los eventos.
  function estadoYActualizacion(evs) {
    if (!evs.length) return { estado: 'Desconocido', ultima: '' };
    var sorted = evs.slice().sort(function (a, b) { return cmpFechaDesc(a.r, b.r); });
    var top = sorted[0].r;
    var ultima = top.fecha || (top._createdAt ? top._createdAt.slice(0, 10) : '');
    var estado = 'No operativo';
    for (var i = 0; i < sorted.length; i++) {
      var s = estadoDesdeRegistro(sorted[i].etapa.id, sorted[i].r);
      if (s) { estado = s; break; }
    }
    return { estado: estado, ultima: ultima };
  }

  function calcInventario() {
    var idx = buildEquipoIndex();
    return getEquipos().map(function (e) {
      var evs = (e.inventario && idx[e.inventario]) ? idx[e.inventario] : [];
      var info = estadoYActualizacion(evs);
      return { e: e, estado: info.estado, ultima: info.ultima, n: evs.length, evs: evs };
    });
  }

  function estadoPill(estado) {
    var cls = estado === 'Operativo' ? 'pill pill-ok'
      : estado === 'No operativo' ? 'pill pill-no'
        : estado === 'Servicio técnico' ? 'pill pill-st' : 'pill pill-gray';
    return el('span', { class: cls }, estado);
  }

  // Mapa estado -> vista del tablero de estado (panel izquierdo).
  var EST_VIEW = { 'Operativo': '__est_operativo', 'No operativo': '__est_no_operativo', 'Servicio técnico': '__est_st', 'Desconocido': '__est_desconocido' };

  function renderInventario(estadoForzado) {
    var titulos = {
      'Servicio técnico': ['🛠️ Equipos en servicio técnico', 'Equipos cuyo último evento indica que están en servicio técnico'],
      'Operativo': ['✅ Equipos operativos', 'Equipos cuyo último evento indica que están operativos'],
      'No operativo': ['⛔ Equipos no operativos', 'Equipos cuyo último evento indica que están no operativos'],
      'Desconocido': ['❔ Equipos sin eventos', 'Equipos sin ningún evento registrado (estado desconocido)']
    };
    if (estadoForzado && titulos[estadoForzado]) setTitulo(titulos[estadoForzado][0], titulos[estadoForzado][1]);
    else setTitulo('🩺 Inventario de equipos', getEquipos().length + ' equipos críticos · estado según el último evento');
    contentEl.innerHTML = '';

    var inv = calcInventario();
    var counts = { 'Operativo': 0, 'No operativo': 0, 'Servicio técnico': 0, 'Desconocido': 0 };
    inv.forEach(function (x) { counts[x.estado] = (counts[x.estado] || 0) + 1; });

    var stats = el('div', { class: 'stat-grid' });
    function st(n, l, estado, accent) {
      var box = el('div', { class: 'stat' + (accent ? ' accent' : '') + (estado ? ' row-click' : ''), title: estado ? ('Ver equipos: ' + l) : null },
        [el('div', { class: 'n' }, String(n)), el('div', { class: 'l' }, l)]);
      if (estado) box.onclick = function () { navegar(EST_VIEW[estado]); };
      return box;
    }
    stats.appendChild(st(counts['Operativo'], 'Operativos', 'Operativo', true));
    stats.appendChild(st(counts['No operativo'], 'No operativos', 'No operativo'));
    stats.appendChild(st(counts['Servicio técnico'], 'En servicio técnico', 'Servicio técnico'));
    stats.appendChild(st(counts['Desconocido'], 'Desconocido (sin eventos)', 'Desconocido'));
    contentEl.appendChild(stats);

    contentEl.appendChild(el('div', { class: 'banner' },
      (estadoForzado
        ? ('Mostrando solo los equipos en estado «' + estadoForzado + '». Al cambiar de estado, un equipo deja de aparecer aquí automáticamente. ')
        : 'El estado se calcula automáticamente a partir del último evento registrado de cada equipo. ') +
      'Haga clic en una fila para ver la ficha del equipo y todos sus registros.'));

    var card = el('div', { class: 'card' });
    var body = el('div', { class: 'card-body' });

    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Buscar por inventario, equipo, serie, marca, servicio, ubicación…' });
    var selEstado = el('select', { 'aria-label': 'Filtrar por estado' });
    [['', 'Todos los estados'], ['Operativo', 'Operativo'], ['No operativo', 'No operativo'], ['Servicio técnico', 'En servicio técnico'], ['Desconocido', 'Desconocido']]
      .forEach(function (o) { selEstado.appendChild(el('option', { value: o[0] }, o[1])); });
    if (estadoForzado) selEstado.value = estadoForzado;
    toolbar.appendChild(search);
    toolbar.appendChild(selEstado);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var note = el('span', { class: 'count-note' });
    toolbar.appendChild(note);
    var btnExp = el('button', { class: 'btn' }, '⬇️ Exportar inventario');
    btnExp.onclick = function () { exportarInventario(); };
    toolbar.appendChild(btnExp);
    body.appendChild(toolbar);

    var cont = el('div');
    body.appendChild(cont);

    function pintar() {
      var q = search.value.trim().toLowerCase();
      var ef = selEstado.value;
      var rows = inv.filter(function (x) {
        if (ef && x.estado !== ef) return false;
        if (!q) return true;
        var e = x.e;
        var hay = ((e.id || '') + ' ' + (e.carpeta || '') + ' ' + (e.inventario || '') + ' ' + (e.equipo || '') + ' ' +
          (e.serie || '') + ' ' + (e.marca || '') + ' ' + (e.modelo || '') + ' ' + (e.servicio || '') + ' ' +
          (e.unidad || '') + ' ' + (e.ubicacion || '') + ' ' + (e.procedencia || '')).toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      rows.sort(function (a, b) { return cmpNat(a.e.id, b.e.id) || cmpNat(a.e.inventario, b.e.inventario); });
      note.textContent = rows.length + ' equipo(s)';
      cont.innerHTML = '';
      if (!rows.length) { cont.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🔎'), el('div', {}, 'Sin resultados.')])); return; }

      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [
        th('ID'), th('N° Carpeta'), th('N° Inventario'), th('Equipo'), th('Servicio'), th('Unidad'),
        th('Ubicación'), th('Procedencia'), th('Marca'), th('Modelo'), th('Serie'),
        th('Estado'), th('Última actualización'), th('Registros')
      ])));
      var tb = el('tbody');
      var frag = document.createDocumentFragment();
      rows.forEach(function (x) {
        var e = x.e;
        var tr = el('tr', { class: 'row-click' });
        tr.appendChild(td(e.id || '—'));
        tr.appendChild(td(e.carpeta || '—'));
        tr.appendChild(td(e.inventario || '—'));
        tr.appendChild(td(e.equipo || '—'));
        tr.appendChild(td(e.servicio || '—'));
        tr.appendChild(td(e.unidad || '—'));
        tr.appendChild(td(e.ubicacion || '—'));
        tr.appendChild(td(e.procedencia || '—'));
        tr.appendChild(td(e.marca || '—'));
        tr.appendChild(td(e.modelo || '—'));
        tr.appendChild(td(e.serie || '—'));
        tr.appendChild(td(estadoPill(x.estado)));
        tr.appendChild(td(x.ultima ? fmtFecha(x.ultima) : '—'));
        tr.appendChild(td(String(x.n)));
        tr.onclick = function () { openEquipoDetalle(x); };
        frag.appendChild(tr);
      });
      tb.appendChild(frag);
      t.appendChild(tb);
      wrap.appendChild(t);
      cont.appendChild(wrap);
    }
    search.addEventListener('input', pintar);
    // El desplegable navega a la vista de estado correspondiente (sincroniza panel y título).
    selEstado.addEventListener('change', function () {
      var v = selEstado.value;
      navegar(v && EST_VIEW[v] ? EST_VIEW[v] : '__inventario');
    });
    pintar();

    card.appendChild(body);
    contentEl.appendChild(card);
  }

  function openEquipoDetalle(item) {
    var e = item.e;
    var cont = el('div');

    cont.appendChild(el('div', { style: 'margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap' }, [
      estadoPill(item.estado),
      el('span', { class: 'count-note' }, item.ultima ? ('Última actualización: ' + fmtFecha(item.ultima)) : 'Sin actualizaciones'),
      el('span', { class: 'count-note' }, '· ' + item.n + ' registro(s)')
    ]));

    // Registrar para este equipo: accesos rápidos + evento correctivo por etapa.
    var crear = el('div', { class: 'crear-evento' });
    crear.appendChild(el('span', { class: 'k' }, 'Registrar para este equipo:'));
    var bMP = el('button', { class: 'btn btn-primary btn-sm' }, '🧰 Mantención preventiva');
    bMP.onclick = function () { crearEventoDesdeEquipo(item.e, 'mp'); };
    var bPend = el('button', { class: 'btn btn-sm' }, '⚠️ Pendiente');
    bPend.onclick = function () { crearEventoDesdeEquipo(item.e, 'pendiente'); };
    crear.appendChild(bMP);
    crear.appendChild(bPend);
    // Evento correctivo (elige la etapa del flujo correctivo)
    var selEt = el('select');
    ETAPAS.forEach(function (et) {
      if (et.id === 'mp' || et.id === 'pendiente') return;
      selEt.appendChild(el('option', { value: et.id }, et.icono + ' ' + et.nombre));
    });
    var btnCorr = el('button', { class: 'btn btn-sm' }, '➕ Correctivo');
    btnCorr.onclick = function () { crearEventoDesdeEquipo(item.e, selEt.value); };
    crear.appendChild(selEt);
    crear.appendChild(btnCorr);
    cont.appendChild(crear);

    var fg = el('div', { class: 'ficha-grid' });
    [['ID', e.id], ['N° Inventario', e.inventario], ['N° Carpeta', e.carpeta], ['Equipo', e.equipo], ['Servicio', e.servicio],
    ['Unidad', e.unidad], ['Ubicación', e.ubicacion], ['Procedencia', e.procedencia], ['Marca', e.marca],
    ['Modelo', e.modelo], ['Serie', e.serie], ['Año instalación', e.anio], ['Vida útil residual', e.vida_util],
    ['Clasificación', e.clasificacion]].forEach(function (p) {
      if (p[1]) fg.appendChild(el('div', { class: 'it' }, [el('div', { class: 'k' }, p[0]), el('div', { class: 'v' }, p[1])]));
    });
    cont.appendChild(fg);

    cont.appendChild(el('h4', { style: 'margin:6px 0 10px;font-size:14px' }, 'Registros del equipo'));

    if (!item.evs.length) {
      cont.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🗒️'),
        el('div', {}, 'Este equipo no tiene registros aún. Puede crear uno desde cualquier etapa seleccionándolo.')]));
    } else {
      var evs = item.evs.slice().sort(function (a, b) { return cmpFechaDesc(a.r, b.r); });
      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [
        th('Fecha'), th('Etapa'), th('Estado / Resultado'), th('Técnico'), th('Empresa'), th('N° doc'), th('Folio'), th('Observaciones'), th('')
      ])));
      var tb = el('tbody');
      evs.forEach(function (x) {
        var r = x.r;
        var tr = el('tr');
        tr.appendChild(td(fmtFecha(r.fecha) || '—'));
        tr.appendChild(td(el('span', { class: 'tag-etapa' }, x.etapa.nombre)));
        var er = estadoResultado(r);
        tr.appendChild(td(er ? pillFor(estadoResultadoKey(r), er) : '—'));
        tr.appendChild(td(r.tecnico || '—'));
        tr.appendChild(td(r.empresa || '—'));
        tr.appendChild(td(numeroDoc(r) || '—'));
        tr.appendChild(td(r.folio || '—'));
        var obs = r.observaciones || '';
        tr.appendChild(td(obs.length > 50 ? (obs.slice(0, 50) + '…') : (obs || '—')));
        var acc = el('td', { class: 'acciones' });
        var b = el('button', { class: 'btn btn-sm', title: 'Gestionar (tareas y actualizaciones)' }, '🔧 Gestionar');
        b.onclick = function () { openEventoDetalle(x.etapa.id, r._id); };
        acc.appendChild(b);
        tr.appendChild(acc);
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      wrap.appendChild(t);
      cont.appendChild(wrap);
    }
    openModal('🩺 ' + (e.inventario || '(sin inventario)') + ' — ' + (e.equipo || ''), cont);
  }

  // Convierte un equipo del listado al formato que guarda el selector/registro.
  function equipoToPicker(e) {
    return { inv: e.inventario, nombre: e.equipo, servicio: e.servicio, serie: e.serie, marca: e.marca, modelo: e.modelo, unidad: e.unidad, ubicacion: e.ubicacion };
  }

  // Registro semilla con los valores por defecto de la etapa + datos precargados.
  function seedRecord(etapa, overlay) {
    var s = {};
    etapa.campos.forEach(function (c) {
      if (c.tipo === 'fecha') s[c.key] = hoyISO();
      else if (c.tipo === 'select') s[c.key] = c.def || '';
      else s[c.key] = '';
    });
    if (overlay) Object.keys(overlay).forEach(function (k) { s[k] = overlay[k]; });
    return s;
  }

  // Último folio ABIERTO (no cerrado) asociado a un equipo, por su evento más reciente.
  function ultimoFolioAbiertoEquipo(inv) {
    if (!inv) return '';
    var cerrados = foliosCerrados();
    var evs = [];
    ETAPAS.forEach(function (et) {
      DB.registros[et.id].forEach(function (r) {
        if (r.folio && r.equipo && r.equipo.inv === inv) evs.push(r);
      });
    });
    evs.sort(cmpFechaDesc); // más reciente primero
    for (var i = 0; i < evs.length; i++) { if (!cerrados[evs[i].folio]) return evs[i].folio; }
    return '';
  }

  // Abre el formulario de una etapa con el equipo ya seleccionado (nuevo registro).
  function crearEventoDesdeEquipo(equipoRaw, etapaId) {
    var overlay = { equipo: equipoToPicker(equipoRaw) };
    // Para etapas distintas de la solicitud, precarga el último folio abierto del equipo.
    if (etapaId !== 'solicitud') {
      var folio = ultimoFolioAbiertoEquipo(equipoRaw.inventario);
      if (folio) overlay.folio = folio;
    }
    STATE.prefill = { etapaId: etapaId, overlay: overlay };
    closeModal();
    navegar(etapaId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ------------------------------------------------------------------- Modal
  var _modalOnClose = null, _modalPrevFocus = null;
  function openModal(titulo, bodyNode, onClose) {
    closeModal();
    _modalOnClose = onClose || null;
    _modalPrevFocus = document.activeElement; // para devolver el foco al cerrar
    var titleId = 'modal-title-' + uid();
    var bd = el('div', { class: 'modal-backdrop', id: 'modal-bd' });
    var m = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId });
    var btnX = el('button', { class: 'close', title: 'Cerrar', 'aria-label': 'Cerrar' }, '✕');
    btnX.onclick = closeModal;
    m.appendChild(el('div', { class: 'modal-head' }, [el('h3', { id: titleId }, titulo), btnX]));
    m.appendChild(el('div', { class: 'modal-body' }, [bodyNode]));
    bd.appendChild(m);
    bd.addEventListener('click', function (ev) { if (ev.target === bd) closeModal(); });
    document.body.appendChild(bd);
    document.addEventListener('keydown', escClose);
    // Foco inicial dentro del diálogo (primer control o el botón cerrar).
    var primero = m.querySelector('input,select,textarea,button,[tabindex]') || btnX;
    if (primero && primero.focus) primero.focus();
  }
  // Cierra con Escape y mantiene el foco dentro del diálogo (Tab/Shift+Tab).
  function escClose(ev) {
    if (ev.key === 'Escape') { closeModal(); return; }
    if (ev.key !== 'Tab') return;
    var m = document.querySelector('#modal-bd .modal'); if (!m) return;
    var foc = m.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
    if (!foc.length) return;
    var first = foc[0], last = foc[foc.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }
  function closeModal() {
    var x = document.getElementById('modal-bd');
    if (x && x.parentNode) x.parentNode.removeChild(x);
    document.removeEventListener('keydown', escClose);
    var cb = _modalOnClose; _modalOnClose = null;
    var pf = _modalPrevFocus; _modalPrevFocus = null;
    if (pf && pf.focus) { try { pf.focus(); } catch (e) {} }
    if (cb) cb();
  }

  // -------------------------------------------- Eventos: tareas y actualizaciones
  function getRegistro(stageId, id) {
    var arr = DB.registros[stageId] || [];
    for (var i = 0; i < arr.length; i++) if (arr[i]._id === id) return arr[i];
    return null;
  }
  function ensureSub(rec) {
    if (!Array.isArray(rec.tareas)) rec.tareas = [];
    if (!Array.isArray(rec.actualizaciones)) rec.actualizaciones = [];
  }
  function pendientesAbiertos() {
    var n = 0; (DB.registros.pendiente || []).forEach(function (r) { if ((r.estado_pendiente || 'Pendiente') !== 'Resuelto') n++; });
    return n;
  }

  // Panel de gestión de un evento: resumen + tareas + actualizaciones.
  function openEventoDetalle(stageId, recId) {
    var etapa = ETAPAS_BY_ID[stageId];
    var rec = getRegistro(stageId, recId);
    if (!etapa || !rec) { toast('No se encontró el registro.', 'err'); return; }
    ensureSub(rec);
    var cont = el('div');

    var resumen = el('div', { class: 'evento-resumen' });
    resumen.appendChild(el('span', { class: 'tag-etapa' }, etapa.nombre));
    if (rec.equipo) resumen.appendChild(el('span', { class: 'count-note' }, equipoCorto(rec.equipo)));
    if (rec.fecha) resumen.appendChild(el('span', { class: 'count-note' }, '📅 ' + fmtFecha(rec.fecha)));
    if (rec.folio) resumen.appendChild(el('span', { class: 'count-note' }, 'Folio ' + rec.folio));
    var er = estadoResultado(rec); if (er) resumen.appendChild(pillFor(estadoResultadoKey(rec), er));
    cont.appendChild(resumen);

    // Cambio rápido de estado para pendientes
    if (stageId === 'pendiente') {
      var fila = el('div', { class: 'crear-evento' });
      fila.appendChild(el('span', { class: 'k' }, 'Estado:'));
      var selE = el('select');
      ['Pendiente', 'En proceso', 'Resuelto'].forEach(function (o) { selE.appendChild(el('option', { value: o }, o)); });
      selE.value = rec.estado_pendiente || 'Pendiente';
      selE.onchange = function () {
        rec.estado_pendiente = selE.value;
        if (selE.value === 'Resuelto' && !rec.fecha_resolucion) rec.fecha_resolucion = hoyISO();
        rec._updatedAt = new Date().toISOString(); guardarDB(); renderSidebar();
        toast('Estado: ' + selE.value, 'ok');
      };
      fila.appendChild(selE);
      cont.appendChild(fila);
    }

    if (rec.observaciones) cont.appendChild(el('p', { class: 'evento-desc' }, rec.observaciones));

    // --- Tareas ---
    var hT = el('h4', { class: 'sub-h' }, '');
    function refrescarTituloTareas() { hT.textContent = 'Tareas (' + rec.tareas.filter(function (t) { return t.hecha; }).length + '/' + rec.tareas.length + ')'; }
    cont.appendChild(hT);
    var listaT = el('div', { class: 'tareas' });
    function pintarTareas() {
      listaT.innerHTML = '';
      if (!rec.tareas.length) listaT.appendChild(el('div', { class: 'muted-empty' }, 'Sin tareas.'));
      rec.tareas.forEach(function (t) {
        var row = el('div', { class: 'tarea' + (t.hecha ? ' done' : '') });
        var cb = el('input', { type: 'checkbox' }); cb.checked = !!t.hecha;
        cb.onchange = function () { t.hecha = cb.checked; t.doneAt = cb.checked ? new Date().toISOString() : null; rec._updatedAt = new Date().toISOString(); guardarDB(); pintarTareas(); refrescarTituloTareas(); };
        var txt = el('span', { class: 't-txt' }, t.texto);
        var del = el('button', { class: 'btn btn-sm btn-danger', title: 'Eliminar tarea' }, '🗑️');
        del.onclick = function () { rec.tareas = rec.tareas.filter(function (x) { return x.id !== t.id; }); guardarDB(); pintarTareas(); refrescarTituloTareas(); };
        row.appendChild(cb); row.appendChild(txt); row.appendChild(del);
        listaT.appendChild(row);
      });
    }
    pintarTareas(); refrescarTituloTareas();
    cont.appendChild(listaT);
    var addT = el('div', { class: 'inline-add' });
    var inpT = el('input', { type: 'text', placeholder: 'Nueva tarea…' });
    var btnT = el('button', { class: 'btn btn-primary' }, 'Agregar tarea');
    function agregarTarea() { var v = inpT.value.trim(); if (!v) return; rec.tareas.push({ id: uid(), texto: v, hecha: false, createdAt: new Date().toISOString() }); inpT.value = ''; rec._updatedAt = new Date().toISOString(); guardarDB(); pintarTareas(); refrescarTituloTareas(); }
    btnT.onclick = agregarTarea; inpT.addEventListener('keydown', function (e) { if (e.key === 'Enter') agregarTarea(); });
    addT.appendChild(inpT); addT.appendChild(btnT); cont.appendChild(addT);

    // --- Actualizaciones ---
    cont.appendChild(el('h4', { class: 'sub-h' }, 'Actualizaciones'));
    var listaA = el('div', { class: 'timeline' });
    function pintarAct() {
      listaA.innerHTML = '';
      if (!rec.actualizaciones.length) listaA.appendChild(el('div', { class: 'muted-empty' }, 'Sin actualizaciones.'));
      rec.actualizaciones.slice().sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); }).forEach(function (a) {
        var it = el('div', { class: 'tl-item' });
        it.appendChild(el('div', { class: 'tl-meta' }, fmtFechaHora(a.createdAt)));
        it.appendChild(el('div', { class: 'tl-txt' }, a.texto));
        listaA.appendChild(it);
      });
    }
    pintarAct();
    cont.appendChild(listaA);
    var addA = el('div', { class: 'inline-add' });
    var inpA = el('textarea', { rows: '2', placeholder: 'Escribe una actualización…' });
    var btnA = el('button', { class: 'btn btn-primary' }, 'Agregar');
    function agregarAct() { var v = inpA.value.trim(); if (!v) return; rec.actualizaciones.push({ id: uid(), texto: v, createdAt: new Date().toISOString() }); inpA.value = ''; rec._updatedAt = new Date().toISOString(); guardarDB(); pintarAct(); }
    btnA.onclick = agregarAct;
    addA.appendChild(inpA); addA.appendChild(btnA); cont.appendChild(addA);

    var foot = el('div', { class: 'form-actions' });
    var bEdit = el('button', { class: 'btn' }, '✏️ Editar campos del evento');
    bEdit.onclick = function () { closeModal(); navegar(stageId, recId); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    foot.appendChild(bEdit);
    cont.appendChild(foot);

    openModal((etapa.icono || '') + ' ' + etapa.nombre + (rec.equipo ? (' · ' + (rec.equipo.inv || '')) : ''), cont, function () { render(); });
  }

  // -------------------------------------------------------------- Pendientes
  function renderPendientes() {
    setTitulo('⚠️ Pendientes', 'Gestión y seguimiento de asuntos pendientes por equipo');
    contentEl.innerHTML = '';
    var etapa = ETAPAS_BY_ID['pendiente'];
    var lista = DB.registros.pendiente.slice();

    var counts = { 'Pendiente': 0, 'En proceso': 0, 'Resuelto': 0 };
    lista.forEach(function (r) { var s = r.estado_pendiente || 'Pendiente'; counts[s] = (counts[s] || 0) + 1; });
    var stats = el('div', { class: 'stat-grid' });
    stats.appendChild(mpStatBox(counts['Pendiente'], 'Pendientes'));
    stats.appendChild(mpStatBox(counts['En proceso'], 'En proceso'));
    stats.appendChild(el('div', { class: 'stat accent' }, [el('div', { class: 'n' }, String(counts['Resuelto'])), el('div', { class: 'l' }, 'Resueltos')]));
    contentEl.appendChild(stats);

    // Crear pendiente
    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, 'Nuevo pendiente'), el('span', { class: 'desc' }, etapa.desc)]));
    var body = el('div', { class: 'card-body' });
    var form = buildForm(etapa, null);
    body.appendChild(form.grid);
    var actions = el('div', { class: 'form-actions' });
    var bg = el('button', { class: 'btn btn-primary' }, '➕ Guardar pendiente');
    bg.onclick = function () {
      try {
        var rec = collectForm(etapa, form.controls);
        rec._id = uid(); rec._stage = 'pendiente'; rec._createdAt = new Date().toISOString(); rec.tareas = []; rec.actualizaciones = [];
        autoaprenderEmpresa(rec); DB.registros.pendiente.push(rec); guardarDB();
        toast('Pendiente registrado.', 'ok'); renderPendientes(); renderSidebar(); window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) { toast(err.message, 'err'); }
    };
    actions.appendChild(bg); body.appendChild(actions); card.appendChild(body); contentEl.appendChild(card);

    // Listado gestionable
    var card2 = el('div', { class: 'card' });
    card2.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, 'Listado de pendientes')]));
    var body2 = el('div', { class: 'card-body' });
    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Buscar por equipo, tipo, descripción, responsable…' });
    var selE = el('select');
    [['', 'Todos los estados'], ['Pendiente', 'Pendiente'], ['En proceso', 'En proceso'], ['Resuelto', 'Resuelto']].forEach(function (o) { selE.appendChild(el('option', { value: o[0] }, o[1])); });
    var selT = el('select'); selT.appendChild(el('option', { value: '' }, 'Todos los tipos'));
    ['Otro', 'Pauta de monitoreo', 'Firma', 'Reporte Interno', 'Reporte Externo'].forEach(function (o) { selT.appendChild(el('option', { value: o }, o)); });
    toolbar.appendChild(search); toolbar.appendChild(selE); toolbar.appendChild(selT);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var bExp = el('button', { class: 'btn' }, '⬇️ Exportar'); bExp.onclick = function () { exportarEtapa(etapa); };
    toolbar.appendChild(bExp); body2.appendChild(toolbar);
    var cont = el('div'); body2.appendChild(cont);

    function pintar() {
      var q = search.value.trim().toLowerCase(), fe = selE.value, ft = selT.value;
      var rows = lista.filter(function (r) {
        if (fe && (r.estado_pendiente || 'Pendiente') !== fe) return false;
        if (ft && r.tipo !== ft) return false;
        if (!q) return true;
        return ((equipoCorto(r.equipo) + ' ' + (r.tipo || '') + ' ' + (r.observaciones || '') + ' ' + (r.tecnico || '')).toLowerCase().indexOf(q) >= 0);
      });
      rows.sort(function (a, b) {
        var ra = (a.estado_pendiente === 'Resuelto') ? 1 : 0, rb = (b.estado_pendiente === 'Resuelto') ? 1 : 0;
        return ra - rb || cmpFechaDesc(a, b);
      });
      cont.innerHTML = '';
      if (!rows.length) { cont.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '✅'), el('div', {}, 'Sin pendientes que coincidan.')])); return; }
      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [th('Equipo'), th('Tipo'), th('Descripción'), th('Estado'), th('Responsable'), th('Fecha'), th('Tareas'), th('Acciones')])));
      var tb = el('tbody');
      rows.forEach(function (r) {
        ensureSub(r);
        var tr = el('tr');
        tr.appendChild(td(equipoCorto(r.equipo) || '—'));
        tr.appendChild(td(r.tipo || '—'));
        var obs = r.observaciones || ''; tr.appendChild(td(obs.length > 48 ? (obs.slice(0, 48) + '…') : (obs || '—')));
        var tdE = el('td'); var sel = el('select', { class: 'mini' });
        ['Pendiente', 'En proceso', 'Resuelto'].forEach(function (o) { sel.appendChild(el('option', { value: o }, o)); });
        sel.value = r.estado_pendiente || 'Pendiente';
        sel.onchange = function () { r.estado_pendiente = sel.value; if (sel.value === 'Resuelto' && !r.fecha_resolucion) r.fecha_resolucion = hoyISO(); r._updatedAt = new Date().toISOString(); guardarDB(); renderSidebar(); renderPendientes(); };
        tdE.appendChild(sel); tr.appendChild(tdE);
        tr.appendChild(td(r.tecnico || '—'));
        tr.appendChild(td(fmtFecha(r.fecha) || '—'));
        var done = r.tareas.filter(function (x) { return x.hecha; }).length;
        tr.appendChild(td(r.tareas.length ? (done + '/' + r.tareas.length) : '—'));
        var acc = el('td', { class: 'acciones' });
        var bG = el('button', { class: 'btn btn-sm' }, '🔧 Gestionar'); bG.onclick = function () { openEventoDetalle('pendiente', r._id); };
        var bD = el('button', { class: 'btn btn-sm btn-danger', title: 'Eliminar pendiente', 'aria-label': 'Eliminar pendiente' }, '🗑️'); bD.onclick = function () { if (!confirm('¿Eliminar este pendiente?')) return; DB.registros.pendiente = DB.registros.pendiente.filter(function (x) { return x._id !== r._id; }); guardarDB(); renderSidebar(); renderPendientes(); };
        acc.appendChild(bG); acc.appendChild(document.createTextNode(' ')); acc.appendChild(bD);
        tr.appendChild(acc);
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); cont.appendChild(wrap);
    }
    search.addEventListener('input', pintar); selE.addEventListener('change', pintar); selT.addEventListener('change', pintar);
    pintar();
    card2.appendChild(body2); contentEl.appendChild(card2);
  }

  // --------------------------------------------------------------- Etapa view
  function renderEtapa(id) {
    var etapa = ETAPAS_BY_ID[id];
    setTitulo(etapa.icono + ' ' + etapa.nombre, etapa.via + ' · ' + (DB.registros[id].length) + ' registro(s)');
    contentEl.innerHTML = '';

    var editando = STATE.editId ? DB.registros[id].filter(function (r) { return r._id === STATE.editId; })[0] : null;
    // Semilla para nuevo registro (p. ej. al "Crear evento" desde un equipo).
    var seed = (!editando && STATE.prefill && STATE.prefill.etapaId === id) ? seedRecord(etapa, STATE.prefill.overlay) : null;
    STATE.prefill = null; // se consume una sola vez

    // --- Formulario
    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-head' }, [
      el('h3', {}, (editando ? 'Editar registro' : 'Nuevo registro') + ' · ' + etapa.nombre),
      el('span', { class: 'desc' }, seed ? ('Equipo precargado: ' + (seed.equipo.inv || '') + ' — ' + (seed.equipo.nombre || '')) : etapa.desc)
    ]));
    var body = el('div', { class: 'card-body' });
    var form = buildForm(etapa, editando || seed);
    body.appendChild(form.grid);

    var actions = el('div', { class: 'form-actions' });
    var btnGuardar = el('button', { class: 'btn btn-primary' }, editando ? '💾 Actualizar registro' : '➕ Guardar registro');
    btnGuardar.onclick = function () {
      try {
        var rec = collectForm(etapa, form.controls);
        if (id === 'mp') {
          var aviso = validarFechaMesMP(rec);
          if (aviso && !confirm(aviso + '\n\n¿Desea guardar de todos modos?')) return;
        }
        if (editando) {
          rec._id = editando._id; rec._stage = id; rec._createdAt = editando._createdAt; rec._updatedAt = new Date().toISOString();
          // Conserva la gestión del evento (tareas y bitácora) al editar sus campos.
          if (Array.isArray(editando.tareas)) rec.tareas = editando.tareas;
          if (Array.isArray(editando.actualizaciones)) rec.actualizaciones = editando.actualizaciones;
          var idx = DB.registros[id].findIndex(function (r) { return r._id === editando._id; });
          if (idx >= 0) DB.registros[id][idx] = rec; else DB.registros[id].push(rec);
          toast('Registro actualizado.', 'ok');
        } else {
          rec._id = uid(); rec._stage = id; rec._createdAt = new Date().toISOString();
          DB.registros[id].push(rec);
          toast('Registro de «' + etapa.nombre + '» creado.', 'ok');
        }
        autoaprenderEmpresa(rec);
        guardarDB();
        STATE.editId = null;
        renderEtapa(id);
        renderSidebar(); // refresca los contadores de trabajo abierto
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        toast(err.message, 'err');
      }
    };
    actions.appendChild(btnGuardar);

    if (editando) {
      var btnCancelar = el('button', { class: 'btn' }, 'Cancelar edición');
      btnCancelar.onclick = function () { STATE.editId = null; renderEtapa(id); };
      actions.appendChild(btnCancelar);
    } else {
      var btnLimpiar = el('button', { class: 'btn btn-ghost' }, 'Limpiar');
      btnLimpiar.onclick = function () { renderEtapa(id); };
      actions.appendChild(btnLimpiar);
    }
    body.appendChild(actions);
    card.appendChild(body);
    contentEl.appendChild(card);

    // --- Tabla de registros de la etapa
    var card2 = el('div', { class: 'card' });
    card2.appendChild(el('div', { class: 'card-head' }, [
      el('h3', {}, 'Registros de esta etapa'),
      el('span', { class: 'desc' }, DB.registros[id].length + ' en total')
    ]));
    var body2 = el('div', { class: 'card-body' });

    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Filtrar registros…' });
    toolbar.appendChild(search);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var btnExpEt = el('button', { class: 'btn' }, '⬇️ Exportar esta etapa');
    btnExpEt.onclick = function () { exportarEtapa(etapa); };
    toolbar.appendChild(btnExpEt);
    body2.appendChild(toolbar);

    var tablaCont = el('div');
    body2.appendChild(tablaCont);
    function pintarTabla() { tablaCont.innerHTML = ''; tablaCont.appendChild(buildTablaEtapa(etapa, search.value.trim().toLowerCase())); }
    search.addEventListener('input', pintarTabla);
    pintarTabla();

    card2.appendChild(body2);
    contentEl.appendChild(card2);
  }

  function recordHaystack(etapa, r) {
    var s = [r.folio, r.tecnico, fmtFecha(r.fecha), equipoCorto(r.equipo)];
    etapa.campos.forEach(function (c) {
      if (c.tipo === 'equipo' || c.key === 'folio' || c.key === 'tecnico' || c.key === 'fecha') return;
      if (r[c.key]) s.push(r[c.key]);
    });
    return s.join(' ').toLowerCase();
  }

  function buildTablaEtapa(etapa, filtro) {
    var registros = DB.registros[etapa.id].slice();
    registros.sort(function (a, b) {
      return cmpNat(a.folio, b.folio) || cmpNat(a.fecha, b.fecha) || (a._createdAt || '').localeCompare(b._createdAt || '');
    });
    if (filtro) registros = registros.filter(function (r) { return recordHaystack(etapa, r).indexOf(filtro) >= 0; });

    if (!registros.length) {
      return el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '📭'),
        el('div', {}, filtro ? 'No hay registros que coincidan con el filtro.' : 'Todavía no hay registros en esta etapa.')]);
    }

    // Columnas visibles: folio, fecha, equipo, demás campos (sin observaciones), observaciones, acciones
    var colsCampos = etapa.campos.filter(function (c) { return c.key !== 'observaciones'; });

    var wrap = el('div', { class: 'tabla-wrap' });
    var t = el('table', { class: 'data' });
    var headRow = el('tr');
    colsCampos.forEach(function (c) { headRow.appendChild(th(c.tipo === 'equipo' ? 'Equipo' : c.label)); });
    if (tieneObs(etapa)) headRow.appendChild(th('Observaciones'));
    headRow.appendChild(th('Acciones'));
    t.appendChild(el('thead', {}, headRow));

    var tb = el('tbody');
    registros.forEach(function (r) {
      var tr = el('tr');
      colsCampos.forEach(function (c) {
        if (c.tipo === 'equipo') tr.appendChild(td(equipoCorto(r.equipo) || '—'));
        else if (c.tipo === 'fecha') tr.appendChild(td(fmtFecha(r[c.key]) || '—'));
        else if (['via', 'estado', 'estado_equipo', 'resultado', 'estado_final', 'tipo_compra'].indexOf(c.key) >= 0)
          tr.appendChild(td(r[c.key] ? pillFor(c.key, r[c.key]) : '—'));
        else tr.appendChild(td(r[c.key] || '—'));
      });
      if (tieneObs(etapa)) {
        var obs = r.observaciones || '';
        tr.appendChild(td(obs.length > 60 ? (obs.slice(0, 60) + '…') : (obs || '—')));
      }
      var acc = el('td', { class: 'acciones' });
      var bGes = el('button', { class: 'btn btn-sm', title: 'Gestionar (tareas y actualizaciones)', 'aria-label': 'Gestionar tareas y actualizaciones' }, '🔧');
      bGes.onclick = function () { openEventoDetalle(etapa.id, r._id); };
      var bEd = el('button', { class: 'btn btn-sm' }, '✏️ Editar');
      bEd.onclick = function () { STATE.editId = r._id; renderEtapa(etapa.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      var bDel = el('button', { class: 'btn btn-sm btn-danger', title: 'Eliminar registro', 'aria-label': 'Eliminar registro' }, '🗑️');
      bDel.onclick = function () {
        if (!confirm('¿Eliminar este registro de «' + etapa.nombre + '»? Esta acción no se puede deshacer.')) return;
        DB.registros[etapa.id] = DB.registros[etapa.id].filter(function (x) { return x._id !== r._id; });
        guardarDB(); toast('Registro eliminado.'); renderEtapa(etapa.id); renderSidebar();
      };
      acc.appendChild(bGes); acc.appendChild(document.createTextNode(' ')); acc.appendChild(bEd); acc.appendChild(document.createTextNode(' ')); acc.appendChild(bDel);
      tr.appendChild(acc);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }
  function tieneObs(etapa) { return etapa.campos.some(function (c) { return c.key === 'observaciones'; }); }

  // ------------------------------------------------------------ Todos los reg.
  function renderTodos() {
    setTitulo('🗂️ Todos los registros', totalRegistros() + ' registros · bitácora general');
    contentEl.innerHTML = '';

    var card = el('div', { class: 'card' });
    var body = el('div', { class: 'card-body' });

    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Buscar en todos los registros…' });
    var selEtapa = el('select');
    selEtapa.appendChild(el('option', { value: '' }, 'Todas las etapas'));
    ETAPAS.forEach(function (e) { selEtapa.appendChild(el('option', { value: e.id }, e.nombre)); });
    toolbar.appendChild(search);
    toolbar.appendChild(selEtapa);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var note = el('span', { class: 'count-note' });
    toolbar.appendChild(note);
    body.appendChild(toolbar);

    var cont = el('div');
    body.appendChild(cont);

    function pintar() {
      var rows = bitacoraRows();
      var f = search.value.trim().toLowerCase();
      var etf = selEtapa.value;
      rows = rows.filter(function (x) {
        if (etf && x.et.id !== etf) return false;
        if (!f) return true;
        return x._hay.indexOf(f) >= 0;
      });
      note.textContent = rows.length + ' registro(s)';
      cont.innerHTML = '';
      if (!rows.length) { cont.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🔎'), el('div', {}, 'Sin resultados.')])); return; }

      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [
        th('Folio'), th('Fecha'), th('Etapa'), th('Vía'), th('Inventario'), th('Equipo'), th('Servicio'),
        th('Técnico'), th('Estado / Resultado'), th('Empresa'), th('N° documento'), th('Acciones')
      ])));
      var tb = el('tbody');
      rows.forEach(function (x) {
        var r = x.r;
        var tr = el('tr');
        tr.appendChild(td(r.folio || '—'));
        tr.appendChild(td(fmtFecha(r.fecha) || '—'));
        tr.appendChild(td(el('span', { class: 'tag-etapa' }, x.et.nombre)));
        tr.appendChild(td(x.et.via));
        tr.appendChild(td(r.equipo ? (r.equipo.inv || '—') : '—'));
        tr.appendChild(td(r.equipo ? (r.equipo.nombre || '—') : '—'));
        tr.appendChild(td(r.equipo ? (r.equipo.servicio || '—') : '—'));
        tr.appendChild(td(r.tecnico || '—'));
        tr.appendChild(td(estadoResultado(r) ? pillFor(estadoResultadoKey(r), estadoResultado(r)) : '—'));
        tr.appendChild(td(r.empresa || '—'));
        tr.appendChild(td(numeroDoc(r) || '—'));
        var acc = el('td', { class: 'acciones' });
        var bGes = el('button', { class: 'btn btn-sm', title: 'Gestionar' }, '🔧');
        bGes.onclick = function () { openEventoDetalle(x.et.id, r._id); };
        var bEd = el('button', { class: 'btn btn-sm', title: 'Editar' }, '✏️');
        bEd.onclick = function () { navegar(x.et.id, r._id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
        acc.appendChild(bGes); acc.appendChild(document.createTextNode(' ')); acc.appendChild(bEd);
        tr.appendChild(acc);
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      wrap.appendChild(t);
      cont.appendChild(wrap);
    }
    search.addEventListener('input', pintar);
    selEtapa.addEventListener('change', pintar);
    pintar();

    card.appendChild(body);
    contentEl.appendChild(card);
  }

  function bitacoraRows() {
    var rows = [];
    ETAPAS.forEach(function (et) {
      DB.registros[et.id].forEach(function (r) {
        rows.push({
          et: et, r: r,
          _hay: [r.folio, fmtFecha(r.fecha), et.nombre, et.via, r.equipo && r.equipo.inv, r.equipo && r.equipo.nombre,
            r.equipo && r.equipo.servicio, r.tecnico, estadoResultado(r), r.empresa, numeroDoc(r), r.observaciones]
            .filter(Boolean).join(' ').toLowerCase()
        });
      });
    });
    rows.sort(function (a, b) {
      return cmpNat(a.r.folio, b.r.folio) || cmpNat(a.r.fecha, b.r.fecha) || (a.et._orden - b.et._orden) ||
        (a.r._createdAt || '').localeCompare(b.r._createdAt || '');
    });
    return rows;
  }
  function estadoResultado(r) { return r.estado_pendiente || r.estado || r.estado_equipo || r.resultado || r.estado_final || r.via || ''; }
  function estadoResultadoKey(r) {
    if (r.estado_pendiente) return 'estado_pendiente';
    if (r.estado) return 'estado'; if (r.estado_equipo) return 'estado_equipo'; if (r.resultado) return 'resultado';
    if (r.estado_final) return 'estado_final'; if (r.via) return 'via'; return '';
  }
  function numeroDoc(r) { return r.numero_envio || r.numero_guia || r.numero_cotizacion || r.numero_informe || r.numero_oc || ''; }

  // ----------------------------------------------------------------- Config
  function renderConfig() {
    setTitulo('⚙️ Configuración', 'Técnicos, empresas y datos');
    contentEl.innerHTML = '';

    // Técnicos
    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, '👷 Técnicos'), el('span', { class: 'desc' }, 'Aparecen en la lista desplegable de todas las etapas.')]));
    var body = el('div', { class: 'card-body' });
    body.appendChild(el('div', { class: 'hint' }, 'Supervisión: ' + SUPERVISOR + '.'));
    var chips = el('div', { class: 'chips' });
    DB.config.tecnicos.forEach(function (t) {
      var chip = el('div', { class: 'chip' }, [el('span', {}, t), el('span', { class: 'x', title: 'Quitar' }, '✕')]);
      chip.querySelector('.x').onclick = function () {
        DB.config.tecnicos = DB.config.tecnicos.filter(function (x) { return x !== t; });
        guardarDB(); renderConfig();
      };
      chips.appendChild(chip);
    });
    body.appendChild(chips);
    var add = el('div', { class: 'inline-add' });
    var inp = el('input', { type: 'text', placeholder: 'Nombre del técnico…' });
    var btn = el('button', { class: 'btn btn-primary' }, 'Agregar');
    function addTec() {
      var v = inp.value.trim(); if (!v) return;
      if (DB.config.tecnicos.indexOf(v) < 0) DB.config.tecnicos.push(v);
      DB.config.tecnicos.sort(cmpNat); guardarDB(); renderConfig();
    }
    btn.onclick = addTec; inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') addTec(); });
    add.appendChild(inp); add.appendChild(btn);
    body.appendChild(add);
    card.appendChild(body);
    contentEl.appendChild(card);

    // Empresas
    var card2 = el('div', { class: 'card' });
    card2.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, '🏢 Empresas / proveedores'), el('span', { class: 'desc' }, 'Sugerencias para los campos de empresa.')]));
    var body2 = el('div', { class: 'card-body' });
    var chips2 = el('div', { class: 'chips' });
    if (!DB.config.empresas.length) chips2.appendChild(el('div', { class: 'hint' }, 'Aún no hay empresas. Se agregan automáticamente al registrarlas o puede añadirlas aquí.'));
    DB.config.empresas.slice().sort(cmpNat).forEach(function (t) {
      var chip = el('div', { class: 'chip' }, [el('span', {}, t), el('span', { class: 'x', title: 'Quitar' }, '✕')]);
      chip.querySelector('.x').onclick = function () {
        DB.config.empresas = DB.config.empresas.filter(function (x) { return x !== t; });
        guardarDB(); renderConfig();
      };
      chips2.appendChild(chip);
    });
    body2.appendChild(chips2);
    var add2 = el('div', { class: 'inline-add' });
    var inp2 = el('input', { type: 'text', placeholder: 'Nombre de la empresa…' });
    var btn2 = el('button', { class: 'btn btn-primary' }, 'Agregar');
    function addEmp() {
      var v = inp2.value.trim(); if (!v) return;
      if (DB.config.empresas.indexOf(v) < 0) DB.config.empresas.push(v);
      guardarDB(); renderConfig();
    }
    btn2.onclick = addEmp; inp2.addEventListener('keydown', function (e) { if (e.key === 'Enter') addEmp(); });
    add2.appendChild(inp2); add2.appendChild(btn2);
    body2.appendChild(add2);
    card2.appendChild(body2);
    contentEl.appendChild(card2);

    // Datos
    var card3 = el('div', { class: 'card' });
    card3.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, '💾 Datos y respaldo'), el('span', { class: 'desc' }, getEquipos().length + ' equipos críticos en el inventario.')]));
    var body3 = el('div', { class: 'card-body' });
    body3.appendChild(el('div', { class: 'hint' }, 'Los registros se guardan localmente en este navegador (localStorage). Use el respaldo para trasladarlos a otro equipo.'));
    var actions = el('div', { class: 'form-actions' });

    var bExport = el('button', { class: 'btn btn-success' }, '⬇️ Exportar a Excel (.xlsx)');
    bExport.onclick = exportarTodo;
    var bBackup = el('button', { class: 'btn' }, '🗄️ Descargar respaldo (JSON)');
    bBackup.onclick = exportarRespaldo;
    var bRestore = el('button', { class: 'btn' }, '📤 Restaurar respaldo (JSON)');
    bRestore.onclick = importarRespaldo;
    var bClear = el('button', { class: 'btn btn-danger' }, '🗑️ Borrar todos los registros');
    bClear.onclick = function () {
      if (!confirm('¿Borrar TODOS los registros? Esta acción no se puede deshacer. Se recomienda descargar un respaldo antes.')) return;
      ETAPAS.forEach(function (e) { DB.registros[e.id] = []; });
      guardarDB(); toast('Registros eliminados.'); navegar('__dashboard');
    };
    actions.appendChild(bExport); actions.appendChild(bBackup); actions.appendChild(bRestore); actions.appendChild(bClear);
    body3.appendChild(actions);
    card3.appendChild(body3);
    contentEl.appendChild(card3);
  }

  function autoaprenderEmpresa(rec) {
    if (rec.empresa && DB.config.empresas.indexOf(rec.empresa) < 0) DB.config.empresas.push(rec.empresa);
  }

  // ------------------------------------------------------------- Respaldo JSON
  function exportarRespaldo() {
    var blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: 'Respaldo_Gestion_Equipos_' + hoyISO() + '.json' });
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    toast('Respaldo descargado.', 'ok');
  }
  function importarRespaldo() {
    var inp = el('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = function () {
      var file = inp.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data.registros) throw new Error('Archivo no válido.');
          if (!confirm('Esto reemplazará los registros actuales por los del respaldo. ¿Continuar?')) return;
          DB = data;
          DB.config = DB.config || {};
          if (!DB.config.tecnicos || !DB.config.tecnicos.length) DB.config.tecnicos = TECNICOS_DEFAULT.slice();
          if (!DB.config.empresas) DB.config.empresas = [];
          if (!DB.equiposOverrides || typeof DB.equiposOverrides !== 'object') DB.equiposOverrides = {};
          ETAPAS.forEach(function (e) { if (!Array.isArray(DB.registros[e.id])) DB.registros[e.id] = []; });
          invalidarEquipos(); // el inventario puede traer overrides distintos
          guardarDB(); toast('Respaldo restaurado.', 'ok'); navegar('__dashboard');
        } catch (e) { toast('No se pudo leer el respaldo: ' + e.message, 'err'); }
      };
      reader.readAsText(file);
    };
    inp.click();
  }

  // ----------------------------------------------------------- Export a Excel
  function columnasExport(etapa) {
    var cols = [];
    etapa.campos.forEach(function (c) {
      if (c.tipo === 'equipo') {
        cols.push({ titulo: 'N° Inventario', ancho: 14, get: function (r) { return r[c.key] ? (r[c.key].inv || '') : ''; } });
        cols.push({ titulo: 'Equipo', ancho: 20, get: function (r) { return r[c.key] ? (r[c.key].nombre || '') : ''; } });
        cols.push({ titulo: 'Servicio', ancho: 22, get: function (r) { return r[c.key] ? (r[c.key].servicio || '') : ''; } });
        cols.push({ titulo: 'Unidad', ancho: 18, get: function (r) { return r[c.key] ? (r[c.key].unidad || '') : ''; } });
        cols.push({ titulo: 'Ubicación', ancho: 18, get: function (r) { return r[c.key] ? (r[c.key].ubicacion || '') : ''; } });
        cols.push({ titulo: 'Marca / Modelo', ancho: 22, get: function (r) { return r[c.key] ? [r[c.key].marca, r[c.key].modelo].filter(Boolean).join(' ') : ''; } });
        cols.push({ titulo: 'Serie', ancho: 16, get: function (r) { return r[c.key] ? (r[c.key].serie || '') : ''; } });
      } else {
        var label = c.label;
        var key = c.key;
        cols.push({
          titulo: label, ancho: c.ancho || 16, get: (function (kk, tipo) {
            return function (r) { return tipo === 'fecha' ? fmtFecha(r[kk]) : (r[kk] != null ? r[kk] : ''); };
          })(key, c.tipo)
        });
      }
    });
    cols.push({ titulo: 'Registrado el', ancho: 18, get: function (r) { return fmtFechaHora(r._createdAt); } });
    return cols;
  }

  function hojaEtapa(etapa) {
    var registros = DB.registros[etapa.id].slice();
    registros.sort(function (a, b) {
      return cmpNat(a.folio, b.folio) || cmpNat(a.fecha, b.fecha) || (a._createdAt || '').localeCompare(b._createdAt || '');
    });
    var cols = columnasExport(etapa);
    return {
      nombre: etapa.nombre,
      columnas: cols.map(function (c) { return { titulo: c.titulo, ancho: c.ancho }; }),
      filas: registros.map(function (r) { return cols.map(function (c) { return c.get(r); }); })
    };
  }

  function hojaBitacora() {
    var rows = bitacoraRows();
    var cols = [
      { titulo: 'Folio', ancho: 14, get: function (x) { return x.r.folio || ''; } },
      { titulo: 'Fecha', ancho: 12, get: function (x) { return fmtFecha(x.r.fecha); } },
      { titulo: 'Etapa', ancho: 26, get: function (x) { return x.et.nombre; } },
      { titulo: 'Vía', ancho: 12, get: function (x) { return x.et.via; } },
      { titulo: 'N° Inventario', ancho: 14, get: function (x) { return x.r.equipo ? (x.r.equipo.inv || '') : ''; } },
      { titulo: 'Equipo', ancho: 20, get: function (x) { return x.r.equipo ? (x.r.equipo.nombre || '') : ''; } },
      { titulo: 'Servicio', ancho: 22, get: function (x) { return x.r.equipo ? (x.r.equipo.servicio || '') : ''; } },
      { titulo: 'Serie', ancho: 16, get: function (x) { return x.r.equipo ? (x.r.equipo.serie || '') : ''; } },
      { titulo: 'Técnico', ancho: 24, get: function (x) { return x.r.tecnico || ''; } },
      { titulo: 'Estado / Resultado', ancho: 18, get: function (x) { return estadoResultado(x.r); } },
      { titulo: 'Empresa', ancho: 22, get: function (x) { return x.r.empresa || ''; } },
      { titulo: 'N° documento', ancho: 16, get: function (x) { return numeroDoc(x.r); } },
      { titulo: 'Observaciones', ancho: 40, get: function (x) { return x.r.observaciones || ''; } },
      { titulo: 'Registrado el', ancho: 18, get: function (x) { return fmtFechaHora(x.r._createdAt); } }
    ];
    return {
      nombre: 'Bitácora general',
      columnas: cols.map(function (c) { return { titulo: c.titulo, ancho: c.ancho }; }),
      filas: rows.map(function (x) { return cols.map(function (c) { return c.get(x); }); })
    };
  }

  function hojaInventario() {
    var inv = calcInventario();
    inv.sort(function (a, b) { return cmpNat(a.e.id, b.e.id) || cmpNat(a.e.inventario, b.e.inventario); });
    var cols = [
      { titulo: 'ID', ancho: 8, get: function (x) { return x.e.id || ''; } },
      { titulo: 'N° Carpeta', ancho: 12, get: function (x) { return x.e.carpeta || ''; } },
      { titulo: 'N° Inventario', ancho: 14, get: function (x) { return x.e.inventario || ''; } },
      { titulo: 'Equipo', ancho: 20, get: function (x) { return x.e.equipo || ''; } },
      { titulo: 'Servicio', ancho: 22, get: function (x) { return x.e.servicio || ''; } },
      { titulo: 'Unidad', ancho: 18, get: function (x) { return x.e.unidad || ''; } },
      { titulo: 'Ubicación', ancho: 18, get: function (x) { return x.e.ubicacion || ''; } },
      { titulo: 'Procedencia', ancho: 14, get: function (x) { return x.e.procedencia || ''; } },
      { titulo: 'Marca', ancho: 16, get: function (x) { return x.e.marca || ''; } },
      { titulo: 'Modelo', ancho: 20, get: function (x) { return x.e.modelo || ''; } },
      { titulo: 'Serie', ancho: 16, get: function (x) { return x.e.serie || ''; } },
      { titulo: 'Año instalación', ancho: 14, get: function (x) { return x.e.anio || ''; } },
      { titulo: 'Clasificación', ancho: 16, get: function (x) { return x.e.clasificacion || ''; } },
      { titulo: 'Estado actual', ancho: 16, get: function (x) { return x.estado; } },
      { titulo: 'Última actualización', ancho: 18, get: function (x) { return fmtFecha(x.ultima); } },
      { titulo: 'N° registros', ancho: 12, get: function (x) { return x.n; } }
    ];
    return {
      nombre: 'Inventario',
      columnas: cols.map(function (c) { return { titulo: c.titulo, ancho: c.ancho }; }),
      filas: inv.map(function (x) { return cols.map(function (c) { return c.get(x); }); })
    };
  }

  function exportarInventario() {
    try {
      XLSXWriter.descargar('Inventario_Equipos_' + hoyISO() + '.xlsx', [hojaInventario()]);
      toast('Inventario exportado a Excel.', 'ok');
    } catch (e) { toast('Error al exportar: ' + e.message, 'err'); }
  }

  function exportarTodo() {
    if (totalRegistros() === 0) { toast('No hay registros para exportar.', 'err'); return; }
    var hojas = [hojaBitacora(), hojaInventario()];
    ETAPAS.forEach(function (et) { if (DB.registros[et.id].length) hojas.push(hojaEtapa(et)); });
    try {
      XLSXWriter.descargar('Registros_Gestion_Equipos_' + hoyISO() + '.xlsx', hojas);
      toast('Exportado a Excel (' + hojas.length + ' hojas).', 'ok');
    } catch (e) { toast('Error al exportar: ' + e.message, 'err'); }
  }

  function exportarEtapa(etapa) {
    if (!DB.registros[etapa.id].length) { toast('No hay registros en esta etapa.', 'err'); return; }
    try {
      XLSXWriter.descargar(etapa.nombre.replace(/[^\wáéíóúñ ]/gi, '').trim().replace(/\s+/g, '_') + '_' + hoyISO() + '.xlsx', [hojaEtapa(etapa)]);
      toast('Etapa exportada a Excel.', 'ok');
    } catch (e) { toast('Error al exportar: ' + e.message, 'err'); }
  }

  // ------------------------------------------------- Mantenciones Preventivas
  function renderMPImport() {
    setTitulo('📥 Importar programación MP', 'Mantenciones preventivas · genera eventos «una fila por evento»');
    contentEl.innerHTML = '';

    if (!window.XLSX || !window.EventosMP) {
      contentEl.appendChild(el('div', { class: 'banner' }, 'No se pudo cargar el lector de Excel (vendor-xlsx.js / eventos_mp.js). Verifica que ambos archivos acompañen a la aplicación.'));
      return;
    }

    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-head' }, [
      el('h3', {}, 'Cargar Programación de Mantenciones Preventivas (.xlsm)'),
      el('span', { class: 'desc' }, 'Se procesan las dos primeras hojas: Carta Gantt + Registro. Todo ocurre en tu navegador.')
    ]));
    var body = el('div', { class: 'card-body' });

    var drop = el('div', { class: 'dropzone' }, [
      el('div', { class: 'big' }, '📄'),
      el('div', {}, 'Arrastra aquí tu archivo .xlsm / .xlsx, o haz clic para seleccionarlo')
    ]);
    var input = el('input', { type: 'file', accept: '.xlsm,.xlsx,.xls', style: 'display:none' });
    drop.appendChild(input);
    drop.onclick = function () { input.click(); };
    input.onchange = function () { if (input.files[0]) procesarArchivoMP(input.files[0]); };
    ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('hover'); }); });
    ['dragleave'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('hover'); }); });
    drop.addEventListener('drop', function (ev) { ev.preventDefault(); drop.classList.remove('hover'); if (ev.dataTransfer.files[0]) procesarArchivoMP(ev.dataTransfer.files[0]); });
    body.appendChild(drop);
    body.appendChild(el('div', { class: 'mp-status', id: 'mp-status' }));
    card.appendChild(body);
    contentEl.appendChild(card);

    contentEl.appendChild(el('div', { id: 'mp-result' }));

    // Si ya se procesó un archivo en esta sesión, re-muestra el resultado.
    if (MP_STATE.events) renderMPResultado(MP_STATE.stats, MP_STATE.events);
  }

  function procesarArchivoMP(file) {
    var st = document.getElementById('mp-status');
    st.innerHTML = '⏳ Leyendo «' + esc(file.name) + '»…';
    var reader = new FileReader();
    reader.onload = function (ev) {
      setTimeout(function () {
        try {
          var data = new Uint8Array(ev.target.result);
          var wb = window.XLSX.read(data, { type: 'array' });
          var out = window.EventosMP.transform(wb);
          MP_STATE.events = out.events; MP_STATE.year = out.stats.year; MP_STATE.stats = out.stats;
          MP_STATE.equipos = window.EventosMP.extractEquipos(wb);
          st.innerHTML = '✅ <strong>' + out.stats.total + '</strong> eventos generados desde «' + esc(file.name) + '» (' + MP_STATE.equipos.length + ' equipos en el Gantt).';
          renderMPResultado(out.stats, out.events);
        } catch (err) {
          st.innerHTML = '❌ Error: ' + esc(err && err.message ? err.message : err) + ' — verifica que sea la Programación MP con al menos dos hojas (Gantt + Registro).';
          document.getElementById('mp-result').innerHTML = '';
        }
      }, 20);
    };
    reader.onerror = function () { st.innerHTML = '❌ No se pudo leer el archivo.'; };
    reader.readAsArrayBuffer(file);
  }

  function mpStatBox(n, l) { return el('div', { class: 'stat' }, [el('div', { class: 'n' }, String(n)), el('div', { class: 'l' }, l)]); }

  function renderMPResultado(stats, events) {
    var cont = document.getElementById('mp-result'); if (!cont) return;
    cont.innerHTML = '';
    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-head' }, [
      el('h3', {}, 'Resultado'),
      el('span', { class: 'desc' }, (stats.year ? ('Año ' + stats.year + ' · ') : '') + stats.total + ' eventos · ' + stats.nGantt + ' equipos en el Gantt')
    ]));
    var body = el('div', { class: 'card-body' });

    var actions = el('div', { class: 'form-actions' });
    var bImp = el('button', { class: 'btn btn-primary' }, '🔄 Actualizar inventario e importar mantenciones');
    bImp.onclick = function () { actualizarEImportarMP(); };
    var bDl = el('button', { class: 'btn' }, '⬇️ Descargar Eventos_MP' + (stats.year ? ('_' + stats.year) : '') + '.xlsx');
    bDl.onclick = function () { descargarEventosMP(events, stats.year); };
    actions.appendChild(bImp); actions.appendChild(bDl);
    body.appendChild(actions);
    body.appendChild(el('div', { class: 'hint' }, 'Al actualizar, se refrescan los datos de los equipos del inventario con los del Gantt y se registran las mantenciones preventivas (los eventos existentes del mismo equipo/año/mes/tipo se actualizan, no se duplican).'));

    body.appendChild(el('h4', { style: 'margin:14px 0 6px;font-size:13.5px' }, 'Por tipo'));
    var g1 = el('div', { class: 'stat-grid' });
    ['X', 'R', 'RA', 'PM'].forEach(function (t) { if (stats.byTipo[t]) g1.appendChild(mpStatBox(stats.byTipo[t], 'Tipo ' + t)); });
    body.appendChild(g1);

    body.appendChild(el('h4', { style: 'margin:14px 0 6px;font-size:13.5px' }, 'Por resultado'));
    var g2 = el('div', { class: 'stat-grid' });
    Object.keys(stats.byRes).sort().forEach(function (r) { g2.appendChild(mpStatBox(stats.byRes[r], r)); });
    body.appendChild(g2);

    if (stats.bajaFuera && stats.bajaFuera.length) {
      body.appendChild(el('div', { class: 'banner' }, 'Bajas que quedaron fuera (sin evento planificado en el Gantt): ' + stats.bajaFuera.length + '. Bajas incluidas: ' + stats.bajaIncluidas + '.'));
    }

    body.appendChild(el('h4', { style: 'margin:14px 0 6px;font-size:13.5px' }, 'Vista previa (primeras 20 filas)'));
    var wrap = el('div', { class: 'tabla-wrap' });
    var t = el('table', { class: 'data' });
    t.appendChild(el('thead', {}, el('tr', {}, window.EventosMP.OUT_HEADERS.map(function (h) { return th(h); }))));
    var tb = el('tbody');
    events.slice(0, 20).forEach(function (row) {
      tb.appendChild(el('tr', {}, row.map(function (v, ci) {
        return (ci === 14 || ci === 15) ? td(v ? pillFor(ci === 15 ? 'resultado' : 'tipo', v) : '—') : td(v == null ? '' : String(v));
      })));
    });
    t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);

    card.appendChild(body); cont.appendChild(card);
  }

  function descargarEventosMP(events, year) {
    var E = window.EventosMP;
    var nombre = year ? ('Eventos_MP_' + year) : 'Eventos_MP';
    var hojaEv = { nombre: nombre, columnas: E.OUT_HEADERS.map(function (h, i) { return { titulo: h, ancho: E.OUT_WIDTHS[i] }; }), filas: events };
    var hojaLeg = { nombre: 'Leyenda', columnas: [{ titulo: 'Código', ancho: 14 }, { titulo: 'Descripción', ancho: 90 }], filas: E.LEYENDA };
    try { XLSXWriter.descargar(nombre + '.xlsx', [hojaEv, hojaLeg]); toast('Eventos MP exportados a Excel.', 'ok'); }
    catch (e) { toast('Error al exportar: ' + e.message, 'err'); }
  }

  function mpFecha(anio, mes) {
    var n = window.EventosMP.mesANumero(mes);
    if (!anio || !n) return '';
    return anio + '-' + String(n).padStart(2, '0') + '-01';
  }
  function mpKey(r) { return [r.equipo && r.equipo.inv, r.anio, r.mes, r.tipo].join('|'); }

  // Valida que la fecha de una mantención preventiva concuerde con el mes (y año)
  // programado. Devuelve un mensaje de aviso, o '' si todo coincide.
  function validarFechaMesMP(rec) {
    if (!rec || !rec.fecha) return '';
    var MES = (window.EventosMP && window.EventosMP.MESES) || ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var mFecha = parseInt(String(rec.fecha).slice(5, 7), 10);   // 1..12
    var yFecha = String(rec.fecha).slice(0, 4);
    var avisos = [];
    if (rec.mes) {
      var mProg = window.EventosMP ? window.EventosMP.mesANumero(rec.mes) : 0;
      if (mProg && mFecha && mFecha !== mProg) {
        avisos.push('La fecha indicada corresponde a ' + (MES[mFecha - 1] || ('mes ' + mFecha)) +
          ', pero el mes programado es «' + rec.mes + '».');
      }
    }
    if (rec.anio && yFecha && String(rec.anio).trim() !== yFecha) {
      avisos.push('El año de la fecha (' + yFecha + ') no coincide con el año programado (' + rec.anio + ').');
    }
    return avisos.join('\n');
  }

  // Importa eventos como registros MP (sin guardar/navegar); devuelve conteos.
  function importarEventosMP(events, year) {
    var idx = {};
    DB.registros.mp.forEach(function (r) { idx[mpKey(r)] = r; });
    var nuevos = 0, actualizados = 0;
    (events || []).forEach(function (ev) {
      var equipo = { inv: ev[2], nombre: ev[3], servicio: ev[4], unidad: ev[5], ubicacion: ev[6], marca: ev[8], modelo: ev[9], serie: ev[10] };
      var mes = ev[13], tipo = ev[14], resultado = ev[15];
      var anio = year ? String(year) : '';
      var fecha = mpFecha(anio, mes);
      var key = [equipo.inv, anio, mes, tipo].join('|');
      var ex = idx[key];
      if (ex) { ex.resultado = resultado; ex.fecha = fecha; ex.equipo = equipo; ex.anio = anio; ex._updatedAt = new Date().toISOString(); actualizados++; }
      else {
        var rec = { _id: uid(), _stage: 'mp', _createdAt: new Date().toISOString(), equipo: equipo, fecha: fecha, anio: anio, mes: mes, tipo: tipo, resultado: resultado, observaciones: '', tareas: [], actualizaciones: [] };
        DB.registros.mp.push(rec); idx[key] = rec; nuevos++;
      }
    });
    return { nuevos: nuevos, actualizados: actualizados };
  }

  // Acción principal del módulo MP: actualiza el inventario + importa las mantenciones.
  function actualizarEImportarMP() {
    if (!MP_STATE.events) { toast('Primero carga un archivo .xlsm.', 'err'); return; }
    if (!confirm('Esto actualizará los datos de los equipos del inventario con los del Gantt y registrará las mantenciones preventivas (actualiza, no duplica). ¿Continuar?')) return;
    var resEq = actualizarEquipos(MP_STATE.equipos || []);
    var resEv = importarEventosMP(MP_STATE.events, MP_STATE.year);
    guardarDB();
    toast('Inventario: ' + resEq.actualizados + ' actualizados, ' + resEq.nuevos + ' nuevos · Mantenciones: ' + resEv.nuevos + ' nuevas, ' + resEv.actualizados + ' actualizadas.', 'ok');
    navegar('__inventario');
  }

  // ------------------------------------------------------------------- Init
  function init() {
    contentEl = document.getElementById('content');
    viewTitleEl = document.getElementById('viewTitle');
    viewSubEl = document.getElementById('viewSub');

    document.getElementById('btnExport').onclick = exportarTodo;
    var mt = document.getElementById('menuToggle');
    var sb = document.getElementById('sidebar');
    var bd = document.getElementById('backdrop');
    mt.onclick = function () {
      var abierto = sb.classList.toggle('open'); bd.classList.toggle('show');
      mt.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    };
    bd.onclick = function () { sb.classList.remove('open'); bd.classList.remove('show'); mt.setAttribute('aria-expanded', 'false'); };

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
