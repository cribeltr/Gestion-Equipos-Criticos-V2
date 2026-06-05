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
        { key: 'estado_equipo', label: 'Estado del equipo', tipo: 'select', opciones: ['Operativo', 'No operativo', 'Baja'], ancho: 16 },
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
        { key: 'estado_equipo', label: 'Estado del equipo', tipo: 'select', opciones: ['No operativo', 'Operativo', 'Baja'], def: 'No operativo', ancho: 16 },
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
        { key: 'resultado', label: 'Resultado', tipo: 'select', req: true, opciones: ['Operativo', 'No operativo', 'Baja'], ancho: 16 },
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
        { key: 'estado_final', label: 'Estado final', tipo: 'select', opciones: ['Operativo', 'No operativo', 'Baja'], def: 'Operativo', ancho: 16 },
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
        { key: 'fecha', label: 'Fecha', tipo: 'fecha', req: true, ancho: 14, hint: 'El año y el mes se calculan automáticamente desde la fecha.' },
        { key: 'tecnico', label: 'Ejecutor', tipo: 'tecnico', ancho: 24 },
        { key: 'anio', label: 'Año', tipo: 'text', ancho: 8, derivado: 'anio' },
        { key: 'mes', label: 'Mes', tipo: 'select', opciones: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], ancho: 8, derivado: 'mes' },
        { key: 'tipo', label: 'Tipo', tipo: 'select', opciones: ['X', 'R', 'RA', 'PM'], ancho: 8, hint: 'X programada · R reprogramada · RA año anterior · PM puesta en marcha' },
        { key: 'resultado', label: 'Resultado', tipo: 'select', opciones: ['Si', 'No', 'Baja', 'NU', 'Pendiente', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'], ancho: 12 },
        { key: 'estado_equipo', label: 'Estado del equipo', tipo: 'select', opciones: ['Operativo', 'No operativo', 'En servicio técnico', 'Baja'], ancho: 16, hint: 'Si lo dejas vacío, se deduce del resultado.' },
        { key: 'observaciones', label: 'Observaciones', tipo: 'textarea', col: 'full', ancho: 40 }
      ]
    },
    {
      id: 'pendiente', nombre: 'Pendiente', icono: '⚠️',
      grupo: 'Gestión', via: 'Pendiente',
      desc: 'Asunto pendiente asociado a un equipo, con seguimiento (estado, tareas y actualizaciones).',
      campos: [
        { key: 'equipo', label: 'Equipo (listado crítico)', tipo: 'equipo', col: 'full' },
        { key: 'tipo', label: 'Tipo de pendiente', tipo: 'select', req: true, opciones: ['Gestión general', 'Documento faltante', 'Reprogramación MP', 'Pauta de monitoreo', 'Firma', 'Reporte Interno', 'Reporte Externo', 'Otro'], ancho: 22 },
        { key: 'fecha', label: 'Fecha', tipo: 'fecha', req: true, ancho: 14 },
        { key: 'estado_pendiente', label: 'Estado', tipo: 'select', opciones: ['Pendiente', 'En proceso', 'Resuelto'], def: 'Pendiente', ancho: 14 },
        { key: 'tecnico', label: 'Ejecutor (técnico)', tipo: 'tecnico', ancho: 24, hint: 'Quien realiza el trabajo.' },
        { key: 'responsable', label: 'Responsable de seguimiento', tipo: 'tecnico', ancho: 24, def: SUPERVISOR, hint: 'Quien asegura que se haga (accountable).' },
        { key: 'fecha_resolucion', label: 'Fecha de compromiso', tipo: 'fecha', ancho: 16 },
        { key: 'observaciones', label: 'Descripción', tipo: 'textarea', col: 'full', ancho: 44 }
      ]
    }
  ];

  var ETAPAS_BY_ID = {};
  ETAPAS.forEach(function (e, i) { e._orden = i; ETAPAS_BY_ID[e.id] = e; });

  var GRUPOS_NAV = [
    { label: 'Inicio', items: ['__buscar', '__inventario'] },
    { label: 'Estado de equipos', items: ['__est_st', '__est_operativo', '__est_no_operativo', '__est_baja', '__pendientes', '__est_desconocido'] },
    { label: 'Mantención preventiva', items: ['__mp_import', 'mp'] },
    { label: 'Gestión', items: ['__seguimiento', '__foco', '__todos', '__config'] }
  ];
  // Nota: las etapas del flujo correctivo (solicitud, envío, estado_st, recepción,
  // diagnóstico, cotización, gestión_oc, emisión_oc, reparación, cierre) ya no
  // figuran en el panel izquierdo. Se registran desde el flujo del «Resumen» o
  // desde la ficha de cada equipo (botón «➕ Correctivo»). Siguen funcionando
  // por completo (edición, tablas, exportación y contadores).

  // Vistas del tablero de estado: cada una filtra el inventario al estado dado.
  var ESTADO_VIEWS = {
    '__est_st': 'Servicio técnico',
    '__est_operativo': 'Operativo',
    '__est_no_operativo': 'No operativo',
    '__est_baja': 'Baja',
    '__est_desconocido': 'Desconocido'
  };

  var EQUIPOS_BASE = window.EQUIPOS || [];

  // ----------------------------------------------------------------- Estado/DB
  var DB = cargarDB();
  var STATE = { view: '__buscar', editId: null, prefill: null, equipoSel: null };
  var WS = { form: null }; // estado del formulario inline en el espacio de trabajo del equipo
  var MP_STATE = { events: null, year: '', equipos: null, stats: null }; // último .xlsm procesado
  var INV_BUSQUEDA = ''; // recuerda el texto buscado en inventario/estados al navegar (sesión)

  // Marca de datos comprimidos: carácter de control (0x01) que no aparece ni en el
  // JSON (empieza por '{') ni en la salida de compressToUTF16 (códigos ≥ 32).
  // Función (no var) para que esté disponible aunque cargarDB() se llame antes
  // de esta línea durante la carga del módulo (hoisting de funciones).
  function lzMark() { return String.fromCharCode(1); }
  function tieneLZ() { return typeof window !== 'undefined' && window.LZString; }

  function cargarDB() {
    var db = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw != null) {
        var text = (raw.charAt(0) === lzMark() && tieneLZ()) ? window.LZString.decompressFromUTF16(raw.slice(1)) : raw;
        db = JSON.parse(text);
      }
    } catch (e) { db = null; }
    if (!db || typeof db !== 'object') db = {};
    if (!db.registros) db.registros = {};
    if (!db.config) db.config = {};
    if (!db.equiposOverrides || typeof db.equiposOverrides !== 'object') db.equiposOverrides = {};
    if (!Array.isArray(db.config.tecnicos) || !db.config.tecnicos.length) db.config.tecnicos = TECNICOS_DEFAULT.slice();
    if (!Array.isArray(db.config.empresas)) db.config.empresas = EMPRESAS_DEFAULT.slice();
    ETAPAS.forEach(function (e) { if (!Array.isArray(db.registros[e.id])) db.registros[e.id] = []; });
    return db;
  }

  // Intenta escribir el payload en localStorage. Devuelve 'ok', 'cuota' o
  // 'error:<mensaje>' para que quien llama decida cómo recuperarse.
  function intentarEscribirDB(payload) {
    try {
      localStorage.setItem(STORAGE_KEY, payload);
      return 'ok';
    } catch (e) {
      var esCuota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || /quota|exceeded/i.test(e.message || ''));
      return esCuota ? 'cuota' : ('error:' + (e && e.message ? e.message : e));
    }
  }
  // Libera almacenamiento NO esencial (claves heredadas de versiones previas)
  // para dejar sitio a la base de datos. No toca la BD ni el respaldo del usuario.
  // Devuelve true si liberó algo.
  function liberarEspacioNoEsencial() {
    var liberado = false;
    ['gec_rec', 'hhha_v1_data', 'hhha_v1'].forEach(function (k) {
      if (k === STORAGE_KEY) return;
      try { if (localStorage.getItem(k) != null) { localStorage.removeItem(k); liberado = true; } } catch (e) { }
    });
    return liberado;
  }
  var _quotaAvisado = false; // para no repetir el aviso de cuota en cada guardado

  // Guarda comprimido (cabe mucho más en la cuota de localStorage). Si se llena,
  // libera espacio no esencial y reintenta; si aun así falla, avisa UNA sola vez
  // (no en cada guardado) y devuelve false para que quien llama no muestre éxito.
  function guardarDB() {
    var json;
    try { json = JSON.stringify(DB); }
    catch (e) { toast('No se pudieron preparar los datos para guardar: ' + (e && e.message ? e.message : e), 'err'); return false; }
    var payload = tieneLZ() ? (lzMark() + window.LZString.compressToUTF16(json)) : json;

    var r = intentarEscribirDB(payload);
    if (r === 'ok') { _quotaAvisado = false; gsScheduleSync(); return true; }
    if (r.charAt(0) === 'e') { toast('No se pudo guardar localmente: ' + r.slice(6), 'err'); return false; }

    // Cuota excedida: liberar espacio no esencial y reintentar una vez.
    if (liberarEspacioNoEsencial() && intentarEscribirDB(payload) === 'ok') {
      _quotaAvisado = false;
      gsScheduleSync();
      toast('Almacenamiento casi lleno: se liberó espacio para poder guardar. Descargue un respaldo y libere espacio.', 'warn');
      return true;
    }
    if (!_quotaAvisado) {
      _quotaAvisado = true;
      toast('Almacenamiento local lleno: no se pudo guardar. Descargue un respaldo (Configuración → Descargar respaldo) y libere espacio, por ejemplo «Vaciar mantenciones preventivas».', 'err');
    }
    return false;
  }

  // Tamaño aproximado del almacenamiento usado por la app (en KB).
  function tamanoAlmacenamientoKB() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || '';
      return Math.round(raw.length * 2 / 1024); // ~2 bytes por code unit UTF-16
    } catch (e) { return 0; }
  }

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
  // Normaliza los ceros a la izquierda de cada número (p. ej. «00298» -> «298»).
  // Permite encontrar series guardadas sin sus ceros iniciales y viceversa.
  function normNum(s) {
    return String(s == null ? '' : s).replace(/\d+/g, function (d) { return d.replace(/^0+(\d)/, '$1'); });
  }

  // -------------------------------------------------------------- Búsqueda eq.
  function buscarEquipos(q, limite) {
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    var tokensN = tokens.map(normNum);
    var out = [];
    var EQ = getEquipos();
    for (var i = 0; i < EQ.length; i++) {
      var e = EQ[i];
      var hay = ((e.inventario || '') + ' ' + (e.equipo || '') + ' ' + (e.serie || '') + ' ' +
        (e.marca || '') + ' ' + (e.modelo || '') + ' ' + (e.servicio || '') + ' ' +
        (e.unidad || '') + ' ' + (e.ubicacion || '')).toLowerCase();
      var hayN = normNum(hay);
      var ok = true;
      for (var t = 0; t < tokens.length; t++) {
        if (hay.indexOf(tokens[t]) < 0 && hayN.indexOf(tokensN[t]) < 0) { ok = false; break; }
      }
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

  // ============================================ Google Sheets (sincronización)
  // Guarda la base en una Google Sheet mediante un "App web" de Apps Script.
  //  - Guardar: POST (intenta CORS; desde file:// recurre a 'no-cors' a ciegas).
  //  - Cargar / Probar: JSONP (etiqueta <script>) para evitar CORS desde file://.
  // La copia local en localStorage se mantiene como caché; Google Sheets es el
  // respaldo central. No se envían credenciales: el App web corre como el dueño.
  function gsCfg() {
    var c = DB.config.gs;
    if (!c || typeof c !== 'object') c = DB.config.gs = { url: '', auto: false };
    if (typeof c.url !== 'string') c.url = '';
    c.auto = !!c.auto;
    return c;
  }
  var _gsTimer = null;
  function horaCorta() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function gsActualizarChip(estado, txt) {
    var chip = document.getElementById('gsChip'); if (!chip) return;
    var span = document.getElementById('gsChipText');
    var cfg = gsCfg(), label, cls;
    chip.classList.remove('gs-saving', 'gs-ok', 'gs-err', 'gs-off');
    if (!cfg.url) { label = 'Local'; cls = 'gs-off'; }
    else if (estado === 'saving') { label = 'Guardando…'; cls = 'gs-saving'; }
    else if (estado === 'ok') { label = txt || 'Guardado'; cls = 'gs-ok'; }
    else if (estado === 'err') { label = txt || 'Error'; cls = 'gs-err'; }
    else { label = cfg.auto ? 'Sheets' : 'Sheets (manual)'; cls = 'gs-ok'; }
    chip.classList.add(cls);
    if (span) span.textContent = label; else chip.textContent = '☁️ ' + label;
  }
  // Filas legibles (encabezado + datos) para las hojas Registros e Inventario.
  function gsFilasRegistros() {
    var filas = [['Fecha', 'Etapa', 'Equipo', 'N° Inventario', 'Estado / Resultado', 'Ejecutor', 'Empresa', 'N° doc', 'Folio', 'Observaciones']];
    ETAPAS.forEach(function (et) {
      (DB.registros[et.id] || []).forEach(function (r) {
        filas.push([
          fmtFecha(r.fecha) || '', et.nombre,
          (r.equipo && r.equipo.nombre) || '', (r.equipo && r.equipo.inv) || '',
          estadoResultadoTexto(r) || '', r.tecnico || '', r.empresa || '',
          numeroDoc(r) || '', r.folio || '', r.observaciones || ''
        ]);
      });
    });
    return filas;
  }
  function gsFilasInventario() {
    var filas = [['ID', 'N° Inventario', 'Equipo', 'Servicio', 'Unidad', 'Ubicación', 'Marca', 'Modelo', 'Serie', 'Estado', 'Última actualización', 'N° registros']];
    calcInventario().forEach(function (x) {
      var e = x.e;
      filas.push([e.id || '', e.inventario || '', e.equipo || '', e.servicio || '', e.unidad || '', e.ubicacion || '', e.marca || '', e.modelo || '', e.serie || '', x.estado, x.ultima ? fmtFecha(x.ultima) : '', x.n]);
    });
    return filas;
  }
  function gsPayload() {
    var json = JSON.stringify(DB);
    var comp = tieneLZ();
    return JSON.stringify({
      datos: comp ? window.LZString.compressToUTF16(json) : json,
      comprimido: comp,
      registros: gsFilasRegistros(),
      inventario: gsFilasInventario(),
      rev: Date.now()
    });
  }
  // Empuja la BD a Google Sheets. manual=true muestra avisos.
  function gsPush(manual, cb) {
    var cfg = gsCfg();
    if (!cfg.url) { if (manual) toast('Configura primero la URL de Google Sheets (Configuración).', 'err'); cb && cb(false); return; }
    gsActualizarChip('saving');
    var body;
    try { body = gsPayload(); } catch (e) { gsActualizarChip('err'); if (manual) toast('No se pudo preparar el envío: ' + (e.message || e), 'err'); cb && cb(false); return; }
    var okFinal = function (confirmado) { gsActualizarChip('ok', (confirmado ? 'Guardado ' : 'Enviado ') + horaCorta()); if (manual) toast(confirmado ? 'Datos guardados en Google Sheets.' : 'Datos enviados a Google Sheets (sin confirmación de respuesta).', 'ok'); cb && cb(true); };
    var falla = function (msg) { gsActualizarChip('err', 'Sin guardar'); if (manual) toast('No se pudo guardar en Google Sheets: ' + (msg || 'error') + '.', 'err'); cb && cb(false); };
    // 1) Intento con CORS (respuesta confirmable).
    if (typeof fetch === 'function') {
      fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
        .then(function (r) { return r.text(); })
        .then(function (txt) { var j = {}; try { j = JSON.parse(txt); } catch (e) {} okFinal(!!(j && j.ok)); })
        .catch(function () {
          // 2) file:// u origen sin CORS: envío "a ciegas".
          fetch(cfg.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
            .then(function () { okFinal(false); })
            .catch(function (e) { falla(e && e.message); });
        });
    } else { falla('navegador sin fetch'); }
  }
  function gsScheduleSync() {
    var cfg = gsCfg();
    if (!cfg.url || !cfg.auto) return;
    if (_gsTimer) clearTimeout(_gsTimer);
    _gsTimer = setTimeout(function () { _gsTimer = null; gsPush(false); }, 2500);
  }
  // Lectura sin CORS mediante JSONP.
  function gsJsonp(action, onok, onerr) {
    var cfg = gsCfg();
    if (!cfg.url) { onerr && onerr('sin URL'); return; }
    var cbName = '__gscb_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    var sep = cfg.url.indexOf('?') >= 0 ? '&' : '?';
    var s = document.createElement('script');
    var limpiar = function () { try { delete window[cbName]; } catch (e) { window[cbName] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); };
    var to = setTimeout(function () { limpiar(); onerr && onerr('tiempo de espera agotado'); }, 25000);
    window[cbName] = function (data) { clearTimeout(to); limpiar(); onok && onok(data); };
    s.onerror = function () { clearTimeout(to); limpiar(); onerr && onerr('no se pudo conectar'); };
    s.src = cfg.url + sep + 'action=' + encodeURIComponent(action) + '&callback=' + cbName + '&t=' + Date.now();
    document.body.appendChild(s);
  }
  function gsNormalizarDB(data) {
    data.config = data.config || {};
    if (!Array.isArray(data.config.tecnicos) || !data.config.tecnicos.length) data.config.tecnicos = TECNICOS_DEFAULT.slice();
    if (!Array.isArray(data.config.empresas)) data.config.empresas = [];
    if (!data.equiposOverrides || typeof data.equiposOverrides !== 'object') data.equiposOverrides = {};
    data.registros = data.registros || {};
    ETAPAS.forEach(function (e) { if (!Array.isArray(data.registros[e.id])) data.registros[e.id] = []; });
    return data;
  }
  function gsPull(cb) {
    var cfg = gsCfg();
    if (!cfg.url) { toast('Configura primero la URL de Google Sheets.', 'err'); cb && cb(false); return; }
    if (!confirm('Cargar REEMPLAZARÁ los datos locales con los de Google Sheets. Se recomienda descargar un respaldo antes. ¿Continuar?')) { cb && cb(false); return; }
    gsActualizarChip('saving');
    gsJsonp('load', function (data) {
      try {
        if (!data || !data.ok) throw new Error((data && data.error) || 'respuesta inválida');
        var datos = data.datos || '';
        if (!datos) throw new Error('no hay datos guardados en la hoja todavía');
        var json = (data.comprimido === false) ? datos : (tieneLZ() ? window.LZString.decompressFromUTF16(datos) : datos);
        var nuevo = JSON.parse(json);
        if (!nuevo || !nuevo.registros) throw new Error('los datos de la hoja no son válidos');
        var conexion = (DB.config && DB.config.gs && DB.config.gs.url) ? DB.config.gs : null;
        DB = gsNormalizarDB(nuevo);
        if (conexion) DB.config.gs = conexion; // conserva la conexión (URL) de este equipo
        invalidarEquipos();
        guardarDB();
        gsActualizarChip('ok', 'Cargado ' + horaCorta());
        toast('Datos cargados desde Google Sheets.', 'ok');
        navegar('__buscar');
        cb && cb(true);
      } catch (e) { gsActualizarChip('err', 'Error'); toast('No se pudo cargar: ' + (e.message || e), 'err'); cb && cb(false); }
    }, function (err) { gsActualizarChip('err', 'Error'); toast('No se pudo conectar con Google Sheets: ' + err + '.', 'err'); cb && cb(false); });
  }
  function gsProbar() {
    var cfg = gsCfg();
    if (!cfg.url) { toast('Ingresa y guarda la URL primero.', 'err'); return; }
    gsActualizarChip('saving');
    gsJsonp('ping', function (data) {
      if (data && data.ok) { gsActualizarChip('ok', 'Conectado'); toast('Conexión correcta con Google Sheets. ' + (data.updated ? ('Último guardado: ' + data.updated) : 'Aún sin datos guardados.'), 'ok'); }
      else { gsActualizarChip('err', 'Error'); toast('El App web respondió de forma inesperada' + (data && data.error ? (': ' + data.error) : '') + '.', 'err'); }
    }, function (err) { gsActualizarChip('err', 'Error'); toast('No respondió: ' + err + '. Revisa la URL y que esté publicado para «Cualquiera».', 'err'); });
  }
  // Código de Apps Script que el usuario pega en su Google Sheet (App web).
  function gsAppsScriptCode() {
    return [
      "/** Gestion de Equipos Criticos - puente con Google Sheets.",
      " *  Pega esto en tu Google Sheet: Extensiones -> Apps Script (borra lo que",
      " *  haya y pega esto). Guarda. Luego: Implementar -> Nueva implementacion ->",
      " *  tipo 'App web', Ejecutar como: Yo, Con acceso: Cualquiera. Copia la URL",
      " *  que termina en /exec y pegala en la app (Configuracion). */",
      "var DATOS_TAB = '_gec_datos';",
      "var CHUNK = 45000;",
      "",
      "function doGet(e) {",
      "  var p = (e && e.parameter) || {}, cb = p.callback || '', out;",
      "  try {",
      "    if (p.action === 'ping') out = { ok: true, updated: prop_('updated'), registros: Number(prop_('rows') || 0) };",
      "    else out = { ok: true, datos: leerDatos_(), comprimido: (prop_('comp') !== 'no'), updated: prop_('updated') };",
      "  } catch (err) { out = { ok: false, error: String(err) }; }",
      "  return responder_(out, cb);",
      "}",
      "",
      "function doPost(e) {",
      "  var out;",
      "  try {",
      "    var body = JSON.parse(e.postData.contents);",
      "    guardarDatos_(String(body.datos || ''));",
      "    prop_('comp', body.comprimido ? 'si' : 'no');",
      "    if (body.registros) escribirHoja_('Registros', body.registros);",
      "    if (body.inventario) escribirHoja_('Inventario', body.inventario);",
      "    prop_('updated', new Date().toISOString());",
      "    prop_('rows', String(body.registros ? Math.max(0, body.registros.length - 1) : 0));",
      "    out = { ok: true, updated: prop_('updated') };",
      "  } catch (err) { out = { ok: false, error: String(err) }; }",
      "  return responder_(out, '');",
      "}",
      "",
      "function responder_(obj, cb) {",
      "  var js = JSON.stringify(obj);",
      "  if (cb) return ContentService.createTextOutput(cb + '(' + js + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);",
      "  return ContentService.createTextOutput(js).setMimeType(ContentService.MimeType.JSON);",
      "}",
      "function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }",
      "function prop_(k, v) { var ps = PropertiesService.getDocumentProperties(); if (v === undefined) return ps.getProperty(k); ps.setProperty(k, v); return v; }",
      "function tab_(name) { var ss = ss_(); return ss.getSheetByName(name) || ss.insertSheet(name); }",
      "function guardarDatos_(s) {",
      "  var sh = tab_(DATOS_TAB); sh.clear();",
      "  var rows = [], i = 0;",
      "  while (i < s.length) { rows.push([s.substr(i, CHUNK)]); i += CHUNK; }",
      "  if (!rows.length) rows = [['']];",
      "  sh.getRange(1, 1, rows.length, 1).setNumberFormat('@').setValues(rows);",
      "}",
      "function leerDatos_() {",
      "  var sh = ss_().getSheetByName(DATOS_TAB); if (!sh) return '';",
      "  var last = sh.getLastRow(); if (!last) return '';",
      "  return sh.getRange(1, 1, last, 1).getValues().map(function (r) { return r[0]; }).join('');",
      "}",
      "function escribirHoja_(name, filas) {",
      "  var sh = tab_(name); sh.clear();",
      "  if (!filas || !filas.length) return;",
      "  var n = filas[0].length;",
      "  filas = filas.map(function (r) { r = r.slice(0, n); while (r.length < n) r.push(''); return r; });",
      "  sh.getRange(1, 1, filas.length, n).setValues(filas);",
      "}"
    ].join('\n');
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
  function buildForm(etapa, record, opts) {
    opts = opts || {};
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
      // Campos derivados (p. ej. Año/Mes de MP): no se ingresan; se calculan
      // automáticamente desde la fecha. No se renderiza ningún control visible.
      if (campo.derivado) {
        controls[campo.key] = { get: function () {
          var f = ctx.fechaGet ? ctx.fechaGet() : '';
          if (!f) return '';
          if (campo.derivado === 'anio') return String(f).slice(0, 4);
          if (campo.derivado === 'mes') {
            var mnum = parseInt(String(f).slice(5, 7), 10);
            var MS = (window.EventosMP && window.EventosMP.MESES) || ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return MS[mnum - 1] || '';
          }
          return '';
        } };
        return;
      }
      var clazz = 'field' + (campo.col === 'full' ? ' col-full' : (campo.col === '2' ? ' col-2' : ''));
      var field = el('div', { class: clazz });
      var lbl = el('label', {}, campo.label + ' ');
      if (campo.req) lbl.appendChild(el('span', { class: 'req' }, '*'));
      field.appendChild(lbl);

      var ctrl;
      if (campo.tipo === 'equipo') {
        if (opts.equipoFijo) {
          // Espacio de trabajo del equipo: el equipo está fijado, no se elige.
          var eqf = opts.equipoFijo;
          field.appendChild(el('div', { class: 'equipo-fijo' }, [
            el('span', { class: 'ef-inv' }, eqf.inv || '(sin inventario)'),
            eqf.nombre ? el('span', { class: 'ef-nom' }, ' · ' + eqf.nombre) : null
          ]));
          ctx.equipoGet = function () { return eqf; };
          controls[campo.key] = { get: function () { return eqf; } };
        } else {
          var picker = buildEquipoPicker(record ? record[campo.key] : null, function () { actualizarFoliosForm(); });
          ctx.equipoGet = function () { return picker.get(); };
          field.appendChild(picker.wrap);
          controls[campo.key] = { get: function () { return picker.get(); } };
        }
      } else if (campo.tipo === 'tecnico') {
        ctrl = el('select');
        ctrl.appendChild(el('option', { value: '' }, '— Seleccionar técnico —'));
        DB.config.tecnicos.forEach(function (t) { ctrl.appendChild(el('option', { value: t }, t)); });
        if (record && record[campo.key]) {
          if (DB.config.tecnicos.indexOf(record[campo.key]) < 0) ctrl.appendChild(el('option', { value: record[campo.key] }, record[campo.key]));
          ctrl.value = record[campo.key];
        } else if (!record && campo.def) {
          if (DB.config.tecnicos.indexOf(campo.def) < 0) ctrl.appendChild(el('option', { value: campo.def }, campo.def));
          ctrl.value = campo.def;
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
        if (campo.key === 'fecha') ctx.fechaGet = function () { return ctrl.value; };
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

  // Inserta o actualiza un registro de una etapa y persiste. Conserva la gestión
  // del evento (tareas, bitácora y, en pendientes, foco/Eisenhower) al editar.
  // Devuelve lo que devuelva guardarDB() (true si realmente se guardó).
  function persistirRegistro(id, rec, editando) {
    if (id === 'mp') rec._origen = 'manual'; // editado/creado a mano: el import no lo sobrescribe
    if (editando) {
      rec._id = editando._id; rec._stage = id; rec._createdAt = editando._createdAt; rec._updatedAt = new Date().toISOString();
      if (Array.isArray(editando.tareas)) rec.tareas = editando.tareas;
      if (Array.isArray(editando.actualizaciones)) rec.actualizaciones = editando.actualizaciones;
      if (editando.foco != null) rec.foco = editando.foco;
      if (editando.eisen != null) rec.eisen = editando.eisen;
      var idx = DB.registros[id].findIndex(function (r) { return r._id === editando._id; });
      if (idx >= 0) DB.registros[id][idx] = rec; else DB.registros[id].push(rec);
    } else {
      rec._id = uid(); rec._stage = id; rec._createdAt = new Date().toISOString();
      if (!Array.isArray(rec.tareas)) rec.tareas = [];
      if (!Array.isArray(rec.actualizaciones)) rec.actualizaciones = [];
      DB.registros[id].push(rec);
    }
    autoaprenderEmpresa(rec);
    return guardarDB();
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
      else if (/^baja$/i.test(v)) cls = 'pill pill-baja';
      else if (/no operativo|^no$|^c3$/i.test(v)) cls = 'pill pill-no';
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
    configurarExport('Exportar a Excel', exportarTodo); // por defecto; cada vista lo ajusta
    if (STATE.view === '__buscar' || STATE.view === '__dashboard') renderBuscar();
    else if (STATE.view === '__inventario') renderInventario();
    else if (ESTADO_VIEWS[STATE.view]) renderInventario(ESTADO_VIEWS[STATE.view]);
    else if (STATE.view === '__mp_import') renderMPImport();
    else if (STATE.view === '__pendientes') renderPendientes();
    else if (STATE.view === '__seguimiento') renderSeguimiento();
    else if (STATE.view === '__foco') renderTripleFoco();
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
    var estCount = { 'Operativo': 0, 'No operativo': 0, 'Servicio técnico': 0, 'Baja': 0, 'Desconocido': 0 }, conEventos = 0;
    invCalc.forEach(function (x) { estCount[x.estado] = (estCount[x.estado] || 0) + 1; if (x.n > 0) conEventos++; });
    GRUPOS_NAV.forEach(function (g) {
      nav.appendChild(el('div', { class: 'group-label' }, g.label));
      g.items.forEach(function (id) {
        var label, icono, badge = null, badgeTitle = null;
        if (id === '__buscar') { label = 'Buscar equipo'; icono = '🔎'; }
        else if (id === '__inventario') { label = 'Inventario de equipos'; icono = '🩺'; badge = conEventos; badgeTitle = 'equipos con eventos'; }
        else if (id === '__est_st') { label = 'En servicio técnico'; icono = '🛠️'; badge = estCount['Servicio técnico']; badgeTitle = 'equipos en este estado'; }
        else if (id === '__est_operativo') { label = 'Operativos'; icono = '✅'; badge = estCount['Operativo']; badgeTitle = 'equipos en este estado'; }
        else if (id === '__est_no_operativo') { label = 'No operativos'; icono = '⛔'; badge = estCount['No operativo']; badgeTitle = 'equipos en este estado'; }
        else if (id === '__est_baja') { label = 'Baja'; icono = '🚫'; badge = estCount['Baja']; badgeTitle = 'equipos dados de baja'; }
        else if (id === '__est_desconocido') { label = 'Desconocido'; icono = '❔'; badge = estCount['Desconocido']; badgeTitle = 'equipos sin eventos'; }
        else if (id === '__mp_import') { label = 'Importar programación MP'; icono = '📥'; }
        else if (id === '__pendientes') { label = 'Pendientes'; icono = '⚠️'; badge = pendientesAbiertos(); badgeTitle = 'pendientes sin resolver'; }
        else if (id === '__todos') { label = 'Todos los registros'; icono = '🗂️'; badge = totalRegistros(); }
        else if (id === '__seguimiento') { label = 'Mi seguimiento'; icono = '👁️'; badge = pendientesVencidos(); badgeTitle = 'pendientes vencidos'; }
        else if (id === '__foco') { label = 'Triple Foco'; icono = '🎯'; badge = focoLista().length; badgeTitle = 'tareas en el foco de hoy'; }
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

  function th(t) { return el('th', {}, t); }
  function td(c) { return el('td', {}, [typeof c === 'object' && c ? c : document.createTextNode(c == null ? '' : String(c))]); }

  // ================================================= Buscar equipo (inicio)
  // Vista principal: una barra de búsqueda; al elegir un equipo se abre su
  // espacio de trabajo EN LA MISMA PANTALLA (mantenciones, pendientes,
  // seguimiento y registros), sin ir de ventana en ventana.
  function pendientesDeEquipo(inv) {
    if (!inv) return [];
    return (DB.registros.pendiente || []).filter(function (p) { return p.equipo && p.equipo.inv === inv; });
  }
  function irAEquipo(inv) { STATE.equipoSel = inv || null; WS.form = null; navegar('__buscar'); }

  function renderBuscar() {
    setTitulo('🔎 Buscar equipo', 'Encuentra el equipo y gestiónalo aquí mismo: mantenciones, pendientes y seguimiento');
    configurarExport('Exportar todo', exportarTodo);
    contentEl.innerHTML = '';

    var card = el('div', { class: 'card' });
    var body = el('div', { class: 'card-body' });
    var bar = el('div', { class: 'buscar-bar' });
    bar.appendChild(el('span', { class: 'buscar-ico', 'aria-hidden': 'true' }, '🔎'));
    var search = el('input', { type: 'search', class: 'buscar-input', autocomplete: 'off', placeholder: 'Busca por inventario, serie, equipo, marca, servicio o ubicación…', 'aria-label': 'Buscar equipo' });
    search.value = INV_BUSQUEDA;
    bar.appendChild(search);
    body.appendChild(bar);
    var zona = el('div', { class: 'buscar-zona' });
    body.appendChild(zona);
    card.appendChild(body); contentEl.appendChild(card);

    var invAll, byInv;
    function recalcular() {
      invAll = calcInventario();
      byInv = {};
      invAll.forEach(function (x) { if (x.e.inventario) byInv[x.e.inventario] = x; });
    }
    recalcular();

    function eqItem(x) {
      var e = x.e;
      var it = el('button', { type: 'button', class: 'eq-result' });
      it.appendChild(estadoPill(x.estado));
      it.appendChild(el('div', { class: 'eq-main' }, [
        el('div', { class: 'eq-t' }, (e.inventario || '(sin inventario)') + (e.equipo ? (' · ' + e.equipo) : '')),
        el('div', { class: 'eq-s' }, [e.servicio, e.marca, e.serie ? ('Serie ' + e.serie) : null].filter(Boolean).join(' · ') || '—')
      ]));
      var ab = pendientesDeEquipo(e.inventario).filter(function (p) { return (p.estado_pendiente || 'Pendiente') !== 'Resuelto'; }).length;
      var meta = el('div', { class: 'eq-meta' });
      meta.appendChild(el('span', { class: 'count-note' }, x.n + ' reg.'));
      if (ab) meta.appendChild(el('span', { class: 'badge', title: 'pendientes abiertos' }, String(ab)));
      it.appendChild(meta);
      it.onclick = function () { seleccionar(e.inventario); };
      return it;
    }

    function hintInicial() {
      var box = el('div');
      var stats = el('div', { class: 'stat-grid' });
      stats.appendChild(mpStatBox(invAll.length, 'Equipos'));
      stats.appendChild(mpStatBox((DB.registros.mp || []).length, 'Mantenciones preventivas'));
      stats.appendChild(mpStatBox(pendientesAbiertos(), 'Pendientes abiertos'));
      box.appendChild(stats);
      box.appendChild(el('div', { class: 'banner' }, 'Escribe arriba el inventario, la serie, el nombre o el servicio del equipo. Al elegirlo verás y editarás sus mantenciones, agregarás pendientes y registrarás seguimiento, todo en esta pantalla.'));
      var conEv = invAll.filter(function (x) { return x.n > 0; }).sort(function (a, b) { return (b.ultima || '').localeCompare(a.ultima || ''); }).slice(0, 12);
      if (conEv.length) {
        box.appendChild(el('h4', { class: 'sub-h' }, 'Actividad reciente'));
        var lista = el('div', { class: 'eq-result-list' });
        conEv.forEach(function (x) { lista.appendChild(eqItem(x)); });
        box.appendChild(lista);
      }
      return box;
    }

    function pintarZona() {
      zona.innerHTML = '';
      if (STATE.equipoSel && !byInv[STATE.equipoSel]) STATE.equipoSel = null;
      if (STATE.equipoSel) { zona.appendChild(renderEquipoWorkspace(byInv[STATE.equipoSel], { refrescar: refrescar, volver: volver })); return; }
      var q = search.value.trim().toLowerCase();
      if (!q) { zona.appendChild(hintInicial()); return; }
      var qN = normNum(q);
      var rows = invAll.filter(function (x) {
        var e = x.e;
        var hay = ((e.id || '') + ' ' + (e.inventario || '') + ' ' + (e.carpeta || '') + ' ' + (e.equipo || '') + ' ' + (e.serie || '') + ' ' + (e.marca || '') + ' ' + (e.modelo || '') + ' ' + (e.servicio || '') + ' ' + (e.unidad || '') + ' ' + (e.ubicacion || '')).toLowerCase();
        return hay.indexOf(q) >= 0 || (qN && normNum(hay).indexOf(qN) >= 0);
      });
      rows.sort(function (a, b) { return cmpNat(a.e.inventario, b.e.inventario) || cmpNat(a.e.id, b.e.id); });
      zona.appendChild(el('div', { class: 'count-note', style: 'margin:2px 0 10px' }, rows.length + ' equipo(s) — haz clic en uno para gestionarlo'));
      if (!rows.length) { zona.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🔎'), el('div', {}, 'Sin resultados para «' + search.value.trim() + '».')])); return; }
      var lista = el('div', { class: 'eq-result-list' });
      rows.slice(0, 60).forEach(function (x) { lista.appendChild(eqItem(x)); });
      zona.appendChild(lista);
      if (rows.length > 60) zona.appendChild(el('div', { class: 'hint' }, 'Mostrando 60 de ' + rows.length + '. Afina la búsqueda para ver menos.'));
    }

    function seleccionar(inv) { STATE.equipoSel = inv || null; WS.form = null; pintarZona(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    function volver() { STATE.equipoSel = null; WS.form = null; pintarZona(); try { search.focus(); search.select(); } catch (e) {} }
    function refrescar() { recalcular(); pintarZona(); renderSidebar(); }

    search.addEventListener('input', function () { INV_BUSQUEDA = search.value; STATE.equipoSel = null; WS.form = null; pintarZona(); });
    pintarZona();
    if (!STATE.equipoSel) setTimeout(function () { try { search.focus(); } catch (e) {} }, 0);
  }

  // Espacio de trabajo de un equipo (en línea): cabecera, datos, acciones
  // rápidas (mantención / pendiente / correctivo) con formulario incrustado,
  // pendientes del equipo e historial de registros.
  function renderEquipoWorkspace(item, cbs) {
    var e = item.e, inv = e.inventario;
    var box = el('div', { class: 'eq-ws' });

    var head = el('div', { class: 'eq-ws-head' });
    var bVolver = el('button', { type: 'button', class: 'btn btn-sm' }, '← Volver a la búsqueda');
    bVolver.onclick = function () { cbs.volver(); };
    head.appendChild(bVolver);
    head.appendChild(el('h3', { class: 'eq-ws-title' }, (inv || '(sin inventario)') + (e.equipo ? (' · ' + e.equipo) : '')));
    head.appendChild(estadoPill(item.estado));
    head.appendChild(el('span', { class: 'count-note' }, item.ultima ? ('Última actualización: ' + fmtFecha(item.ultima)) : 'Sin actividad'));
    box.appendChild(head);

    var det = el('details', { class: 'eq-ficha' });
    det.appendChild(el('summary', {}, 'Datos del equipo'));
    var fg = el('div', { class: 'ficha-grid' });
    [['ID', e.id], ['N° Inventario', e.inventario], ['N° Carpeta', e.carpeta], ['Equipo', e.equipo], ['Servicio', e.servicio],
    ['Unidad', e.unidad], ['Ubicación', e.ubicacion], ['Procedencia', e.procedencia], ['Marca', e.marca],
    ['Modelo', e.modelo], ['Serie', e.serie], ['Año instalación', e.anio], ['Vida útil residual', e.vida_util],
    ['Clasificación', e.clasificacion]].forEach(function (p) {
      if (p[1]) fg.appendChild(el('div', { class: 'it' }, [el('div', { class: 'k' }, p[0]), el('div', { class: 'v' }, p[1])]));
    });
    det.appendChild(fg); box.appendChild(det);

    var acc = el('div', { class: 'eq-actions' });
    var bMP = el('button', { type: 'button', class: 'btn btn-primary' }, '🧰 Registrar mantención preventiva');
    bMP.onclick = function () { WS.form = { etapaId: 'mp', recId: null }; pintarForm(); };
    var bPend = el('button', { type: 'button', class: 'btn' }, '⚠️ Agregar pendiente');
    bPend.onclick = function () { WS.form = { etapaId: 'pendiente', recId: null }; pintarForm(); };
    var selEt = el('select', { class: 'mini', 'aria-label': 'Tipo de evento correctivo' });
    ETAPAS.forEach(function (et) { if (et.id === 'mp' || et.id === 'pendiente') return; selEt.appendChild(el('option', { value: et.id }, et.icono + ' ' + et.nombre)); });
    var bOtro = el('button', { type: 'button', class: 'btn' }, '➕ Otro registro');
    bOtro.onclick = function () { WS.form = { etapaId: selEt.value, recId: null }; pintarForm(); };
    acc.appendChild(bMP); acc.appendChild(bPend); acc.appendChild(selEt); acc.appendChild(bOtro);
    box.appendChild(acc);

    var formArea = el('div', { class: 'eq-form-area' });
    box.appendChild(formArea);

    function pintarForm() {
      formArea.innerHTML = '';
      if (!WS.form) return;
      var etapaId = WS.form.etapaId, etapa = ETAPAS_BY_ID[etapaId];
      if (!etapa) { WS.form = null; return; }
      var editando = WS.form.recId ? getRegistro(etapaId, WS.form.recId) : null;
      var seed = editando ? null : seedRecord(etapa, { equipo: equipoToPicker(e), folio: (etapaId !== 'solicitud' ? ultimoFolioAbiertoEquipo(inv) : '') });
      var form = buildForm(etapa, editando || seed, { equipoFijo: equipoToPicker(e) });
      var fc = el('div', { class: 'card eq-form-card' });
      fc.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, (editando ? '✏️ Editar · ' : '➕ Nuevo · ') + etapa.nombre)]));
      var fcb = el('div', { class: 'card-body' });
      fcb.appendChild(form.grid);
      var fa = el('div', { class: 'form-actions' });
      var bSave = el('button', { type: 'button', class: 'btn btn-primary' }, editando ? '💾 Guardar cambios' : '➕ Guardar');
      bSave.onclick = function () {
        try {
          var rec = collectForm(etapa, form.controls);
          var era = !!editando;
          var ok = persistirRegistro(etapaId, rec, editando);
          if (ok) toast(era ? 'Registro actualizado.' : ('«' + etapa.nombre + '» registrada.'), 'ok');
          WS.form = null;
          cbs.refrescar();
        } catch (err) { toast(err.message, 'err'); }
      };
      var bCanc = el('button', { type: 'button', class: 'btn' }, 'Cancelar');
      bCanc.onclick = function () { WS.form = null; pintarForm(); };
      fa.appendChild(bSave); fa.appendChild(bCanc); fcb.appendChild(fa); fc.appendChild(fcb);
      formArea.appendChild(fc);
      var first = fc.querySelector('input:not([type=hidden]),select,textarea');
      if (first && first.focus) try { first.focus(); } catch (e2) {}
    }
    pintarForm(); // reabre el formulario si quedó uno en curso

    // Pendientes del equipo
    var pends = pendientesDeEquipo(inv);
    var abiertos = pends.filter(function (p) { return (p.estado_pendiente || 'Pendiente') !== 'Resuelto'; }).length;
    box.appendChild(el('h4', { class: 'sub-h' }, 'Pendientes (' + abiertos + ' abierto' + (abiertos === 1 ? '' : 's') + ')'));
    if (!pends.length) {
      box.appendChild(el('div', { class: 'muted-empty' }, 'Sin pendientes. Usa «⚠️ Agregar pendiente».'));
    } else {
      var wrapP = el('div', { class: 'tabla-wrap' });
      var tP = el('table', { class: 'data' });
      tP.appendChild(el('thead', {}, el('tr', {}, [th('Tipo'), th('Descripción'), th('Estado'), th('Asegura'), th('Compromiso'), th('Acciones')])));
      var tbP = el('tbody');
      pends.slice().sort(function (a, b) { var ra = (a.estado_pendiente === 'Resuelto') ? 1 : 0, rb = (b.estado_pendiente === 'Resuelto') ? 1 : 0; return ra - rb || cmpFechaDesc(a, b); }).forEach(function (p) {
        ensureSub(p);
        var tr = el('tr');
        tr.appendChild(td(p.tipo || '—'));
        var obs = p.observaciones || ''; tr.appendChild(td(obs.length > 46 ? (obs.slice(0, 46) + '…') : (obs || '—')));
        var tdE = el('td'); var sel = el('select', { class: 'mini' });
        ['Pendiente', 'En proceso', 'Resuelto'].forEach(function (o) { sel.appendChild(el('option', { value: o }, o)); });
        sel.value = p.estado_pendiente || 'Pendiente';
        sel.onchange = function () { p.estado_pendiente = sel.value; if (sel.value === 'Resuelto') { if (!p.fecha_resolucion) p.fecha_resolucion = hoyISO(); p.foco = 0; renumberFoco(); } p._updatedAt = new Date().toISOString(); guardarDB(); cbs.refrescar(); };
        tdE.appendChild(sel); tr.appendChild(tdE);
        tr.appendChild(td(p.responsable || '—'));
        var rc = riesgoPend(p);
        tr.appendChild(td(p.fecha_resolucion ? (rc ? el('span', { class: 'age-pill ' + rc.cls }, fmtFecha(p.fecha_resolucion)) : fmtFecha(p.fecha_resolucion)) : '—'));
        var acP = el('td', { class: 'acciones' });
        var bSeg = el('button', { type: 'button', class: 'btn btn-sm' }, '📌 Seguimiento'); bSeg.onclick = function () { registrarSeguimiento(p); };
        var bEdP = el('button', { type: 'button', class: 'btn btn-sm' }, '✏️ Editar'); bEdP.onclick = function () { WS.form = { etapaId: 'pendiente', recId: p._id }; pintarForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
        var bGeP = el('button', { type: 'button', class: 'btn btn-sm', title: 'Tareas y bitácora' }, '🔧'); bGeP.onclick = function () { openEventoDetalle('pendiente', p._id); };
        var bDeP = el('button', { type: 'button', class: 'btn btn-sm btn-danger', title: 'Eliminar pendiente' }, '🗑️'); bDeP.onclick = function () { if (!confirm('¿Eliminar este pendiente?')) return; DB.registros.pendiente = DB.registros.pendiente.filter(function (x) { return x._id !== p._id; }); guardarDB(); cbs.refrescar(); };
        acP.appendChild(bSeg); acP.appendChild(document.createTextNode(' ')); acP.appendChild(bEdP); acP.appendChild(document.createTextNode(' ')); acP.appendChild(bGeP); acP.appendChild(document.createTextNode(' ')); acP.appendChild(bDeP);
        tr.appendChild(acP);
        tbP.appendChild(tr);
      });
      tP.appendChild(tbP); wrapP.appendChild(tP); box.appendChild(wrapP);
    }

    // Historial (mantenciones y correctivos)
    var hist = item.evs.filter(function (x) { return x.etapa.id !== 'pendiente'; }).slice().sort(function (a, b) { return cmpFechaDesc(a.r, b.r); });
    box.appendChild(el('h4', { class: 'sub-h' }, 'Historial de registros (' + hist.length + ')'));
    if (!hist.length) {
      box.appendChild(el('div', { class: 'muted-empty' }, 'Sin mantenciones ni registros. Usa «🧰 Registrar mantención preventiva».'));
    } else {
      var wrapH = el('div', { class: 'tabla-wrap' });
      var tH = el('table', { class: 'data' });
      tH.appendChild(el('thead', {}, el('tr', {}, [th('Fecha'), th('Tipo'), th('Estado / Resultado'), th('Ejecutor'), th('Observaciones'), th('Acciones')])));
      var tbH = el('tbody');
      hist.forEach(function (x) {
        var r = x.r, tr = el('tr');
        tr.appendChild(td(fmtFecha(r.fecha) || '—'));
        tr.appendChild(td(el('span', { class: 'tag-etapa' }, x.etapa.nombre)));
        tr.appendChild(td(celdaEstadoResultado(r)));
        tr.appendChild(td(r.tecnico || '—'));
        var obsH = r.observaciones || ''; tr.appendChild(td(obsH.length > 50 ? (obsH.slice(0, 50) + '…') : (obsH || '—')));
        var acH = el('td', { class: 'acciones' });
        var bEdH = el('button', { type: 'button', class: 'btn btn-sm' }, '✏️ Editar'); bEdH.onclick = (function (sid, rid) { return function () { WS.form = { etapaId: sid, recId: rid }; pintarForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); }; })(x.etapa.id, r._id);
        var bGeH = el('button', { type: 'button', class: 'btn btn-sm', title: 'Tareas y bitácora' }, '🔧'); bGeH.onclick = (function (sid, rid) { return function () { openEventoDetalle(sid, rid); }; })(x.etapa.id, r._id);
        var bDeH = el('button', { type: 'button', class: 'btn btn-sm btn-danger', title: 'Eliminar registro' }, '🗑️'); bDeH.onclick = (function (sid, rid, nm) { return function () { if (!confirm('¿Eliminar este registro de «' + nm + '»?')) return; DB.registros[sid] = DB.registros[sid].filter(function (z) { return z._id !== rid; }); guardarDB(); cbs.refrescar(); }; })(x.etapa.id, r._id, x.etapa.nombre);
        acH.appendChild(bEdH); acH.appendChild(document.createTextNode(' ')); acH.appendChild(bGeH); acH.appendChild(document.createTextNode(' ')); acH.appendChild(bDeH);
        tr.appendChild(acH);
        tbH.appendChild(tr);
      });
      tH.appendChild(tbH); wrapH.appendChild(tH); box.appendChild(wrapH);
    }

    return box;
  }

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
    if (/baja/i.test(v)) return 'Baja';
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
      case 'mp': return normEstado(r.estado_equipo) || ((window.EventosMP && window.EventosMP.estadoFromResultado) ? window.EventosMP.estadoFromResultado(r.resultado) : null);
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
        : estado === 'Servicio técnico' ? 'pill pill-st'
          : estado === 'Baja' ? 'pill pill-baja' : 'pill pill-gray';
    return el('span', { class: cls }, estado);
  }

  // Mapa estado -> vista del tablero de estado (panel izquierdo).
  var EST_VIEW = { 'Operativo': '__est_operativo', 'No operativo': '__est_no_operativo', 'Servicio técnico': '__est_st', 'Baja': '__est_baja', 'Desconocido': '__est_desconocido' };

  function renderInventario(estadoForzado) {
    var titulos = {
      'Servicio técnico': ['🛠️ Equipos en servicio técnico', 'Equipos cuyo último evento indica que están en servicio técnico'],
      'Operativo': ['✅ Equipos operativos', 'Equipos cuyo último evento indica que están operativos'],
      'No operativo': ['⛔ Equipos no operativos', 'Equipos cuyo último evento indica que están no operativos'],
      'Baja': ['🚫 Equipos dados de baja', 'Equipos cuyo último evento indica que fueron dados de baja'],
      'Desconocido': ['❔ Equipos sin eventos', 'Equipos sin ningún evento registrado (estado desconocido)']
    };
    if (estadoForzado && titulos[estadoForzado]) setTitulo(titulos[estadoForzado][0], titulos[estadoForzado][1]);
    else setTitulo('🩺 Inventario de equipos', getEquipos().length + ' equipos críticos · estado según el último evento');
    contentEl.innerHTML = '';

    var inv = calcInventario();
    var counts = { 'Operativo': 0, 'No operativo': 0, 'Servicio técnico': 0, 'Baja': 0, 'Desconocido': 0 };
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
    stats.appendChild(st(counts['Baja'], 'De baja', 'Baja'));
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
    search.value = INV_BUSQUEDA; // recuerda lo último buscado al volver a esta vista
    var selEstado = el('select', { 'aria-label': 'Filtrar por estado' });
    [['', 'Todos los estados'], ['Operativo', 'Operativo'], ['No operativo', 'No operativo'], ['Servicio técnico', 'En servicio técnico'], ['Baja', 'Baja'], ['Desconocido', 'Desconocido']]
      .forEach(function (o) { selEstado.appendChild(el('option', { value: o[0] }, o[1])); });
    if (estadoForzado) selEstado.value = estadoForzado;
    toolbar.appendChild(search);
    toolbar.appendChild(selEstado);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var note = el('span', { class: 'count-note' });
    toolbar.appendChild(note);
    var btnExp = el('button', { class: 'btn' }, '⬇️ Exportar lo visible');
    toolbar.appendChild(btnExp);
    body.appendChild(toolbar);

    var cont = el('div');
    body.appendChild(cont);

    // Haystacks precalculados (normal y normalizado por ceros a la izquierda).
    inv.forEach(function (x) {
      var e = x.e;
      x._hay = ((e.id || '') + ' ' + (e.carpeta || '') + ' ' + (e.inventario || '') + ' ' + (e.equipo || '') + ' ' +
        (e.serie || '') + ' ' + (e.marca || '') + ' ' + (e.modelo || '') + ' ' + (e.servicio || '') + ' ' +
        (e.unidad || '') + ' ' + (e.ubicacion || '') + ' ' + (e.procedencia || '')).toLowerCase();
      x._hayN = normNum(x._hay);
    });

    // Filtrado compartido por la tabla y por la exportación (exporta lo que se ve).
    function filtrarRows() {
      var q = search.value.trim().toLowerCase();
      var qN = normNum(q);
      var ef = selEstado.value;
      var rows = inv.filter(function (x) {
        if (ef && x.estado !== ef) return false;
        if (!q) return true;
        return x._hay.indexOf(q) >= 0 || x._hayN.indexOf(qN) >= 0;
      });
      rows.sort(function (a, b) { return cmpNat(a.e.id, b.e.id) || cmpNat(a.e.inventario, b.e.inventario); });
      return rows;
    }

    // Exporta los equipos visibles (estado + búsqueda actuales) y, en una segunda
    // hoja, TODOS sus registros (mantenciones, solicitudes, etc.).
    function exportarVista() {
      var rows = filtrarRows();
      if (!rows.length) { toast('No hay equipos que exportar en esta vista.', 'err'); return; }
      var titulo = estadoForzado ? ('Inventario ' + estadoForzado) : (selEstado.value ? ('Inventario ' + selEstado.value) : 'Inventario');
      var invSet = {};
      rows.forEach(function (x) { if (x.e.inventario) invSet[x.e.inventario] = 1; });
      var regRows = bitacoraRows().filter(function (b) { return b.r.equipo && b.r.equipo.inv && invSet[b.r.equipo.inv]; });
      var hojas = [hojaInventarioDesde(rows, titulo.slice(0, 31))];
      if (regRows.length) hojas.push(hojaBitacoraDesde(regRows, 'Registros'));
      try {
        XLSXWriter.descargar(nombreArchivo(titulo), hojas);
        toast(rows.length + ' equipo(s) y ' + regRows.length + ' registro(s) exportados.', 'ok');
      } catch (e) { toast('Error al exportar: ' + e.message, 'err'); }
    }
    btnExp.onclick = exportarVista;
    configurarExport(estadoForzado ? ('Exportar ' + estadoForzado) : 'Exportar inventario', exportarVista);

    function pintar() {
      var rows = filtrarRows();
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
        tr.onclick = (function (it) { return function () { if (it.e.inventario) irAEquipo(it.e.inventario); else openEquipoDetalle(it); }; })(x);
        frag.appendChild(tr);
      });
      tb.appendChild(frag);
      t.appendChild(tb);
      wrap.appendChild(t);
      cont.appendChild(wrap);
    }
    search.addEventListener('input', function () { INV_BUSQUEDA = search.value; pintar(); });
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
        tr.appendChild(td(celdaEstadoResultado(r)));
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
    resumen.appendChild(celdaEstadoResultado(rec));
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
    configurarExport('Exportar pendientes', function () { exportarEtapa(ETAPAS_BY_ID['pendiente']); });
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
        autoaprenderEmpresa(rec); DB.registros.pendiente.push(rec);
        if (guardarDB()) toast('Pendiente registrado.', 'ok');
        renderPendientes(); renderSidebar(); window.scrollTo({ top: 0, behavior: 'smooth' });
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
    ['Gestión general', 'Documento faltante', 'Reprogramación MP', 'Pauta de monitoreo', 'Firma', 'Reporte Interno', 'Reporte Externo', 'Otro'].forEach(function (o) { selT.appendChild(el('option', { value: o }, o)); });
    toolbar.appendChild(search); toolbar.appendChild(selE); toolbar.appendChild(selT);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var bFoco = el('button', { class: 'btn btn-primary', title: 'Gestionar con Eisenhower + Ivy Lee + Cómete el Sapo' }, '🎯 Triple Foco'); bFoco.onclick = function () { navegar('__foco'); };
    var bExp = el('button', { class: 'btn' }, '⬇️ Exportar'); bExp.onclick = function () { exportarEtapa(etapa); };
    toolbar.appendChild(bFoco); toolbar.appendChild(bExp); body2.appendChild(toolbar);
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
        var bE = el('button', { class: 'btn btn-sm', title: 'Editar los campos del pendiente' }, '✏️ Editar'); bE.onclick = function () { abrirEditarPendiente(r); };
        var bD = el('button', { class: 'btn btn-sm btn-danger', title: 'Eliminar pendiente', 'aria-label': 'Eliminar pendiente' }, '🗑️'); bD.onclick = function () { if (!confirm('¿Eliminar este pendiente?')) return; DB.registros.pendiente = DB.registros.pendiente.filter(function (x) { return x._id !== r._id; }); guardarDB(); renderSidebar(); renderPendientes(); };
        acc.appendChild(bG); acc.appendChild(document.createTextNode(' ')); acc.appendChild(bE); acc.appendChild(document.createTextNode(' ')); acc.appendChild(bD);
        tr.appendChild(acc);
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); cont.appendChild(wrap);
    }
    search.addEventListener('input', pintar); selE.addEventListener('change', pintar); selT.addEventListener('change', pintar);
    pintar();
    card2.appendChild(body2); contentEl.appendChild(card2);
  }

  // Edición de un pendiente en un modal (en contexto, sin salir de la vista).
  function abrirEditarPendiente(p) {
    var etapa = ETAPAS_BY_ID['pendiente'];
    var form = buildForm(etapa, p);
    var box = el('div');
    box.appendChild(form.grid);
    var actions = el('div', { class: 'form-actions' });
    var bg = el('button', { class: 'btn btn-primary' }, '💾 Guardar cambios');
    bg.onclick = function () {
      try {
        var rec = collectForm(etapa, form.controls);
        rec._id = p._id; rec._stage = 'pendiente'; rec._createdAt = p._createdAt; rec._updatedAt = new Date().toISOString();
        if (Array.isArray(p.tareas)) rec.tareas = p.tareas;
        if (Array.isArray(p.actualizaciones)) rec.actualizaciones = p.actualizaciones;
        if (p.foco != null) rec.foco = p.foco;
        if (p.eisen != null) rec.eisen = p.eisen;
        var idx = DB.registros.pendiente.findIndex(function (x) { return x._id === p._id; });
        if (idx >= 0) DB.registros.pendiente[idx] = rec; else DB.registros.pendiente.push(rec);
        autoaprenderEmpresa(rec);
        if (guardarDB()) toast('Pendiente actualizado.', 'ok');
        closeModal(); render();
      } catch (err) { toast(err.message, 'err'); }
    };
    var bc = el('button', { class: 'btn' }, 'Cancelar'); bc.onclick = closeModal;
    actions.appendChild(bg); actions.appendChild(bc);
    box.appendChild(actions);
    openModal('✏️ Editar pendiente', box);
  }

  // ========================================================== Triple Foco
  // Productividad de pendientes combinando Eisenhower + Ivy Lee + Cómete el Sapo.
  var EISEN_META = {
    hacer:      { label: 'Hazlo ya',    sub: 'Urgente e importante',       cls: 'q-hacer' },
    planificar: { label: 'Planifícalo', sub: 'Importante, no urgente',     cls: 'q-planificar' },
    delegar:    { label: 'Delégalo',    sub: 'Urgente, no importante',     cls: 'q-delegar' },
    eliminar:   { label: 'Elimínalo',   sub: 'Ni urgente ni importante',   cls: 'q-eliminar' }
  };
  function pendAbiertos() { return DB.registros.pendiente.filter(function (p) { return (p.estado_pendiente || 'Pendiente') !== 'Resuelto'; }); }
  function focoLista() { return DB.registros.pendiente.filter(function (p) { return p.foco && (p.estado_pendiente || 'Pendiente') !== 'Resuelto'; }).sort(function (a, b) { return (a.foco || 0) - (b.foco || 0); }); }
  function renumberFoco() { focoLista().forEach(function (p, i) { p.foco = i + 1; }); }
  function addFoco(p) {
    if (p.foco) return;
    var l = focoLista();
    if (l.length >= 6) { toast('El foco de hoy ya tiene 6 tareas (Ivy Lee). Quita una para añadir otra.', 'err'); return; }
    p.foco = l.length + 1; p._updatedAt = new Date().toISOString();
    guardarDB(); renderSidebar(); renderTripleFoco();
  }
  function removeFoco(p) { p.foco = 0; renumberFoco(); guardarDB(); renderSidebar(); renderTripleFoco(); }
  function moveFoco(p, dir) {
    var l = focoLista(), i = l.indexOf(p), j = i + dir;
    if (i < 0 || j < 0 || j >= l.length) return;
    var t = l[i].foco; l[i].foco = l[j].foco; l[j].foco = t;
    guardarDB(); renderTripleFoco();
  }
  function textoPend(p) { return p.observaciones || p.tipo || 'Pendiente'; }
  function eisenLabelShort(p) { return (p.eisen && EISEN_META[p.eisen]) ? EISEN_META[p.eisen].label : 'Sin clasificar'; }

  function selEstadoPend(p, after) {
    var sel = el('select', { class: 'mini', title: 'Estado' });
    ['Pendiente', 'En proceso', 'Resuelto'].forEach(function (o) { sel.appendChild(el('option', { value: o }, o)); });
    sel.value = p.estado_pendiente || 'Pendiente';
    sel.onchange = function () {
      p.estado_pendiente = sel.value;
      if (sel.value === 'Resuelto') { if (!p.fecha_resolucion) p.fecha_resolucion = hoyISO(); p.foco = 0; renumberFoco(); }
      p._updatedAt = new Date().toISOString();
      guardarDB(); renderSidebar(); (after || renderTripleFoco)();
    };
    return sel;
  }

  // Fila de pendiente para la matriz / lista por clasificar: cuadrante + foco.
  function chipPendiente(p) {
    var row = el('div', { class: 'pend-chip' });
    var meta = [ejecutorTxt(p)]; if (p.responsable) meta.push('Asegura: ' + p.responsable); if (equipoCorto(p.equipo)) meta.push(equipoCorto(p.equipo));
    row.appendChild(el('div', { class: 'tx' }, [
      el('div', { class: 'd' }, textoPend(p)),
      el('div', { class: 'count-note' }, meta.filter(Boolean).join(' · '))
    ]));
    var rc = riesgoPend(p); if (rc) row.appendChild(el('span', { class: 'age-pill ' + rc.cls, title: 'Compromiso: ' + fmtFecha(p.fecha_resolucion) }, rc.label));
    var sel = el('select', { class: 'mini', title: 'Cuadrante de Eisenhower' });
    [['', '— Cuadrante —'], ['hacer', 'Hazlo ya'], ['planificar', 'Planifícalo'], ['delegar', 'Delégalo'], ['eliminar', 'Elimínalo']]
      .forEach(function (o) { sel.appendChild(el('option', { value: o[0] }, o[1])); });
    sel.value = p.eisen || '';
    sel.onchange = function () { p.eisen = sel.value || undefined; p._updatedAt = new Date().toISOString(); guardarDB(); renderTripleFoco(); };
    row.appendChild(sel);
    var enFoco = !!p.foco;
    var fb = el('button', { class: 'btn btn-sm' + (enFoco ? ' btn-primary' : ''), title: enFoco ? 'Quitar del foco de hoy' : 'Añadir al foco de hoy (Ivy Lee)' }, enFoco ? ('✓ Foco ' + p.foco) : '➕ Foco');
    fb.onclick = function () { if (enFoco) removeFoco(p); else addFoco(p); };
    row.appendChild(fb);
    return row;
  }

  // Riesgo de incumplimiento según la fecha de compromiso (fecha_resolucion).
  function riesgoPend(p) {
    if (!p.fecha_resolucion) return null;
    var d = new Date(String(p.fecha_resolucion).slice(0, 10) + 'T00:00:00'); if (isNaN(d)) return null;
    var dias = Math.floor((d.getTime() - Date.now()) / 86400000);
    if (dias < 0) return { label: 'Vencido ' + (-dias) + 'd', cls: 'age-bad' };
    if (dias <= 3) return { label: 'Vence en ' + dias + 'd', cls: 'age-warn' };
    return { label: 'Vence en ' + dias + 'd', cls: 'age-ok' };
  }
  function ejecutorTxt(p) { return p.tecnico ? ('Ejecuta: ' + p.tecnico) : 'Sin ejecutor asignado'; }
  function ultimoSeguimientoTxt(p) {
    if (!Array.isArray(p.actualizaciones) || !p.actualizaciones.length) return 'sin seguimiento';
    var last = p.actualizaciones[p.actualizaciones.length - 1];
    var d = last && last.createdAt ? new Date(last.createdAt) : null;
    if (!d || isNaN(d)) return '';
    var dias = Math.floor((Date.now() - d.getTime()) / 86400000);
    return 'últ. seguimiento ' + (dias <= 0 ? 'hoy' : ('hace ' + dias + 'd'));
  }
  // Registra un seguimiento (lo que empujaste) en la bitácora del pendiente.
  // Modal con área de texto y cambio de estado en un solo paso (reemplaza el
  // window.prompt, que era lento y no permitía pegar ni editar).
  function registrarSeguimiento(p) {
    var box = el('div', { class: 'seg-modal' });
    var ctx = [ejecutorTxt(p)];
    if (p.responsable) ctx.push('Asegura: ' + p.responsable);
    if (equipoCorto(p.equipo)) ctx.push(equipoCorto(p.equipo));
    var rc = riesgoPend(p); if (rc) ctx.push(rc.label);
    box.appendChild(el('div', { class: 'count-note', style: 'margin-bottom:8px' }, ctx.filter(Boolean).join(' · ')));

    var ta = el('textarea', { class: 'seg-ta', rows: '4', placeholder: 'Qué hiciste, con quién y el resultado…', 'aria-label': 'Texto del seguimiento' });
    box.appendChild(ta);

    var fila = el('div', { class: 'seg-estado' });
    fila.appendChild(el('label', {}, 'Estado del pendiente:'));
    var selE = el('select', { class: 'mini' });
    ['Pendiente', 'En proceso', 'Resuelto'].forEach(function (o) { selE.appendChild(el('option', { value: o }, o)); });
    selE.value = p.estado_pendiente || 'Pendiente';
    fila.appendChild(selE);
    box.appendChild(fila);

    var actions = el('div', { class: 'form-actions' });
    var bg = el('button', { class: 'btn btn-primary' }, '💾 Guardar seguimiento');
    function guardar() {
      var txt = ta.value.trim();
      if (!txt) { toast('Escribe el seguimiento.', 'err'); ta.focus(); return; }
      if (!Array.isArray(p.actualizaciones)) p.actualizaciones = [];
      p.actualizaciones.push({ id: uid(), texto: txt, createdAt: new Date().toISOString() });
      if (selE.value !== (p.estado_pendiente || 'Pendiente')) {
        p.estado_pendiente = selE.value;
        if (selE.value === 'Resuelto') { if (!p.fecha_resolucion) p.fecha_resolucion = hoyISO(); p.foco = 0; renumberFoco(); }
      }
      p._updatedAt = new Date().toISOString();
      var ok = guardarDB();
      closeModal();
      if (ok) toast('Seguimiento registrado.', 'ok');
      render();
    }
    bg.onclick = guardar;
    // Ctrl/Cmd+Enter guarda rápidamente desde el área de texto.
    ta.addEventListener('keydown', function (ev) { if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); guardar(); } });
    var bc = el('button', { class: 'btn' }, 'Cancelar'); bc.onclick = closeModal;
    actions.appendChild(bg); actions.appendChild(bc);
    box.appendChild(actions);

    openModal('📌 Seguimiento · ' + textoPend(p).slice(0, 60), box);
    setTimeout(function () { if (ta.focus) ta.focus(); }, 0);
  }
  // Ítem unificado del foco/sapo: ejecutor, riesgo, estado, seguimiento y (opcional) reorden.
  function focoItem(p, i, conReorden) {
    var it = el('div', { class: 'foco-item' + (i === 0 ? ' sapo' : '') });
    it.appendChild(el('span', { class: 'foco-num' }, i === 0 ? '🐸' : String(i + 1)));
    var meta = [ejecutorTxt(p)];
    if (p.responsable) meta.push('Asegura: ' + p.responsable);
    if (equipoCorto(p.equipo)) meta.push(equipoCorto(p.equipo));
    meta.push(ultimoSeguimientoTxt(p));
    it.appendChild(el('div', { class: 'foco-tx' }, [el('div', { class: 'd' }, textoPend(p)), el('div', { class: 'count-note' }, meta.filter(Boolean).join(' · '))]));
    var r = riesgoPend(p); if (r) it.appendChild(el('span', { class: 'age-pill ' + r.cls, title: 'Fecha de compromiso: ' + fmtFecha(p.fecha_resolucion) }, r.label));
    it.appendChild(selEstadoPend(p));
    var bSeg = el('button', { class: 'btn btn-sm', title: 'Registrar seguimiento' }, '📝 Seguimiento'); bSeg.onclick = function () { registrarSeguimiento(p); };
    it.appendChild(bSeg);
    if (conReorden) {
      var up = el('button', { class: 'btn btn-sm', title: 'Subir prioridad', 'aria-label': 'Subir' }, '▲'); up.onclick = function () { moveFoco(p, -1); };
      var dn = el('button', { class: 'btn btn-sm', title: 'Bajar prioridad', 'aria-label': 'Bajar' }, '▼'); dn.onclick = function () { moveFoco(p, 1); };
      var rm = el('button', { class: 'btn btn-sm btn-danger', title: 'Quitar del foco', 'aria-label': 'Quitar del foco' }, '✕'); rm.onclick = function () { removeFoco(p); };
      it.appendChild(up); it.appendChild(dn); it.appendChild(rm);
    }
    return it;
  }

  function renderTripleFoco() {
    setTitulo('🎯 Triple Foco', 'Seguimiento de pendientes · tú aseguras, el técnico ejecuta · Eisenhower + Ivy Lee + Sapo');
    configurarExport('Exportar pendientes', function () { exportarEtapa(ETAPAS_BY_ID['pendiente']); });
    contentEl.innerHTML = '';

    var abiertos = pendAbiertos();
    var foco = focoLista();

    contentEl.appendChild(el('div', { class: 'banner' },
      'Reenfocado para tu rol: tú aseguras que se cumplan, el técnico (ejecutor) los realiza. ' +
      '1) prioriza con la Matriz de Eisenhower; 2) elige hasta 6 pendientes para empujar hoy y ordénalos (Ivy Lee); ' +
      '3) empieza por la #1, tu “sapo”: el seguimiento que no puede esperar (Cómete el Sapo). ' +
      'En cada uno verás su ejecutor y el riesgo según la fecha de compromiso, y puedes registrar el seguimiento.'));

    if (!abiertos.length) {
      contentEl.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '✅'),
        el('div', {}, 'No hay pendientes abiertos. Crea pendientes en la sección «Pendientes».')]));
      var bP = el('button', { class: 'btn btn-primary' }, '⚠️ Ir a Pendientes'); bP.onclick = function () { navegar('__pendientes'); };
      contentEl.appendChild(el('div', { class: 'form-actions' }, [bP]));
      return;
    }

    // A) El sapo de hoy
    var sapo = foco[0] || null;
    var cardS = el('div', { class: 'card' });
    cardS.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, '🐸 El sapo de hoy'), el('span', { class: 'desc' }, 'El seguimiento que no puede esperar: ocúpate primero')]));
    var bodyS = el('div', { class: 'card-body' });
    if (sapo) bodyS.appendChild(focoItem(sapo, 0, false));
    else bodyS.appendChild(el('div', { class: 'muted-empty' }, 'Aún no defines tu sapo. Añade pendientes al «Foco de hoy» (abajo) y el #1 será tu sapo.'));
    cardS.appendChild(bodyS); contentEl.appendChild(cardS);

    // B) Seguimientos de hoy (Ivy Lee)
    var cardF = el('div', { class: 'card' });
    cardF.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, '🎯 Seguimientos de hoy — Top 6 (Ivy Lee)'), el('span', { class: 'desc' }, foco.length + '/6 · empuja de arriba abajo; cada uno tiene su ejecutor')]));
    var bodyF = el('div', { class: 'card-body' });
    if (!foco.length) bodyF.appendChild(el('div', { class: 'muted-empty' }, 'Sin pendientes en el foco. Añádelos desde la matriz de abajo con «➕ Foco».'));
    else {
      var listaF = el('div', { class: 'foco-list' });
      foco.forEach(function (p, i) { listaF.appendChild(focoItem(p, i, true)); });
      bodyF.appendChild(listaF);
      var bVaciar = el('button', { class: 'btn' }, '🧹 Vaciar foco (nuevo día)');
      bVaciar.onclick = function () { if (!confirm('¿Vaciar el foco de hoy? Las tareas no se eliminan, solo salen del foco.')) return; DB.registros.pendiente.forEach(function (p) { p.foco = 0; }); guardarDB(); renderSidebar(); renderTripleFoco(); };
      bodyF.appendChild(el('div', { class: 'form-actions' }, [bVaciar]));
    }
    cardF.appendChild(bodyF); contentEl.appendChild(cardF);

    // C) Matriz de Eisenhower
    var cardM = el('div', { class: 'card' });
    cardM.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, '🗂️ Matriz de Eisenhower'), el('span', { class: 'desc' }, 'Clasifica por urgencia e importancia, luego lleva las clave al foco')]));
    var bodyM = el('div', { class: 'card-body' });
    var sinClasif = abiertos.filter(function (p) { return !p.eisen; });
    if (sinClasif.length) {
      bodyM.appendChild(el('div', { class: 'hint' }, 'Por clasificar (' + sinClasif.length + '): asigna cada pendiente a un cuadrante.'));
      var scWrap = el('div', { class: 'foco-list', style: 'margin:6px 0 14px' });
      sinClasif.forEach(function (p) { scWrap.appendChild(chipPendiente(p)); });
      bodyM.appendChild(scWrap);
    }
    var grid = el('div', { class: 'eisen-grid' });
    ['hacer', 'planificar', 'delegar', 'eliminar'].forEach(function (q) {
      var meta = EISEN_META[q];
      var items = abiertos.filter(function (p) { return p.eisen === q; });
      var cell = el('div', { class: 'eisen-cell ' + meta.cls });
      cell.appendChild(el('div', { class: 'h' }, [el('span', {}, meta.label), el('span', { class: 'n' }, String(items.length))]));
      var cb = el('div', { class: 'eisen-body' });
      cb.appendChild(el('div', { class: 'sub' }, meta.sub));
      if (!items.length) cb.appendChild(el('div', { class: 'muted-empty' }, '—'));
      else items.forEach(function (p) { cb.appendChild(chipPendiente(p)); });
      cell.appendChild(cb); grid.appendChild(cell);
    });
    bodyM.appendChild(grid);
    cardM.appendChild(bodyM); contentEl.appendChild(cardM);
  }

  // ===================================================== Mi seguimiento (SLA)
  function diasSinSeguimiento(p) {
    var ref = (Array.isArray(p.actualizaciones) && p.actualizaciones.length) ? p.actualizaciones[p.actualizaciones.length - 1].createdAt : (p._createdAt || p.fecha);
    if (!ref) return 0;
    var d = new Date(ref); if (isNaN(d)) d = new Date(String(ref).slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  }
  function riesgoOrden(p) {
    var r = riesgoPend(p);
    if (r && r.cls === 'age-bad') return 0;          // vencido
    if (r && r.cls === 'age-warn') return 1;         // por vencer
    if (diasSinSeguimiento(p) > 7) return 2;         // sin movimiento
    return 3;
  }
  function pendientesVencidos() { return pendAbiertos().filter(function (p) { var r = riesgoPend(p); return r && r.cls === 'age-bad'; }).length; }

  function renderSeguimiento() {
    setTitulo('👁️ Mi seguimiento', 'Pendientes que aseguras · tú accountable, el técnico ejecuta · SLA por fecha de compromiso');
    configurarExport('Exportar pendientes', function () { exportarEtapa(ETAPAS_BY_ID['pendiente']); });
    contentEl.innerHTML = '';
    var abiertos = pendAbiertos();

    var venc = abiertos.filter(function (p) { var r = riesgoPend(p); return r && r.cls === 'age-bad'; }).length;
    var porV = abiertos.filter(function (p) { var r = riesgoPend(p); return r && r.cls === 'age-warn'; }).length;
    var sinM = abiertos.filter(function (p) { return diasSinSeguimiento(p) > 7; }).length;
    var stats = el('div', { class: 'stat-grid' });
    function s(n, l, accent) { return el('div', { class: 'stat' + (accent ? ' accent' : '') }, [el('div', { class: 'n' }, String(n)), el('div', { class: 'l' }, l)]); }
    stats.appendChild(s(abiertos.length, 'Abiertos'));
    stats.appendChild(s(venc, 'Vencidos'));
    stats.appendChild(s(porV, 'Por vencer (≤3d)'));
    stats.appendChild(s(sinM, 'Sin movimiento (>7d)'));
    contentEl.appendChild(stats);

    contentEl.appendChild(el('div', { class: 'banner' },
      'Los pendientes que TÚ aseguras (RACI: tú accountable, el técnico ejecuta), ordenados por riesgo según la fecha de compromiso. ' +
      'Empuja, registra el seguimiento y mantén el cumplimiento.'));

    if (!abiertos.length) { contentEl.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '✅'), el('div', {}, 'No hay pendientes abiertos.')])); return; }

    var card = el('div', { class: 'card' });
    var body = el('div', { class: 'card-body' });
    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Buscar por equipo, descripción, ejecutor…' });
    var selResp = el('select'); selResp.appendChild(el('option', { value: '' }, 'Responsable: todos'));
    var resps = {}; abiertos.forEach(function (p) { if (p.responsable) resps[p.responsable] = 1; });
    Object.keys(resps).sort(cmpNat).forEach(function (x) { selResp.appendChild(el('option', { value: x }, 'Asegura: ' + x)); });
    var selEjec = el('select'); selEjec.appendChild(el('option', { value: '' }, 'Ejecutor: todos'));
    var ejecs = {}; abiertos.forEach(function (p) { if (p.tecnico) ejecs[p.tecnico] = 1; });
    Object.keys(ejecs).sort(cmpNat).forEach(function (x) { selEjec.appendChild(el('option', { value: x }, 'Ejecuta: ' + x)); });
    var selRiesgo = el('select'); [['', 'Todos los riesgos'], ['vencido', 'Vencidos'], ['porvencer', 'Por vencer'], ['sinmov', 'Sin movimiento']].forEach(function (o) { selRiesgo.appendChild(el('option', { value: o[0] }, o[1])); });
    toolbar.appendChild(search); toolbar.appendChild(selResp); toolbar.appendChild(selEjec); toolbar.appendChild(selRiesgo);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var note = el('span', { class: 'count-note' }); toolbar.appendChild(note);
    body.appendChild(toolbar);
    var cont = el('div'); body.appendChild(cont);

    function pintar() {
      var q = search.value.trim().toLowerCase(), fr = selResp.value, fe = selEjec.value, fri = selRiesgo.value;
      var rows = abiertos.filter(function (p) {
        if (fr && p.responsable !== fr) return false;
        if (fe && p.tecnico !== fe) return false;
        if (fri) { var o = riesgoOrden(p); if (fri === 'vencido' && o !== 0) return false; if (fri === 'porvencer' && o !== 1) return false; if (fri === 'sinmov' && o !== 2) return false; }
        if (!q) return true;
        return ((p.inv || '') + ' ' + equipoCorto(p.equipo) + ' ' + (p.observaciones || '') + ' ' + (p.tipo || '') + ' ' + (p.tecnico || '') + ' ' + (p.responsable || '')).toLowerCase().indexOf(q) >= 0;
      });
      rows.sort(function (a, b) {
        var d = riesgoOrden(a) - riesgoOrden(b); if (d) return d;
        var ca = a.fecha_resolucion || '9999-99-99', cb = b.fecha_resolucion || '9999-99-99';
        if (ca !== cb) return ca < cb ? -1 : 1;
        return diasSinSeguimiento(b) - diasSinSeguimiento(a);
      });
      note.textContent = rows.length + ' pendiente(s)';
      cont.innerHTML = '';
      if (!rows.length) { cont.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🔎'), el('div', {}, 'Sin pendientes que coincidan.')])); return; }
      var wrap = el('div', { class: 'tabla-wrap' }); var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [th('Riesgo'), th('Descripción'), th('Equipo'), th('Ejecutor'), th('Asegura'), th('Estado'), th('Compromiso'), th('Últ. seguimiento'), th('Acciones')])));
      var tb = el('tbody');
      rows.forEach(function (p) {
        var tr = el('tr');
        var r = riesgoPend(p);
        tr.appendChild(td(r ? el('span', { class: 'age-pill ' + r.cls }, r.label) : (riesgoOrden(p) === 2 ? el('span', { class: 'age-pill age-warn' }, 'Sin movimiento') : document.createTextNode('—'))));
        tr.appendChild(td(textoPend(p)));
        tr.appendChild(td(equipoCorto(p.equipo) || '—'));
        tr.appendChild(td(p.tecnico || '—'));
        tr.appendChild(td(p.responsable || '—'));
        tr.appendChild(td(selEstadoPend(p, renderSeguimiento)));
        tr.appendChild(td(p.fecha_resolucion ? fmtFecha(p.fecha_resolucion) : '—'));
        tr.appendChild(td(ultimoSeguimientoTxt(p)));
        var acc = el('td', { class: 'acciones' });
        var bSeg = el('button', { class: 'btn btn-sm btn-primary', title: 'Registrar seguimiento' }, '📝 Seguimiento'); bSeg.onclick = function () { registrarSeguimiento(p); };
        var bEd = el('button', { class: 'btn btn-sm', title: 'Editar' }, '✏️'); bEd.onclick = function () { abrirEditarPendiente(p); };
        acc.appendChild(bSeg); acc.appendChild(document.createTextNode(' ')); acc.appendChild(bEd);
        tr.appendChild(acc);
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); cont.appendChild(wrap);
    }
    search.addEventListener('input', pintar); selResp.addEventListener('change', pintar); selEjec.addEventListener('change', pintar); selRiesgo.addEventListener('change', pintar);
    pintar();
    card.appendChild(body); contentEl.appendChild(card);
  }

  // --------------------------------------------------------------- Etapa view
  function renderEtapa(id) {
    var etapa = ETAPAS_BY_ID[id];
    setTitulo(etapa.icono + ' ' + etapa.nombre, etapa.via + ' · ' + (DB.registros[id].length) + ' registro(s)');
    configurarExport('Exportar etapa', function () { exportarEtapa(etapa); });
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
        var editandoAhora = !!editando;
        // El año/mes de MP se derivan de la fecha (campos derivados): sin desajuste.
        // El aviso de éxito solo si REALMENTE se guardó (si no, guardarDB ya avisó).
        if (persistirRegistro(id, rec, editando)) toast(editandoAhora ? 'Registro actualizado.' : ('Registro de «' + etapa.nombre + '» creado.'), 'ok');
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

    function filtrarRegistros() {
      var f = search.value.trim().toLowerCase();
      var etf = selEtapa.value;
      return bitacoraRows().filter(function (x) {
        if (etf && x.et.id !== etf) return false;
        if (!f) return true;
        return x._hay.indexOf(f) >= 0;
      });
    }

    // El botón superior exporta los registros visibles (etapa + búsqueda actuales).
    configurarExport('Exportar registros', function () {
      var rows = filtrarRegistros();
      if (!rows.length) { toast('No hay registros que exportar en esta vista.', 'err'); return; }
      try {
        XLSXWriter.descargar(nombreArchivo('Registros'), [hojaBitacoraDesde(rows)]);
        toast(rows.length + ' registro(s) exportados.', 'ok');
      } catch (e) { toast('Error al exportar: ' + e.message, 'err'); }
    });

    function pintar() {
      var rows = filtrarRegistros();
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
        tr.appendChild(td(celdaEstadoResultado(r)));
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
  // Celda «Estado / Resultado»: para mantenciones muestra el RESULTADO y el
  // ESTADO DEL EQUIPO por separado (son cosas distintas: p. ej. resultado «Si»
  // pero equipo «No operativo»), evitando confundir uno con otro.
  function celdaEstadoResultado(r) {
    var esMP = (r._stage === 'mp') || (r.resultado && r.estado_equipo);
    if (esMP && (r.resultado || r.estado_equipo)) {
      var wrap = el('span', { style: 'display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center' });
      if (r.resultado) { var pr = pillFor('resultado', r.resultado); pr.setAttribute('title', 'Resultado de la mantención'); wrap.appendChild(pr); }
      if (r.estado_equipo) { var pe = pillFor('estado_equipo', r.estado_equipo); pe.setAttribute('title', 'Estado del equipo'); wrap.appendChild(pe); }
      return wrap;
    }
    var er = estadoResultado(r);
    return er ? pillFor(estadoResultadoKey(r), er) : document.createTextNode('—');
  }
  function estadoResultadoTexto(r) {
    if (r._stage === 'mp' && (r.resultado || r.estado_equipo)) {
      return [r.resultado ? ('Resultado: ' + r.resultado) : '', r.estado_equipo ? ('Estado: ' + r.estado_equipo) : ''].filter(Boolean).join(' · ');
    }
    return estadoResultado(r);
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
    var nMP = DB.registros.mp.length;
    body3.appendChild(el('div', { class: 'hint' },
      'Los registros se guardan localmente en este navegador (localStorage) de forma comprimida. ' +
      'Uso aproximado: ' + tamanoAlmacenamientoKB() + ' KB · ' + totalRegistros() + ' registros (' + nMP + ' mantenciones preventivas). ' +
      'Use el respaldo para trasladarlos a otro equipo.'));
    var actions = el('div', { class: 'form-actions' });

    var bExport = el('button', { class: 'btn btn-success' }, '⬇️ Exportar a Excel (.xlsx)');
    bExport.onclick = exportarTodo;
    var bBackup = el('button', { class: 'btn' }, '🗄️ Descargar respaldo (JSON)');
    bBackup.onclick = exportarRespaldo;
    var bRestore = el('button', { class: 'btn' }, '📤 Restaurar respaldo (JSON)');
    bRestore.onclick = importarRespaldo;
    var bClearMP = el('button', { class: 'btn btn-danger' }, '🧰 Vaciar mantenciones preventivas');
    bClearMP.onclick = function () {
      if (!nMP) { toast('No hay mantenciones preventivas que vaciar.', 'err'); return; }
      if (!confirm('¿Vaciar las ' + nMP + ' mantenciones preventivas? Libera espacio y se pueden volver a importar desde la Programación MP (.xlsm). Se recomienda descargar un respaldo antes.')) return;
      DB.registros.mp = [];
      if (guardarDB()) toast('Mantenciones preventivas vaciadas.', 'ok');
      renderSidebar(); renderConfig();
    };
    var nEq = getEquipos().length;
    var bClearInv = el('button', { class: 'btn btn-danger' }, '🗑️ Vaciar inventario de equipos');
    bClearInv.onclick = function () {
      if (!nEq) { toast('El inventario ya está vacío.', 'err'); return; }
      if (!confirm('¿Vaciar el inventario de ' + nEq + ' equipos? Se eliminan los equipos (se pueden volver a cargar importando la Programación MP .xlsm). Los registros NO se tocan. Se recomienda descargar un respaldo antes.')) return;
      DB.equiposOverrides = {}; invalidarEquipos();
      if (guardarDB()) toast('Inventario de equipos vaciado.', 'ok');
      renderSidebar(); navegar('__buscar');
    };
    var bClear = el('button', { class: 'btn btn-danger' }, '🗑️ Borrar todo (reiniciar)');
    bClear.onclick = function () {
      if (!confirm('¿Borrar TODO y reiniciar? Se eliminan los registros (mantenciones, pendientes, solicitudes…) Y el inventario de equipos. Esta acción no se puede deshacer. Se recomienda descargar un respaldo antes.')) return;
      ETAPAS.forEach(function (e) { DB.registros[e.id] = []; });
      DB.equiposOverrides = {}; invalidarEquipos();
      guardarDB(); toast('Todo borrado: registros e inventario.'); navegar('__buscar');
    };
    actions.appendChild(bExport); actions.appendChild(bBackup); actions.appendChild(bRestore); actions.appendChild(bClearMP); actions.appendChild(bClearInv); actions.appendChild(bClear);
    body3.appendChild(actions);
    card3.appendChild(body3);
    contentEl.appendChild(card3);

    // ---- Google Sheets ----
    var cfg = gsCfg();
    var card4 = el('div', { class: 'card gs-card' });
    card4.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, '☁️ Guardar en Google Sheets'), el('span', { class: 'desc' }, 'Sincroniza la base con una hoja de cálculo (respaldo central, accesible desde cualquier equipo).')]));
    var b4 = el('div', { class: 'card-body' });

    var rowUrl = el('div', { class: 'gs-row' });
    var inUrl = el('input', { type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', value: cfg.url || '', 'aria-label': 'URL del App web de Google' });
    var bUrl = el('button', { class: 'btn btn-primary' }, '💾 Guardar URL');
    bUrl.onclick = function () { cfg.url = inUrl.value.trim(); guardarDB(); gsActualizarChip(); toast(cfg.url ? 'URL guardada.' : 'URL borrada (modo local).', 'ok'); renderConfig(); };
    rowUrl.appendChild(inUrl); rowUrl.appendChild(bUrl);
    b4.appendChild(rowUrl);

    var rowAuto = el('div', { class: 'gs-row' });
    var lblAuto = el('label', { style: 'display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer' });
    var chkAuto = el('input', { type: 'checkbox' }); chkAuto.checked = !!cfg.auto;
    chkAuto.onchange = function () { cfg.auto = chkAuto.checked; guardarDB(); gsActualizarChip(); };
    lblAuto.appendChild(chkAuto); lblAuto.appendChild(document.createTextNode('Guardar automáticamente en Google Sheets cada vez que cambien los datos'));
    rowAuto.appendChild(lblAuto);
    b4.appendChild(rowAuto);

    var rowBtns = el('div', { class: 'gs-row' });
    var bAhora = el('button', { class: 'btn btn-success' }, '☁️ Guardar ahora'); bAhora.onclick = function () { gsPush(true); };
    var bCargar = el('button', { class: 'btn' }, '⬇️ Cargar desde Google Sheets'); bCargar.onclick = function () { gsPull(); };
    var bProbar = el('button', { class: 'btn' }, '🔌 Probar conexión'); bProbar.onclick = function () { gsProbar(); };
    rowBtns.appendChild(bAhora); rowBtns.appendChild(bCargar); rowBtns.appendChild(bProbar);
    b4.appendChild(rowBtns);

    b4.appendChild(el('div', { class: 'hint' }, cfg.url
      ? 'Se guarda una copia local (este navegador) y se sincroniza con Google Sheets. La hoja «_gec_datos» guarda el estado exacto; «Registros» e «Inventario» son las hojas legibles.'
      : 'Sin URL configurada: los datos se guardan solo en este navegador (localStorage). Sigue los pasos de abajo para conectar una Google Sheet.'));

    var det = el('details', { class: 'gs-code' });
    det.appendChild(el('summary', {}, '¿Cómo conectar una Google Sheet? (configuración única)'));
    var ol = el('ol', { class: 'gs-pasos' });
    [
      'Crea una Google Sheet nueva (escribe sheets.new en el navegador) o abre la que quieras usar.',
      'En esa hoja: menú Extensiones → Apps Script. Borra el contenido y pega el código de abajo. Guarda (💾).',
      'Pulsa Implementar → Nueva implementación → engranaje → «App web». Ejecutar como: «Yo». Con acceso: «Cualquiera». Implementar, y autoriza los permisos cuando los pida.',
      'Copia la URL que termina en /exec, pégala arriba y pulsa «Guardar URL». Luego «Probar conexión».',
      'Activa «Guardar automáticamente» y pulsa «Guardar ahora». En otro equipo, pega la MISMA URL y usa «Cargar desde Google Sheets».'
    ].forEach(function (p) { ol.appendChild(el('li', {}, p)); });
    det.appendChild(ol);
    var bCopiar = el('button', { class: 'btn btn-sm', style: 'margin:8px 0' }, '📋 Copiar código de Apps Script');
    var ta = el('textarea', { readonly: 'readonly', spellcheck: 'false', 'aria-label': 'Código de Apps Script' }, gsAppsScriptCode());
    bCopiar.onclick = function () { ta.focus(); ta.select(); try { document.execCommand('copy'); toast('Código copiado al portapapeles.', 'ok'); } catch (e) { toast('Selecciona el texto y cópialo manualmente.', 'err'); } };
    det.appendChild(bCopiar); det.appendChild(ta);
    b4.appendChild(det);

    card4.appendChild(b4);
    contentEl.appendChild(card4);
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
          guardarDB(); toast('Respaldo restaurado.', 'ok'); navegar('__buscar');
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

  function colsBitacora() {
    return [
      { titulo: 'Folio', ancho: 14, get: function (x) { return x.r.folio || ''; } },
      { titulo: 'Fecha', ancho: 12, get: function (x) { return fmtFecha(x.r.fecha); } },
      { titulo: 'Etapa', ancho: 26, get: function (x) { return x.et.nombre; } },
      { titulo: 'Vía', ancho: 12, get: function (x) { return x.et.via; } },
      { titulo: 'N° Inventario', ancho: 14, get: function (x) { return x.r.equipo ? (x.r.equipo.inv || '') : ''; } },
      { titulo: 'Equipo', ancho: 20, get: function (x) { return x.r.equipo ? (x.r.equipo.nombre || '') : ''; } },
      { titulo: 'Servicio', ancho: 22, get: function (x) { return x.r.equipo ? (x.r.equipo.servicio || '') : ''; } },
      { titulo: 'Serie', ancho: 16, get: function (x) { return x.r.equipo ? (x.r.equipo.serie || '') : ''; } },
      { titulo: 'Técnico', ancho: 24, get: function (x) { return x.r.tecnico || ''; } },
      { titulo: 'Estado / Resultado', ancho: 22, get: function (x) { return estadoResultadoTexto(x.r); } },
      { titulo: 'Empresa', ancho: 22, get: function (x) { return x.r.empresa || ''; } },
      { titulo: 'N° documento', ancho: 16, get: function (x) { return numeroDoc(x.r); } },
      { titulo: 'Observaciones', ancho: 40, get: function (x) { return x.r.observaciones || ''; } },
      { titulo: 'Registrado el', ancho: 18, get: function (x) { return fmtFechaHora(x.r._createdAt); } }
    ];
  }
  function hojaBitacoraDesde(rows, nombre) {
    var cols = colsBitacora();
    return {
      nombre: nombre || 'Bitácora general',
      columnas: cols.map(function (c) { return { titulo: c.titulo, ancho: c.ancho }; }),
      filas: rows.map(function (x) { return cols.map(function (c) { return c.get(x); }); })
    };
  }
  function hojaBitacora() { return hojaBitacoraDesde(bitacoraRows()); }

  function hojaInventarioDesde(items, nombre) {
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
      nombre: nombre || 'Inventario',
      columnas: cols.map(function (c) { return { titulo: c.titulo, ancho: c.ancho }; }),
      filas: items.map(function (x) { return cols.map(function (c) { return c.get(x); }); })
    };
  }
  function hojaInventario() {
    var inv = calcInventario();
    inv.sort(function (a, b) { return cmpNat(a.e.id, b.e.id) || cmpNat(a.e.inventario, b.e.inventario); });
    return hojaInventarioDesde(inv, 'Inventario');
  }

  // Nombre de archivo saneado + fecha.
  function nombreArchivo(base) {
    return (String(base).replace(/[^\wáéíóúñ ]/gi, '').trim().replace(/\s+/g, '_') || 'Export') + '_' + hoyISO() + '.xlsx';
  }

  function exportarInventario() {
    try {
      XLSXWriter.descargar('Inventario_Equipos_' + hoyISO() + '.xlsx', [hojaInventario()]);
      toast('Inventario exportado a Excel.', 'ok');
    } catch (e) { toast('Error al exportar: ' + e.message, 'err'); }
  }

  // ---- Exportación contextual: el botón superior exporta la vista actual ----
  var vistaExport = null;
  function exportarVistaActual() { (typeof vistaExport === 'function' ? vistaExport : exportarTodo)(); }
  function configurarExport(label, fn) {
    vistaExport = (typeof fn === 'function') ? fn : exportarTodo;
    var b = document.getElementById('btnExport');
    if (b) { b.textContent = '⬇️ ' + label; b.setAttribute('title', 'Exportar a Excel — ' + label.toLowerCase()); }
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

  // Una MP se considera "tocada a mano" (y por tanto NO se sobrescribe al
  // re-importar) si está marcada manual O si tiene cualquier dato agregado por el
  // usuario: ejecutor, observaciones, estado del equipo, tareas o bitácora.
  // Red de seguridad: aunque _origen quedara como 'import' (versiones antiguas),
  // el trabajo del usuario nunca se pierde al volver a subir el .xlsm.
  function mpTocadaAMano(r) {
    return r._origen === 'manual'
      || (r.tecnico && String(r.tecnico).trim())
      || (r.observaciones && String(r.observaciones).trim())
      || (r.estado_equipo && String(r.estado_equipo).trim())
      || (Array.isArray(r.tareas) && r.tareas.length > 0)
      || (Array.isArray(r.actualizaciones) && r.actualizaciones.length > 0);
  }

  // Importa eventos como registros MP (sin guardar/navegar); devuelve conteos.
  // Solo crea/actualiza mantenciones provenientes de la importación: NO toca las
  // mantenciones creadas o editadas a mano (manual o con datos del usuario).
  function importarEventosMP(events, year) {
    var idx = {};
    DB.registros.mp.forEach(function (r) { idx[mpKey(r)] = r; });
    var nuevos = 0, actualizados = 0, preservados = 0;
    (events || []).forEach(function (ev) {
      var equipo = { inv: ev[2], nombre: ev[3], servicio: ev[4], unidad: ev[5], ubicacion: ev[6], marca: ev[8], modelo: ev[9], serie: ev[10] };
      var mes = ev[13], tipo = ev[14], resultado = ev[15];
      var anio = year ? String(year) : '';
      var fecha = mpFecha(anio, mes);
      var key = [equipo.inv, anio, mes, tipo].join('|');
      var ex = idx[key];
      if (ex && mpTocadaAMano(ex)) {
        // Trabajo del usuario: se conserva COMPLETO (incluido el resultado) y se
        // deja marcado como manual para que futuras importaciones lo respeten.
        if (ex._origen !== 'manual') ex._origen = 'manual';
        preservados++;
        return;
      }
      if (ex) { ex.resultado = resultado; ex.fecha = fecha; ex.equipo = equipo; ex.anio = anio; ex._origen = 'import'; ex._updatedAt = new Date().toISOString(); actualizados++; }
      else {
        var rec = { _id: uid(), _stage: 'mp', _origen: 'import', _createdAt: new Date().toISOString(), equipo: equipo, fecha: fecha, anio: anio, mes: mes, tipo: tipo, resultado: resultado, observaciones: '', tareas: [], actualizaciones: [] };
        DB.registros.mp.push(rec); idx[key] = rec; nuevos++;
      }
    });
    return { nuevos: nuevos, actualizados: actualizados, preservados: preservados };
  }

  // Acción principal del módulo MP: actualiza el inventario + importa las mantenciones.
  function actualizarEImportarMP() {
    if (!MP_STATE.events) { toast('Primero carga un archivo .xlsm.', 'err'); return; }
    if (!confirm('Se actualizarán SOLO el inventario y los resultados de las mantenciones preventivas (actualiza, no duplica).\n\nNO se modifican los pendientes ni los eventos registrados a mano en el programa (incluidas las mantenciones que hayas creado o editado manualmente).\n\n¿Continuar?')) return;
    var resEq = actualizarEquipos(MP_STATE.equipos || []);
    var resEv = importarEventosMP(MP_STATE.events, MP_STATE.year);
    var guardado = guardarDB();
    // Totales tras importar (lo que el usuario ve en el sistema), no solo lo nuevo:
    // así, aunque el archivo ya estuviera importado (0 nuevas), queda claro que las
    // mantenciones SÍ están cargadas.
    var totalEquipos = getEquipos().length, totalMP = (DB.registros.mp || []).length;
    var det = resEv.nuevos + ' nuevas, ' + resEv.actualizados + ' actualizadas' + (resEv.preservados ? (', ' + resEv.preservados + ' manuales conservadas') : '');
    var msg = 'Listo: ' + totalEquipos + ' equipos y ' + totalMP + ' mantenciones preventivas en el sistema (' + det + ').';
    // Solo declarar éxito si REALMENTE se guardó; si no, guardarDB ya avisó del problema.
    if (guardado) toast(msg, 'ok');
    else toast('Importación NO guardada (almacenamiento lleno). ' + msg + ' Libere espacio y reintente.', 'err');
    navegar('__buscar');
  }

  // ------------------------------------------------------------------- Init
  function init() {
    contentEl = document.getElementById('content');
    viewTitleEl = document.getElementById('viewTitle');
    viewSubEl = document.getElementById('viewSub');

    document.getElementById('btnExport').onclick = exportarVistaActual;
    var mt = document.getElementById('menuToggle');
    var sb = document.getElementById('sidebar');
    var bd = document.getElementById('backdrop');
    var appEl = document.querySelector('.app');
    function esMovil() { return window.matchMedia('(max-width: 820px)').matches; }
    // Restaurar estado plegado (solo aplica en escritorio).
    try { if (localStorage.getItem('gec_navcol') === '1') appEl.classList.add('nav-collapsed'); } catch (e) {}
    mt.onclick = function () {
      if (esMovil()) {
        // Móvil: menú deslizable con fondo oscuro.
        var abierto = sb.classList.toggle('open'); bd.classList.toggle('show');
        mt.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      } else {
        // Escritorio: plegar/desplegar para dar ancho a las tablas.
        var col = appEl.classList.toggle('nav-collapsed');
        try { localStorage.setItem('gec_navcol', col ? '1' : '0'); } catch (e) {}
        mt.setAttribute('aria-expanded', col ? 'false' : 'true');
        mt.setAttribute('title', col ? 'Mostrar el menú' : 'Ocultar el menú');
      }
    };
    bd.onclick = function () { sb.classList.remove('open'); bd.classList.remove('show'); mt.setAttribute('aria-expanded', 'false'); };

    // ---- Sincronización con Google Sheets ----
    var chip = document.getElementById('gsChip');
    if (chip) chip.onclick = function () { navegar('__config'); };
    gsActualizarChip();

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
