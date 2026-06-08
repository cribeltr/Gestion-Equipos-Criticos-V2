/*
 * xlsx.js — Generador mínimo de archivos .xlsx (Office Open XML) en el navegador.
 * Sin dependencias externas: implementa CRC32 + ZIP (método "store") y el XML del libro.
 * Genera archivos .xlsx reales que abren en Excel / LibreOffice / Google Sheets.
 *
 * API:
 *   XLSXWriter.descargar(nombreArchivo, hojas)
 *   hojas = [{ nombre, columnas: [{titulo, ancho}], filas: [[celda, ...], ...] }]
 *   Cada celda puede ser string o number. Las cadenas se escriben como texto.
 */
(function (global) {
  'use strict';

  // ---------- CRC32 ----------
  var crcTable = (function () {
    var c, table = [];
    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // ---------- Utilidades de bytes ----------
  function strToBytes(str) {
    // UTF-8
    var utf8 = unescape(encodeURIComponent(str));
    var bytes = new Uint8Array(utf8.length);
    for (var i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i) & 0xFF;
    return bytes;
  }

  function concatBytes(arrays) {
    var total = 0, i;
    for (i = 0; i < arrays.length; i++) total += arrays[i].length;
    var out = new Uint8Array(total);
    var off = 0;
    for (i = 0; i < arrays.length; i++) { out.set(arrays[i], off); off += arrays[i].length; }
    return out;
  }

  function u16(n) { return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]); }
  function u32(n) { return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]); }

  // ---------- ZIP (store / sin compresión) ----------
  function buildZip(files) {
    // files = [{ name, bytes }]
    var localParts = [];
    var central = [];
    var offset = 0;

    files.forEach(function (f) {
      var nameBytes = strToBytes(f.name);
      var crc = crc32(f.bytes);
      var size = f.bytes.length;

      // Local file header
      var local = concatBytes([
        u32(0x04034b50),    // signature
        u16(20),            // version needed
        u16(0),             // flags
        u16(0),             // compression = store
        u16(0),             // mod time
        u16(0),             // mod date
        u32(crc),           // crc32
        u32(size),          // compressed size
        u32(size),          // uncompressed size
        u16(nameBytes.length),
        u16(0),             // extra length
        nameBytes,
        f.bytes
      ]);
      localParts.push(local);

      // Central directory record
      var cd = concatBytes([
        u32(0x02014b50),    // signature
        u16(20),            // version made by
        u16(20),            // version needed
        u16(0),             // flags
        u16(0),             // compression
        u16(0),             // mod time
        u16(0),             // mod date
        u32(crc),
        u32(size),
        u32(size),
        u16(nameBytes.length),
        u16(0),             // extra
        u16(0),             // comment
        u16(0),             // disk number
        u16(0),             // internal attrs
        u32(0),             // external attrs
        u32(offset),        // local header offset
        nameBytes
      ]);
      central.push(cd);

      offset += local.length;
    });

    var centralBytes = concatBytes(central);
    var localBytes = concatBytes(localParts);

    var eocd = concatBytes([
      u32(0x06054b50),
      u16(0),                       // disk
      u16(0),                       // disk with CD
      u16(files.length),            // entries on disk
      u16(files.length),            // total entries
      u32(centralBytes.length),     // central dir size
      u32(localBytes.length),       // central dir offset
      u16(0)                        // comment length
    ]);

    return concatBytes([localBytes, centralBytes, eocd]);
  }

  // ---------- XML helpers ----------
  function xmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function colLetter(n) { // 1 -> A
    var s = '';
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function isNumeric(v) {
    return typeof v === 'number' && isFinite(v);
  }

  // ---------- Construcción del libro ----------
  function buildWorkbook(hojas) {
    // Saneamos nombres de hoja (Excel: <=31 chars, sin : \ / ? * [ ])
    var usados = {};
    hojas.forEach(function (h, idx) {
      var nombre = (h.nombre || ('Hoja' + (idx + 1))).replace(/[:\\\/?*\[\]]/g, ' ').slice(0, 31).trim() || ('Hoja' + (idx + 1));
      var base = nombre, n = 2;
      while (usados[nombre.toLowerCase()]) { nombre = (base.slice(0, 28) + ' ' + n).slice(0, 31); n++; }
      usados[nombre.toLowerCase()] = true;
      h._nombre = nombre;
    });

    var files = [];

    // [Content_Types].xml
    var overrides = hojas.map(function (h, i) {
      return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }).join('');
    var contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      overrides +
      '</Types>';
    files.push({ name: '[Content_Types].xml', bytes: strToBytes(contentTypes) });

    // _rels/.rels
    var rels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';
    files.push({ name: '_rels/.rels', bytes: strToBytes(rels) });

    // xl/workbook.xml
    var sheetsXml = hojas.map(function (h, i) {
      return '<sheet name="' + xmlEsc(h._nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    }).join('');
    var workbook =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + sheetsXml + '</sheets></workbook>';
    files.push({ name: 'xl/workbook.xml', bytes: strToBytes(workbook) });

    // xl/_rels/workbook.xml.rels
    var wbRels = hojas.map(function (h, i) {
      return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    }).join('');
    var stylesRelId = hojas.length + 1;
    wbRels += '<Relationship Id="rId' + stylesRelId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    var workbookRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      wbRels + '</Relationships>';
    files.push({ name: 'xl/_rels/workbook.xml.rels', bytes: strToBytes(workbookRels) });

    // xl/styles.xml — estilo 0 normal, estilo 1 encabezado (negrita + relleno + centrado + borde)
    var styles =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
        '<font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF2C6E91"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2">' +
        '<border><left/><right/><top/><bottom/><diagonal/></border>' +
        '<border><left style="thin"><color rgb="FFBBBBBB"/></left><right style="thin"><color rgb="FFBBBBBB"/></right><top style="thin"><color rgb="FFBBBBBB"/></top><bottom style="thin"><color rgb="FFBBBBBB"/></bottom><diagonal/></border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
    files.push({ name: 'xl/styles.xml', bytes: strToBytes(styles) });

    // Hojas
    hojas.forEach(function (h, i) {
      var columnas = h.columnas || [];
      var filas = h.filas || [];
      var nCols = columnas.length || (filas[0] ? filas[0].length : 1);

      // <cols> con anchos
      var colsXml = '';
      if (columnas.length) {
        colsXml = '<cols>' + columnas.map(function (c, ci) {
          var w = c.ancho || 16;
          return '<col min="' + (ci + 1) + '" max="' + (ci + 1) + '" width="' + w + '" customWidth="1"/>';
        }).join('') + '</cols>';
      }

      // Fila de encabezado
      var rowsXml = '';
      var headerCells = columnas.map(function (c, ci) {
        return '<c r="' + colLetter(ci + 1) + '1" t="inlineStr" s="1"><is><t xml:space="preserve">' + xmlEsc(c.titulo) + '</t></is></c>';
      }).join('');
      rowsXml += '<row r="1">' + headerCells + '</row>';

      // Filas de datos
      filas.forEach(function (fila, ri) {
        var rIdx = ri + 2;
        var cells = '';
        for (var ci = 0; ci < nCols; ci++) {
          var v = fila[ci];
          var ref = colLetter(ci + 1) + rIdx;
          if (isNumeric(v)) {
            cells += '<c r="' + ref + '"><v>' + v + '</v></c>';
          } else {
            var txt = (v == null) ? '' : String(v);
            cells += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(txt) + '</t></is></c>';
          }
        }
        rowsXml += '<row r="' + rIdx + '">' + cells + '</row>';
      });

      var lastCol = colLetter(nCols);
      var lastRow = filas.length + 1;
      var dimension = 'A1:' + lastCol + lastRow;
      var autofilter = '<autoFilter ref="A1:' + lastCol + '1"/>';
      var sheetViews =
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
        '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>';

      var sheetXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<dimension ref="' + dimension + '"/>' +
        sheetViews +
        colsXml +
        '<sheetData>' + rowsXml + '</sheetData>' +
        autofilter +
        '</worksheet>';
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', bytes: strToBytes(sheetXml) });
    });

    return buildZip(files);
  }

  function descargar(nombreArchivo, hojas) {
    var bytes = buildWorkbook(hojas);
    var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = /\.xlsx$/i.test(nombreArchivo) ? nombreArchivo : (nombreArchivo + '.xlsx');
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  global.XLSXWriter = { descargar: descargar, _buildWorkbook: buildWorkbook };
})(window);
