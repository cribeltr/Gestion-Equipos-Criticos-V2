/* ============================================================================
 * Gestión de Equipos Críticos — UI con el diseño de esta app sobre el núcleo
 * lógico de SIGEM (window.HHHA, en core/hhha-core.js). Toda la lógica y reglas
 * de negocio viven en el núcleo; aquí solo está la presentación (nuestro look).
 * Etapa 1: Resumen, Inventario, vistas por estado, ficha de equipo, Pendientes
 * y Eventos. (Ciclos, Conciliación, Cumplimiento y Auditoría: próximas etapas.)
 * ========================================================================== */
(function () {
  'use strict';
  var H = window.HHHA;
  if (!H) { document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">Falta core/hhha-core.js</p>'; return; }

  // ------------------------------------------------------------------ Helpers
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null) continue;
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    if (children != null) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return n;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function th(t) { return el('th', {}, t); }
  function td(c) { return el('td', {}, [typeof c === 'object' && c ? c : document.createTextNode(c == null ? '' : String(c))]); }
  var fmtFecha = H.fmtFecha || function (x) { return x || ''; };
  function cmpNat(a, b) { return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'es', { numeric: true, sensitivity: 'base' }); }
  function normNum(s) { return String(s == null ? '' : s).replace(/\d+/g, function (d) { return d.replace(/^0+(\d)/, '$1'); }); }

  function toast(msg, tipo) {
    var cont = document.getElementById('toasts');
    var cls = (tipo === 'error' || tipo === 'err') ? 'err' : (tipo === 'success' || tipo === 'ok') ? 'ok' : '';
    var t = el('div', { class: 'toast ' + cls }, msg);
    cont.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  // Estados del núcleo -> píldoras de nuestro diseño.
  var EST_CLS = { operativo: 'pill-ok', no_operativo: 'pill-no', en_servicio_tecnico: 'pill-st', baja: 'pill-baja', desconocido: 'pill-gray' };
  function estadoPill(k) { return el('span', { class: 'pill ' + (EST_CLS[k] || 'pill-gray') }, H.ESTADO_LABEL[k] || k); }
  var PEND_CLS = { no_iniciado: 'pill-gray', en_proceso: 'pill-st', cerrado: 'pill-ok' };
  function pendPill(k) { return el('span', { class: 'pill ' + (PEND_CLS[k] || 'pill-gray') }, H.ESTADO_PEND_LABEL[k] || k); }
  function tipoPendLabel(k) { return (H.TIPO_PENDIENTE && H.TIPO_PENDIENTE[k]) || k || '—'; }

  function equipoMarcaModelo(e) { return [e.marca, e.modelo].filter(Boolean).join(' '); }
  function encargado(eq) { try { return H.encargadoDe ? H.encargadoDe(eq) : (eq.encargado || ''); } catch (e) { return ''; } }

  // --------------------------------------------------------------- Estado/Nav
  var STATE = { view: '__resumen' };
  var ESTADO_VIEWS = {
    '__est_operativo': 'operativo', '__est_no_operativo': 'no_operativo',
    '__est_st': 'en_servicio_tecnico', '__est_baja': 'baja', '__est_desconocido': 'desconocido'
  };
  var EST_VIEW = { operativo: '__est_operativo', no_operativo: '__est_no_operativo', en_servicio_tecnico: '__est_st', baja: '__est_baja', desconocido: '__est_desconocido' };

  var GRUPOS_NAV = [
    { label: 'Inicio', items: ['__resumen', '__inv'] },
    { label: 'Estado de equipos', items: ['__est_operativo', '__est_no_operativo', '__est_st', '__est_baja', '__pendientes', '__est_desconocido'] },
    { label: 'Gestión', items: ['__eventos', '__ciclos'] }
  ];

  var contentEl, viewTitleEl, viewSubEl;
  function setTitulo(t, s) { viewTitleEl.textContent = t; viewSubEl.textContent = s || ''; }

  function navegar(view) {
    STATE.view = view;
    render();
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('backdrop').classList.remove('show');
    var mt = document.getElementById('menuToggle'); if (mt) mt.setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ Conteos / KPI
  function distEstados() { var d = { operativo: 0, no_operativo: 0, en_servicio_tecnico: 0, baja: 0, desconocido: 0 }; H.getState().equipos.forEach(function (e) { d[e.estado] = (d[e.estado] || 0) + 1; }); return d; }
  function pendientesAbiertos() { return H.getState().pendientes.filter(function (p) { return !p.anulado && p.estado !== 'cerrado'; }).length; }
  function ciclosAbiertos() { return (H.getState().ciclos || []).filter(function (c) { return c.estado === 'abierto'; }).length; }
  function eventosVigentes() { return H.getState().eventos.filter(function (e) { return !e.anulado; }); }

  // ------------------------------------------------------------------ Sidebar
  function render() {
    renderSidebar();
    if (STATE.view === '__resumen') renderResumen();
    else if (STATE.view === '__inv') renderInventario(null);
    else if (ESTADO_VIEWS[STATE.view]) renderInventario(ESTADO_VIEWS[STATE.view]);
    else if (STATE.view === '__pendientes') renderPendientes();
    else if (STATE.view === '__eventos') renderEventos();
    else if (STATE.view === '__ciclos') renderCiclos();
    else renderResumen();
  }

  function renderSidebar() {
    var nav = document.getElementById('nav');
    nav.innerHTML = '';
    var dist = distEstados();
    var conEventos = H.getState().equipos.length;
    GRUPOS_NAV.forEach(function (g) {
      nav.appendChild(el('div', { class: 'group-label' }, g.label));
      g.items.forEach(function (id) {
        var label, icono, badge = null, badgeTitle = null;
        if (id === '__resumen') { label = 'Resumen'; icono = '📊'; }
        else if (id === '__inv') { label = 'Inventario de equipos'; icono = '🩺'; badge = conEventos; badgeTitle = 'equipos'; }
        else if (id === '__est_operativo') { label = 'Operativos'; icono = '✅'; badge = dist.operativo; badgeTitle = 'equipos en este estado'; }
        else if (id === '__est_no_operativo') { label = 'No operativos'; icono = '⛔'; badge = dist.no_operativo; badgeTitle = 'equipos en este estado'; }
        else if (id === '__est_st') { label = 'En servicio técnico'; icono = '🛠️'; badge = dist.en_servicio_tecnico; badgeTitle = 'equipos en este estado'; }
        else if (id === '__est_baja') { label = 'Baja'; icono = '🚫'; badge = dist.baja; badgeTitle = 'equipos dados de baja'; }
        else if (id === '__est_desconocido') { label = 'Desconocido'; icono = '❔'; badge = dist.desconocido; badgeTitle = 'equipos sin estado'; }
        else if (id === '__pendientes') { label = 'Pendientes'; icono = '⚠️'; badge = pendientesAbiertos(); badgeTitle = 'pendientes abiertos'; }
        else if (id === '__eventos') { label = 'Eventos'; icono = '🗂️'; badge = eventosVigentes().length; badgeTitle = 'eventos'; }
        else if (id === '__ciclos') { label = 'Ciclos correctivos'; icono = '🔁'; badge = ciclosAbiertos(); badgeTitle = 'ciclos abiertos'; }
        var activo = STATE.view === id;
        var a = el('a', {
          class: activo ? 'active' : '', role: 'link', tabindex: '0', 'aria-current': activo ? 'page' : null,
          'aria-label': (badge != null && badge > 0 && badgeTitle) ? (label + ' (' + badge + ' ' + badgeTitle + ')') : label
        }, [el('span', { class: 'ico', 'aria-hidden': 'true' }, icono), el('span', {}, label),
          (badge != null && badge > 0) ? el('span', { class: 'badge', title: badgeTitle }, String(badge)) : null]);
        a.onclick = function () { navegar(id); };
        a.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); navegar(id); } };
        nav.appendChild(a);
      });
    });
  }

  // ----------------------------------------------------------------- Resumen
  function renderResumen() {
    setTitulo('Resumen del proceso', 'Gestión de equipos biomédicos críticos · núcleo SIGEM');
    configurarExport('Exportar inventario', exportarInventarioTodo);
    contentEl.innerHTML = '';
    var st = H.getState();
    var dist = distEstados();

    var stats = el('div', { class: 'stat-grid' });
    function stat(n, l, estado, accent) {
      var box = el('div', { class: 'stat' + (accent ? ' accent' : '') + (estado ? ' row-click' : ''), title: estado ? ('Ver equipos: ' + l) : null }, [el('div', { class: 'n' }, String(n)), el('div', { class: 'l' }, l)]);
      if (estado) box.onclick = function () { navegar(EST_VIEW[estado]); };
      return box;
    }
    stats.appendChild(stat(st.equipos.length, 'Equipos críticos'));
    stats.appendChild(stat(dist.operativo, 'Operativos', 'operativo', true));
    stats.appendChild(stat(dist.no_operativo, 'No operativos', 'no_operativo'));
    stats.appendChild(stat(dist.en_servicio_tecnico, 'En servicio técnico', 'en_servicio_tecnico'));
    stats.appendChild(stat(dist.baja, 'De baja', 'baja'));
    stats.appendChild(stat(pendientesAbiertos(), 'Pendientes abiertos'));
    stats.appendChild(stat(ciclosAbiertos(), 'Ciclos abiertos'));
    contentEl.appendChild(stats);

    contentEl.appendChild(el('div', { class: 'banner' },
      'El estado de cada equipo se calcula automáticamente en el núcleo a partir de sus eventos y mantenciones. ' +
      'Haga clic en una tarjeta o en el menú lateral para ver los equipos de cada estado.'));

    // Actividad reciente (eventos)
    var card2 = el('div', { class: 'card' });
    card2.appendChild(el('div', { class: 'card-head' }, [el('h3', {}, 'Actividad reciente'), el('span', { class: 'desc' }, 'Últimos eventos registrados')]));
    var evs = eventosVigentes().slice().sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || ''); }).slice(0, 10);
    if (!evs.length) card2.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🗒️'), el('div', {}, 'Sin eventos.')]));
    else {
      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [th('Fecha'), th('Tipo'), th('Folio'), th('Equipo'), th('Servicio'), th('Ejecutor')])));
      var tb = el('tbody');
      evs.forEach(function (e) {
        tb.appendChild(el('tr', {}, [td(fmtFecha(e.fecha)), td(el('span', { class: 'tag-etapa' }, e.tipo || '—')), td(e.folio || '—'),
          td((e.inv || '') + ' — ' + (e.equipo || '')), td(e.servicio || '—'), td(e.ejecutor || '—')]));
      });
      t.appendChild(tb); wrap.appendChild(t); card2.appendChild(wrap);
    }
    contentEl.appendChild(card2);
  }

  // --------------------------------------------------------------- Inventario
  function renderInventario(estadoFiltro) {
    var titulos = {
      operativo: ['✅ Equipos operativos', 'Equipos cuyo estado actual es operativo'],
      no_operativo: ['⛔ Equipos no operativos', 'Equipos cuyo estado actual es no operativo'],
      en_servicio_tecnico: ['🛠️ Equipos en servicio técnico', 'Equipos actualmente en servicio técnico'],
      baja: ['🚫 Equipos dados de baja', 'Equipos dados de baja'],
      desconocido: ['❔ Equipos sin estado', 'Equipos sin estado determinado']
    };
    if (estadoFiltro && titulos[estadoFiltro]) setTitulo(titulos[estadoFiltro][0], titulos[estadoFiltro][1]);
    else setTitulo('🩺 Inventario de equipos', H.getState().equipos.length + ' equipos críticos · estado automático');
    contentEl.innerHTML = '';

    var equipos = H.getState().equipos;
    var dist = distEstados();

    var stats = el('div', { class: 'stat-grid' });
    function st(n, l, estado, accent) {
      var box = el('div', { class: 'stat' + (accent ? ' accent' : '') + ' row-click', title: 'Ver equipos: ' + l }, [el('div', { class: 'n' }, String(n)), el('div', { class: 'l' }, l)]);
      box.onclick = function () { navegar(EST_VIEW[estado]); };
      return box;
    }
    stats.appendChild(st(dist.operativo, 'Operativos', 'operativo', true));
    stats.appendChild(st(dist.no_operativo, 'No operativos', 'no_operativo'));
    stats.appendChild(st(dist.en_servicio_tecnico, 'En servicio técnico', 'en_servicio_tecnico'));
    stats.appendChild(st(dist.baja, 'De baja', 'baja'));
    stats.appendChild(st(dist.desconocido, 'Desconocido', 'desconocido'));
    contentEl.appendChild(stats);

    var card = el('div', { class: 'card' });
    var body = el('div', { class: 'card-body' });
    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Buscar por inventario, equipo, serie, marca, servicio, ubicación…', 'aria-label': 'Buscar equipo' });
    var selEstado = el('select', { 'aria-label': 'Filtrar por estado' });
    [['', 'Todos los estados'], ['operativo', 'Operativo'], ['no_operativo', 'No operativo'], ['en_servicio_tecnico', 'En servicio técnico'], ['baja', 'Baja'], ['desconocido', 'Desconocido']]
      .forEach(function (o) { selEstado.appendChild(el('option', { value: o[0] }, o[1])); });
    if (estadoFiltro) selEstado.value = estadoFiltro;
    toolbar.appendChild(search); toolbar.appendChild(selEstado);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var note = el('span', { class: 'count-note' }); toolbar.appendChild(note);
    var btnExp = el('button', { class: 'btn' }, '⬇️ Exportar lo visible'); toolbar.appendChild(btnExp);
    body.appendChild(toolbar);
    var cont = el('div'); body.appendChild(cont);

    // Haystacks (con normalización de ceros a la izquierda para series).
    var rows0 = equipos.map(function (e) {
      var hay = [e.id, e.carpeta, e.inv, e.fam, e.equipo, e.servicio, e.unidad, e.ubic, e.marca, e.modelo, e.serie, e.proc].map(function (x) { return x == null ? '' : x; }).join(' ').toLowerCase();
      return { e: e, hay: hay, hayN: normNum(hay) };
    });

    function filtrar() {
      var q = search.value.trim().toLowerCase(), qN = normNum(q), ef = selEstado.value;
      var rs = rows0.filter(function (r) {
        if (ef && r.e.estado !== ef) return false;
        if (!q) return true;
        return r.hay.indexOf(q) >= 0 || r.hayN.indexOf(qN) >= 0;
      });
      rs.sort(function (a, b) { return cmpNat(a.e.id, b.e.id) || cmpNat(a.e.inv, b.e.inv); });
      return rs;
    }
    function exportarVista() {
      var rs = filtrar(); if (!rs.length) { toast('No hay equipos que exportar.', 'err'); return; }
      var aoa = [['ID', 'N° Carpeta', 'N° Inventario', 'Familia', 'Equipo', 'Servicio', 'Unidad', 'Ubicación', 'Marca', 'Modelo', 'Serie', 'Año', 'Clasificación', 'Encargado', 'Estado']];
      rs.forEach(function (r) { var e = r.e; aoa.push([e.id, e.carpeta, e.inv, e.fam, e.equipo, e.servicio, e.unidad, e.ubic, e.marca, e.modelo, e.serie, e.ano, e.clasif, encargado(e), H.ESTADO_LABEL[e.estado] || e.estado]); });
      exportarAOA(estadoFiltro ? ('Inventario_' + estadoFiltro) : 'Inventario', aoa);
      toast(rs.length + ' equipo(s) exportados.', 'ok');
    }
    btnExp.onclick = exportarVista;
    configurarExport(estadoFiltro ? ('Exportar ' + (H.ESTADO_LABEL[estadoFiltro] || estadoFiltro)) : 'Exportar inventario', exportarVista);

    function pintar() {
      var rs = filtrar();
      note.textContent = rs.length + ' equipo(s)';
      cont.innerHTML = '';
      if (!rs.length) { cont.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🔎'), el('div', {}, 'Sin resultados.')])); return; }
      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [th('ID'), th('N° Inventario'), th('Equipo'), th('Servicio'), th('Unidad'), th('Ubicación'), th('Marca / Modelo'), th('Serie'), th('Encargado'), th('Estado')])));
      var tb = el('tbody'); var frag = document.createDocumentFragment();
      rs.forEach(function (r) {
        var e = r.e;
        var tr = el('tr', { class: 'row-click' });
        tr.appendChild(td(e.id || '—')); tr.appendChild(td(e.inv || '—')); tr.appendChild(td(e.equipo || '—'));
        tr.appendChild(td(e.servicio || '—')); tr.appendChild(td(e.unidad || '—')); tr.appendChild(td(e.ubic || '—'));
        tr.appendChild(td(equipoMarcaModelo(e) || '—')); tr.appendChild(td(e.serie || '—')); tr.appendChild(td(encargado(e) || '—'));
        tr.appendChild(td(estadoPill(e.estado)));
        tr.onclick = function () { openEquipoFicha(e); };
        frag.appendChild(tr);
      });
      tb.appendChild(frag); t.appendChild(tb); wrap.appendChild(t); cont.appendChild(wrap);
    }
    search.addEventListener('input', pintar);
    selEstado.addEventListener('change', function () { var v = selEstado.value; navegar(v && EST_VIEW[v] ? EST_VIEW[v] : '__inv'); });
    pintar();
    card.appendChild(body); contentEl.appendChild(card);
  }

  // ------------------------------------------------------------- Ficha equipo
  function openEquipoFicha(eq) {
    var cont = el('div');
    cont.appendChild(el('div', { style: 'margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap' }, [
      estadoPill(eq.estado),
      eq.subestado ? el('span', { class: 'count-note' }, '· ' + eq.subestado) : null,
      el('span', { class: 'count-note' }, encargado(eq) ? ('Encargado: ' + encargado(eq)) : 'Sin encargado')
    ]));

    var fg = el('div', { class: 'ficha-grid' });
    [['ID', eq.id], ['N° Inventario', eq.inv], ['N° Carpeta', eq.carpeta], ['Familia', eq.fam], ['Equipo', eq.equipo], ['Servicio', eq.servicio],
    ['Unidad', eq.unidad], ['Ubicación', eq.ubic], ['Procedencia', eq.proc], ['Marca', eq.marca], ['Modelo', eq.modelo], ['Serie', eq.serie],
    ['Año', eq.ano], ['Vida útil residual', eq.vur], ['Clasificación', eq.clasif], ['Frecuencia MP', eq.freq]].forEach(function (p) {
      if (p[1] != null && p[1] !== '') fg.appendChild(el('div', { class: 'it' }, [el('div', { class: 'k' }, p[0]), el('div', { class: 'v' }, String(p[1]))]));
    });
    cont.appendChild(fg);

    // Eventos del equipo
    var evs = (H.eventosDe ? H.eventosDe(eq) : []).filter(function (e) { return !e.anulado; }).sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
    cont.appendChild(el('h4', { class: 'sub-h' }, 'Eventos (' + evs.length + ')'));
    if (!evs.length) cont.appendChild(el('div', { class: 'muted-empty' }, 'Sin eventos.'));
    else {
      var w1 = el('div', { class: 'tabla-wrap' });
      var t1 = el('table', { class: 'data' });
      t1.appendChild(el('thead', {}, el('tr', {}, [th('Fecha'), th('Tipo'), th('Folio'), th('Ejecutor'), th('Estado'), th('Observaciones')])));
      var b1 = el('tbody');
      evs.forEach(function (e) {
        var obs = e.obs || '';
        b1.appendChild(el('tr', {}, [td(fmtFecha(e.fecha)), td(el('span', { class: 'tag-etapa' }, e.tipo || '—')), td(e.folio || '—'), td(e.ejecutor || '—'), td(e.estado || '—'), td(obs.length > 60 ? obs.slice(0, 60) + '…' : (obs || '—'))]));
      });
      t1.appendChild(b1); w1.appendChild(t1); cont.appendChild(w1);
    }

    // Pendientes del equipo
    var pend = (H.pendientesDe ? H.pendientesDe(eq) : []).filter(function (p) { return !p.anulado; });
    cont.appendChild(el('h4', { class: 'sub-h' }, 'Pendientes (' + pend.length + ')'));
    if (!pend.length) cont.appendChild(el('div', { class: 'muted-empty' }, 'Sin pendientes.'));
    else {
      var w2 = el('div', { class: 'tabla-wrap' });
      var t2 = el('table', { class: 'data' });
      t2.appendChild(el('thead', {}, el('tr', {}, [th('Tipo'), th('Descripción'), th('Estado'), th('Responsable'), th('Creado')])));
      var b2 = el('tbody');
      pend.forEach(function (p) { b2.appendChild(el('tr', {}, [td(tipoPendLabel(p.tipo)), td(p.desc || '—'), td(pendPill(p.estado)), td(p.ejecutor || '—'), td(fmtFecha(p.fechaCrea))])); });
      t2.appendChild(b2); w2.appendChild(t2); cont.appendChild(w2);
    }

    // Ciclos del equipo
    var ciclos = (H.ciclosDe ? H.ciclosDe(eq) : []);
    if (ciclos.length) {
      cont.appendChild(el('h4', { class: 'sub-h' }, 'Ciclos correctivos (' + ciclos.length + ')'));
      var w3 = el('div', { class: 'tabla-wrap' });
      var t3 = el('table', { class: 'data' });
      t3.appendChild(el('thead', {}, el('tr', {}, [th('Folio'), th('Apertura'), th('Cierre'), th('Estado'), th('Descripción')])));
      var b3 = el('tbody');
      ciclos.forEach(function (c) { b3.appendChild(el('tr', {}, [td(c.folio || '—'), td(fmtFecha(c.fechaApertura)), td(c.fechaCierre ? fmtFecha(c.fechaCierre) : '—'), td(el('span', { class: 'pill ' + (c.estado === 'abierto' ? 'pill-st' : 'pill-ok') }, c.estado)), td(c.descripcionInicial || '—')])); });
      t3.appendChild(b3); w3.appendChild(t3); cont.appendChild(w3);
    }

    // Notas
    var notas = (H.notasDe ? H.notasDe(eq) : []) || [];
    cont.appendChild(el('h4', { class: 'sub-h' }, 'Notas (' + notas.length + ')'));
    var listaN = el('div', { class: 'timeline' });
    if (!notas.length) listaN.appendChild(el('div', { class: 'muted-empty' }, 'Sin notas.'));
    else notas.slice().reverse().forEach(function (n) {
      listaN.appendChild(el('div', { class: 'tl-item' }, [el('div', { class: 'tl-meta' }, fmtFecha(n.fecha || (n.ts || '').slice(0, 10))), el('div', { class: 'tl-txt' }, n.texto || n.desc || String(n))]));
    });
    cont.appendChild(listaN);
    var addN = el('div', { class: 'inline-add' });
    var inpN = el('input', { type: 'text', placeholder: 'Agregar nota…' });
    var btnN = el('button', { class: 'btn btn-primary' }, 'Agregar');
    function agregarNota() { var v = inpN.value.trim(); if (!v) return; try { H.agregarNotaEquipo(eq, v); H.save(); inpN.value = ''; closeModal(); openEquipoFicha(eq); } catch (e) { toast('No se pudo agregar la nota.', 'err'); } }
    btnN.onclick = agregarNota; inpN.addEventListener('keydown', function (e) { if (e.key === 'Enter') agregarNota(); });
    addN.appendChild(inpN); addN.appendChild(btnN); cont.appendChild(addN);

    openModal('🩺 ' + (eq.inv || '') + ' — ' + (eq.equipo || ''), cont);
  }

  // -------------------------------------------------------------- Pendientes
  function renderPendientes() {
    setTitulo('⚠️ Pendientes', 'Gestión y seguimiento de pendientes');
    configurarExport('Exportar pendientes', exportarPendientes);
    contentEl.innerHTML = '';
    var lista = H.getState().pendientes.filter(function (p) { return !p.anulado; });

    var counts = { no_iniciado: 0, en_proceso: 0, cerrado: 0 };
    lista.forEach(function (p) { counts[p.estado] = (counts[p.estado] || 0) + 1; });
    var stats = el('div', { class: 'stat-grid' });
    function sb(n, l, accent) { return el('div', { class: 'stat' + (accent ? ' accent' : '') }, [el('div', { class: 'n' }, String(n)), el('div', { class: 'l' }, l)]); }
    stats.appendChild(sb(counts.no_iniciado, 'No iniciados'));
    stats.appendChild(sb(counts.en_proceso, 'En proceso'));
    stats.appendChild(sb(counts.cerrado, 'Resueltos', true));
    contentEl.appendChild(stats);

    var card = el('div', { class: 'card' });
    var body = el('div', { class: 'card-body' });
    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Buscar por equipo, descripción, responsable…' });
    var selE = el('select'); [['', 'Todos los estados'], ['no_iniciado', 'No iniciado'], ['en_proceso', 'En proceso'], ['cerrado', 'Resuelto']].forEach(function (o) { selE.appendChild(el('option', { value: o[0] }, o[1])); });
    var selT = el('select'); selT.appendChild(el('option', { value: '' }, 'Todos los tipos'));
    Object.keys(H.TIPO_PENDIENTE).forEach(function (k) { selT.appendChild(el('option', { value: k }, H.TIPO_PENDIENTE[k])); });
    toolbar.appendChild(search); toolbar.appendChild(selE); toolbar.appendChild(selT);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var note = el('span', { class: 'count-note' }); toolbar.appendChild(note);
    body.appendChild(toolbar);
    var cont = el('div'); body.appendChild(cont);

    function pintar() {
      var q = search.value.trim().toLowerCase(), fe = selE.value, ft = selT.value;
      var rows = lista.filter(function (p) {
        if (fe && p.estado !== fe) return false;
        if (ft && p.tipo !== ft) return false;
        if (!q) return true;
        return ((p.inv || '') + ' ' + (p.equipo || '') + ' ' + (p.desc || '') + ' ' + (p.ejecutor || '')).toLowerCase().indexOf(q) >= 0;
      });
      rows.sort(function (a, b) { var ra = a.estado === 'cerrado' ? 1 : 0, rb = b.estado === 'cerrado' ? 1 : 0; return ra - rb || (b.fechaCrea || '').localeCompare(a.fechaCrea || ''); });
      note.textContent = rows.length + ' pendiente(s)';
      cont.innerHTML = '';
      if (!rows.length) { cont.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '✅'), el('div', {}, 'Sin pendientes que coincidan.')])); return; }
      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [th('Equipo'), th('Tipo'), th('Descripción'), th('Estado'), th('Responsable'), th('Creado')])));
      var tb = el('tbody');
      rows.forEach(function (p) {
        var tr = el('tr');
        tr.appendChild(td((p.inv || '') + ' — ' + (p.equipo || '')));
        tr.appendChild(td(tipoPendLabel(p.tipo)));
        var desc = p.desc || ''; tr.appendChild(td(desc.length > 60 ? desc.slice(0, 60) + '…' : (desc || '—')));
        var tdE = el('td'); var sel = el('select', { class: 'mini' });
        [['no_iniciado', 'No iniciado'], ['en_proceso', 'En proceso'], ['cerrado', 'Resuelto']].forEach(function (o) { sel.appendChild(el('option', { value: o[0] }, o[1])); });
        sel.value = p.estado;
        sel.onchange = function () {
          var nuevo = sel.value, ant = p.estado;
          p.estado = nuevo; if (nuevo === 'cerrado' && !p.fechaCierre) p.fechaCierre = H.hoyLocal ? H.hoyLocal() : '';
          try { H.audit && H.audit('pendiente', p.id, 'estado', ant, nuevo); } catch (e) {}
          H.save(); renderSidebar(); renderPendientes();
        };
        tdE.appendChild(sel); tr.appendChild(tdE);
        tr.appendChild(td(p.ejecutor || '—'));
        tr.appendChild(td(fmtFecha(p.fechaCrea)));
        tb.appendChild(tr);
      });
      t.appendChild(tb); wrap.appendChild(t); cont.appendChild(wrap);
    }
    search.addEventListener('input', pintar); selE.addEventListener('change', pintar); selT.addEventListener('change', pintar);
    pintar();
    card.appendChild(body); contentEl.appendChild(card);
  }

  // ----------------------------------------------------------------- Eventos
  function renderEventos() {
    setTitulo('🗂️ Eventos', 'Todos los eventos registrados');
    configurarExport('Exportar eventos', exportarEventos);
    contentEl.innerHTML = '';
    var lista = eventosVigentes();
    var card = el('div', { class: 'card' });
    var body = el('div', { class: 'card-body' });
    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Buscar por folio, equipo, tipo, ejecutor…' });
    var selT = el('select'); selT.appendChild(el('option', { value: '' }, 'Todos los tipos'));
    (H.TIPOS_EVENTO || []).forEach(function (t) { selT.appendChild(el('option', { value: t.label }, t.label)); });
    toolbar.appendChild(search); toolbar.appendChild(selT);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var note = el('span', { class: 'count-note' }); toolbar.appendChild(note);
    body.appendChild(toolbar);
    var cont = el('div'); body.appendChild(cont);

    function pintar() {
      var q = search.value.trim().toLowerCase(), ft = selT.value;
      var rows = lista.filter(function (e) {
        if (ft && e.tipo !== ft) return false;
        if (!q) return true;
        return ((e.folio || '') + ' ' + (e.inv || '') + ' ' + (e.equipo || '') + ' ' + (e.tipo || '') + ' ' + (e.ejecutor || '') + ' ' + (e.servicio || '')).toLowerCase().indexOf(q) >= 0;
      });
      rows.sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
      note.textContent = rows.length + ' evento(s)';
      cont.innerHTML = '';
      if (!rows.length) { cont.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🔎'), el('div', {}, 'Sin resultados.')])); return; }
      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [th('Fecha'), th('Tipo'), th('Folio'), th('N° Inventario'), th('Equipo'), th('Servicio'), th('Ejecutor'), th('Estado')])));
      var tb = el('tbody'); var frag = document.createDocumentFragment();
      rows.slice(0, 600).forEach(function (e) {
        var tr = el('tr');
        tr.appendChild(td(fmtFecha(e.fecha))); tr.appendChild(td(el('span', { class: 'tag-etapa' }, e.tipo || '—'))); tr.appendChild(td(e.folio || '—'));
        tr.appendChild(td(e.inv || '—')); tr.appendChild(td(e.equipo || '—')); tr.appendChild(td(e.servicio || '—'));
        tr.appendChild(td(e.ejecutor || '—')); tr.appendChild(td(e.estado || '—'));
        frag.appendChild(tr);
      });
      tb.appendChild(frag); t.appendChild(tb); wrap.appendChild(t); cont.appendChild(wrap);
    }
    search.addEventListener('input', pintar); selT.addEventListener('change', pintar);
    pintar();
    card.appendChild(body); contentEl.appendChild(card);
  }

  // ------------------------------------------------------------------ Ciclos
  function renderCiclos() {
    setTitulo('🔁 Ciclos correctivos', 'Ciclos de trabajo abiertos y cerrados');
    configurarExport('Exportar ciclos', exportarCiclos);
    contentEl.innerHTML = '';
    var ciclos = (H.getState().ciclos || []).slice();
    var card = el('div', { class: 'card' });
    var body = el('div', { class: 'card-body' });
    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Buscar por folio, inventario, ingeniero…' });
    var selE = el('select'); [['', 'Todos'], ['abierto', 'Abiertos'], ['cerrado', 'Cerrados']].forEach(function (o) { selE.appendChild(el('option', { value: o[0] }, o[1])); });
    toolbar.appendChild(search); toolbar.appendChild(selE);
    toolbar.appendChild(el('div', { class: 'spacer' }));
    var note = el('span', { class: 'count-note' }); toolbar.appendChild(note);
    body.appendChild(toolbar);
    var cont = el('div'); body.appendChild(cont);
    function pintar() {
      var q = search.value.trim().toLowerCase(), fe = selE.value;
      var rows = ciclos.filter(function (c) {
        if (fe && c.estado !== fe) return false;
        if (!q) return true;
        return ((c.folio || '') + ' ' + (c.inv || '') + ' ' + (c.ingenieroAsignado || '') + ' ' + (c.descripcionInicial || '')).toLowerCase().indexOf(q) >= 0;
      });
      rows.sort(function (a, b) { return (b.fechaApertura || '').localeCompare(a.fechaApertura || ''); });
      note.textContent = rows.length + ' ciclo(s)';
      cont.innerHTML = '';
      if (!rows.length) { cont.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'big' }, '🔁'), el('div', {}, 'Sin ciclos.')])); return; }
      var wrap = el('div', { class: 'tabla-wrap' });
      var t = el('table', { class: 'data' });
      t.appendChild(el('thead', {}, el('tr', {}, [th('Folio'), th('N° Inventario'), th('Apertura'), th('Cierre'), th('Estado'), th('Ingeniero'), th('Descripción')])));
      var tb = el('tbody');
      rows.forEach(function (c) {
        tb.appendChild(el('tr', {}, [td(c.folio || '—'), td(c.inv || '—'), td(fmtFecha(c.fechaApertura)), td(c.fechaCierre ? fmtFecha(c.fechaCierre) : '—'),
          td(el('span', { class: 'pill ' + (c.estado === 'abierto' ? 'pill-st' : 'pill-ok') }, c.estado)), td(c.ingenieroAsignado || '—'), td(c.descripcionInicial || '—')]));
      });
      t.appendChild(tb); wrap.appendChild(t); cont.appendChild(wrap);
    }
    search.addEventListener('input', pintar); selE.addEventListener('change', pintar);
    pintar();
    card.appendChild(body); contentEl.appendChild(card);
  }

  // ---------------------------------------------------------------- Modal
  var _modalPrevFocus = null;
  function openModal(titulo, bodyNode) {
    closeModal();
    _modalPrevFocus = document.activeElement;
    var titleId = 'modal-title';
    var bd = el('div', { class: 'modal-backdrop', id: 'modal-bd' });
    var m = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId });
    var btnX = el('button', { class: 'close', title: 'Cerrar', 'aria-label': 'Cerrar' }, '✕'); btnX.onclick = closeModal;
    m.appendChild(el('div', { class: 'modal-head' }, [el('h3', { id: titleId }, titulo), btnX]));
    m.appendChild(el('div', { class: 'modal-body' }, [bodyNode]));
    bd.appendChild(m);
    bd.addEventListener('click', function (ev) { if (ev.target === bd) closeModal(); });
    document.body.appendChild(bd);
    document.addEventListener('keydown', escClose);
    var first = m.querySelector('input,select,textarea,button,[tabindex]') || btnX; if (first && first.focus) first.focus();
  }
  function escClose(ev) { if (ev.key === 'Escape') closeModal(); }
  function closeModal() {
    var x = document.getElementById('modal-bd'); if (x && x.parentNode) x.parentNode.removeChild(x);
    document.removeEventListener('keydown', escClose);
    var pf = _modalPrevFocus; _modalPrevFocus = null; if (pf && pf.focus) { try { pf.focus(); } catch (e) {} }
  }

  // -------------------------------------------------------- Export (SheetJS)
  var vistaExport = null;
  function exportarVistaActual() { (typeof vistaExport === 'function' ? vistaExport : exportarInventarioTodo)(); }
  function configurarExport(label, fn) {
    vistaExport = (typeof fn === 'function') ? fn : exportarInventarioTodo;
    var b = document.getElementById('btnExport'); if (b) { b.textContent = '⬇️ ' + label; b.setAttribute('title', 'Exportar a Excel — ' + label.toLowerCase()); }
  }
  function hoyISO() { var d = new Date(), z = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  // Usa nuestro escritor .xlsx propio (xlsx.js → XLSXWriter), robusto y sin
  // depender de que el build de SheetJS traiga soporte de escritura.
  function exportarAOA(base, aoa) {
    if (!window.XLSXWriter) { toast('No se pudo cargar el exportador de Excel.', 'err'); return; }
    var headers = aoa[0] || [];
    var columnas = headers.map(function (h) { return { titulo: h, ancho: 16 }; });
    var filas = aoa.slice(1);
    var nombre = (String(base).replace(/[^\wáéíóúñ ]/gi, '').trim().replace(/\s+/g, '_') || 'Export') + '_' + hoyISO() + '.xlsx';
    try { window.XLSXWriter.descargar(nombre, [{ nombre: String(base).slice(0, 31), columnas: columnas, filas: filas }]); }
    catch (e) { toast('Error al exportar: ' + (e && e.message ? e.message : e), 'err'); }
  }
  function exportarInventarioTodo() {
    var aoa = [['ID', 'N° Carpeta', 'N° Inventario', 'Familia', 'Equipo', 'Servicio', 'Unidad', 'Ubicación', 'Marca', 'Modelo', 'Serie', 'Año', 'Clasificación', 'Encargado', 'Estado']];
    H.getState().equipos.forEach(function (e) { aoa.push([e.id, e.carpeta, e.inv, e.fam, e.equipo, e.servicio, e.unidad, e.ubic, e.marca, e.modelo, e.serie, e.ano, e.clasif, encargado(e), H.ESTADO_LABEL[e.estado] || e.estado]); });
    exportarAOA('Inventario', aoa); toast('Inventario exportado.', 'ok');
  }
  function exportarPendientes() {
    var aoa = [['N° Inventario', 'Equipo', 'Servicio', 'Tipo', 'Descripción', 'Estado', 'Responsable', 'Creado', 'Compromiso']];
    H.getState().pendientes.filter(function (p) { return !p.anulado; }).forEach(function (p) { aoa.push([p.inv, p.equipo, p.servicio, tipoPendLabel(p.tipo), p.desc, H.ESTADO_PEND_LABEL[p.estado] || p.estado, p.ejecutor, fmtFecha(p.fechaCrea), fmtFecha(p.fechaComp)]); });
    exportarAOA('Pendientes', aoa); toast('Pendientes exportados.', 'ok');
  }
  function exportarEventos() {
    var aoa = [['Fecha', 'Tipo', 'Folio', 'N° Inventario', 'Equipo', 'Servicio', 'Ejecutor', 'Estado', 'Observaciones']];
    eventosVigentes().forEach(function (e) { aoa.push([fmtFecha(e.fecha), e.tipo, e.folio, e.inv, e.equipo, e.servicio, e.ejecutor, e.estado, e.obs]); });
    exportarAOA('Eventos', aoa); toast('Eventos exportados.', 'ok');
  }
  function exportarCiclos() {
    var aoa = [['Folio', 'N° Inventario', 'Apertura', 'Cierre', 'Estado', 'Ingeniero', 'Descripción']];
    (H.getState().ciclos || []).forEach(function (c) { aoa.push([c.folio, c.inv, fmtFecha(c.fechaApertura), c.fechaCierre ? fmtFecha(c.fechaCierre) : '', c.estado, c.ingenieroAsignado, c.descripcionInicial]); });
    exportarAOA('Ciclos', aoa); toast('Ciclos exportados.', 'ok');
  }

  // -------------------------------------------------------------------- Init
  function init() {
    contentEl = document.getElementById('content');
    viewTitleEl = document.getElementById('viewTitle');
    viewSubEl = document.getElementById('viewSub');

    // Cablear el núcleo a nuestra UI.
    H.configure({
      ui: {
        notify: function (m, t) { toast(m, t); },
        confirm: function (m) { return window.confirm(m); },
        prompt: function (m, d) { return window.prompt(m, d); },
        onChange: function () { /* re-render diferido si el núcleo cambia algo */ }
      },
      env: { xlsx: window.XLSX || null }
    });
    H.setSeed(window.SEED || {});
    H.bootstrapDatos();

    document.getElementById('btnExport').onclick = exportarVistaActual;
    var mt = document.getElementById('menuToggle'), sb = document.getElementById('sidebar'), bd = document.getElementById('backdrop');
    mt.onclick = function () { var ab = sb.classList.toggle('open'); bd.classList.toggle('show'); mt.setAttribute('aria-expanded', ab ? 'true' : 'false'); };
    bd.onclick = function () { sb.classList.remove('open'); bd.classList.remove('show'); mt.setAttribute('aria-expanded', 'false'); };

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
