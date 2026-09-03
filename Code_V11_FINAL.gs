/**
 * REGISTRO SERVICIOS INSPECCION DE CARGA - Backend FINAL
 * Integra diseño V08 + Google Sheets + Google Drive.
 * Script ID: 1OVaMHuc2ZoG9qaQQ8MDUJK0yJ9tfdgoBOW1Aa8qfCQRbVwqCrvPfro57
 * Renombrado desde "APP INSPECCIONES CARGA" el 02-09-2026.
 */

const SPREADSHEET_ID = '1ZWdHVeDb5yr4sc8j5EMpN27BxyZ10ph1c0Z_raZq1aE';
const SHEETS = {
  INSPECCIONES: 'INSPECCIONES',
  AVERIAS: 'AVERIAS',
  RECUENTO: 'RECUENTO',
  ARCHIVOS: 'ARCHIVOS'
};
const DRIVE_FOLDER_NAME = 'APP INSPECCIONES CARGA - ARCHIVOS'; // NOTA: no renombrado aquí a propósito, ver advertencia abajo
const PROP_REPAIR = 'V11_LEGACY_LAYOUT_REPAIRED';

const HEADERS = {
  INSPECCIONES: ['ID','ESTADO','MES','DIA','ID_EQUIPO','EMPRESA','SEDAN','CROSS','FECHA_INSPECCION','OBSERVACION','FECHA_REGISTRO','FECHA_ACTUALIZACION','FOTOS','FIRMA'],
  AVERIAS: ['ID_AVERIA','ID_INSPECCION','TRANSPORTE','ID_EQUIPO','FECHA','VIN','MODELO','UBICACION','NUMERO','AREA','SUBAREA','DANOS','GRADO','CUADRANTE','MEDIDA','ORIGEN','CARGO','OBSERVACIONES','FECHA_REGISTRO'],
  ARCHIVOS: ['ID_ARCHIVO','ID_INSPECCION','TIPO','NOMBRE','URL','FECHA'],
  RECUENTO: ['MES','FURLONG','AUTOPORT','SEDAN','CROSS','VIAJES','UNIDADES']
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('REGISTRO SERVICIOS INSPECCION DE CARGA')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const current = sh.getLastColumn() > 0 && sh.getLastRow() > 0
    ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getValues()[0]
    : [];
  const same = headers.every((h, i) => String(current[i] || '').trim() === h) && current.length >= headers.length;
  if (!same) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function getDriveFolder_() {
  const it = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function setupBase() {
  const ss = ss_();
  ensureSheet_(ss, SHEETS.INSPECCIONES, HEADERS.INSPECCIONES);
  ensureSheet_(ss, SHEETS.AVERIAS, HEADERS.AVERIAS);
  ensureSheet_(ss, SHEETS.ARCHIVOS, HEADERS.ARCHIVOS);
  ensureSheet_(ss, SHEETS.RECUENTO, HEADERS.RECUENTO);
  getDriveFolder_();
  repairLegacyLayout_();
  rebuildRecuento_();
  return 'OK';
}

/**
 * Corrige únicamente filas heredadas de las pruebas de montaje donde el ESTADO
 * quedó accidentalmente en FECHA_INSPECCION y la fecha quedó en OBSERVACION.
 * Antes de corregir, crea respaldo. No toca filas que no cumplan el patrón.
 */
function repairLegacyLayout_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(PROP_REPAIR) === '1') return;

  const ss = ss_();
  const sh = ss.getSheetByName(SHEETS.INSPECCIONES);
  if (!sh || sh.getLastRow() < 2) {
    props.setProperty(PROP_REPAIR, '1');
    return;
  }

  const last = sh.getLastRow();
  const vals = sh.getRange(2, 1, last - 1, 14).getValues();
  const statusSet = new Set(['GRABADO','BORRADOR','APROBADO','OBSERVADO','RECHAZADO']);
  let changed = 0;

  const isDateLike = v => {
    if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return true;
    if (typeof v === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v.trim())) return true;
    return false;
  };
  const toDate = v => {
    if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return v;
    if (typeof v === 'string') {
      const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }
    return null;
  };

  const original = vals.map(row => row.slice());
  const out = vals.map(row => {
    const i = String(row[8] || '').trim().toUpperCase(); // FECHA_INSPECCION
    const j = row[9];                                  // OBSERVACION
    if (statusSet.has(i) && isDateLike(j)) {
      const d = toDate(j);
      row[8] = d || j;      // fecha -> FECHA_INSPECCION
      row[9] = '';          // observación queda vacía
      if (!row[2] && d) row[2] = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'][d.getMonth()];
      if (!row[3] && d) row[3] = d.getDate();
      changed++;
    }
    return row;
  });

  if (changed > 0) {
    const backupName = 'RESPALDO_INSPECCIONES_V11_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Santiago', 'yyyyMMdd_HHmmss');
    const backup = ss.insertSheet(backupName);
    backup.getRange(1,1,1,14).setValues([HEADERS.INSPECCIONES]);
    backup.getRange(2,1,original.length,14).setValues(original);
    sh.getRange(2,1,out.length,14).setValues(out);
  }
  props.setProperty(PROP_REPAIR, '1');
}

function getAppData() {
  setupBase();
  const ss = ss_();
  return {
    inspecciones: readInspecciones_(ss),
    averias: readAverias_(ss),
    recuento: readRecuento_(ss)
  };
}

function readInspecciones_(ss) {
  const sh = ss.getSheetByName(SHEETS.INSPECCIONES);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2,1,last-1,14).getValues().map(r => ({
    id: String(r[0] || ''),
    estado: String(r[1] || ''),
    mes: String(r[2] || ''),
    dia: Number(r[3] || 0),
    idEquipo: String(r[4] || ''),
    empresa: String(r[5] || ''),
    sedan: Number(r[6] || 0),
    cross: Number(r[7] || 0),
    fecha: toIsoDate_(r[8]),
    observacion: String(r[9] || ''),
    fechaRegistro: toIsoDateTime_(r[10]),
    fechaActualizacion: toIsoDateTime_(r[11]),
    fotos: readFiles_(ss, r[0], 'FOTO'),
    firma: readFirma_(ss, r[0])
  }));
}

function readAverias_(ss) {
  const sh = ss.getSheetByName(SHEETS.AVERIAS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2,1,last-1,19).getValues().map(r => ({
    id: String(r[0] || ''), parentInspectionId: String(r[1] || ''), transporte: String(r[2] || ''),
    idEquipo: String(r[3] || ''), fecha: toIsoDate_(r[4]), vin: String(r[5] || ''), modelo: String(r[6] || ''),
    ubicacion: String(r[7] || ''), numero: String(r[8] || ''), area: String(r[9] || ''), subarea: String(r[10] || ''),
    danos: String(r[11] || ''), grado: String(r[12] || ''), cuadrante: String(r[13] || ''), medida: String(r[14] || ''),
    origen: String(r[15] || ''), cargo: String(r[16] || ''), observaciones: String(r[17] || ''), fechaRegistro: toIsoDateTime_(r[18])
  }));
}

function readRecuento_(ss) {
  const sh = ss.getSheetByName(SHEETS.RECUENTO);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2,1,last-1,7).getValues().map(r => ({
    mes: String(r[0] || ''), furlog: Number(r[1] || 0), autoport: Number(r[2] || 0),
    sedan: Number(r[3] || 0), cross: Number(r[4] || 0), viajes: Number(r[5] || 0), unidades: Number(r[6] || 0)
  }));
}

function readFiles_(ss, id, tipo) {
  const sh = ss.getSheetByName(SHEETS.ARCHIVOS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2,1,last-1,6).getValues()
    .filter(r => String(r[1]) === String(id) && String(r[2]) === tipo)
    .map(r => String(r[4] || '')).filter(Boolean);
}

function readFirma_(ss, id) {
  const a = readFiles_(ss, id, 'FIRMA');
  return a[0] || '';
}

function toIsoDate_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'America/Santiago', 'yyyy-MM-dd');
  }
  return String(v).slice(0,10);
}

function toIsoDateTime_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return v.toISOString();
  }
  return String(v);
}

function saveInspection(r) {
  if (!r || !r.id) throw new Error('La inspección no tiene ID.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupBase();
    const ss = ss_();
    const folder = getDriveFolder_();
    const now = new Date();
    const shI = ss.getSheetByName(SHEETS.INSPECCIONES);
    const shA = ss.getSheetByName(SHEETS.AVERIAS);
    const shF = ss.getSheetByName(SHEETS.ARCHIVOS);

    const oldFiles = shF.getLastRow() < 2 ? [] : shF.getRange(2,1,shF.getLastRow()-1,6).getValues().filter(x => String(x[1]) === String(r.id));
    const photoUrls = [];

    (Array.isArray(r.fotos) ? r.fotos : []).forEach((data, i) => {
      if (!data) return;
      if (String(data).indexOf('data:') === 0) {
        const name = 'FOTO_' + r.id + '_' + (i + 1) + '.jpg';
        const old = oldFiles.find(x => String(x[2]) === 'FOTO' && String(x[3]) === name);
        const url = old ? String(old[4]) : saveDataUrl_(folder, data, name);
        photoUrls.push(url);
        if (!old) shF.appendRow([Utilities.getUuid(), r.id, 'FOTO', name, url, now]);
      } else if (/^https?:/i.test(String(data))) {
        photoUrls.push(String(data));
      }
    });

    let firmaUrl = '';
    if (r.firma) {
      if (String(r.firma).indexOf('data:') === 0 && String(r.firma).length > 100) {
        const name = 'FIRMA_' + r.id + '.png';
        const old = oldFiles.find(x => String(x[2]) === 'FIRMA' && String(x[3]) === name);
        firmaUrl = old ? String(old[4]) : saveDataUrl_(folder, r.firma, name);
        if (!old) shF.appendRow([Utilities.getUuid(), r.id, 'FIRMA', name, firmaUrl, now]);
      } else if (/^https?:/i.test(String(r.firma))) {
        firmaUrl = String(r.firma);
      }
    }

    const row = [
      r.id, r.estado || 'GRABADO', r.mes || '', r.dia || '', r.idEquipo || '', r.empresa || '',
      Number(r.sedan || 0), Number(r.cross || 0), r.fecha || '', r.observacion || '',
      r.fechaRegistro || now.toISOString(), r.fechaActualizacion || now.toISOString(),
      photoUrls.join('\n'), firmaUrl
    ];

    upsertRowById_(shI, row);
    deleteRowsByColumn_(shA, 2, r.id);
    (Array.isArray(r.averias) ? r.averias : []).forEach(x => {
      shA.appendRow([
        x.id || Utilities.getUuid(), r.id, x.transporte || '', x.idEquipo || '', x.fecha || '', x.vin || '',
        x.modelo || '', x.ubicacion || '', x.numero || '', x.area || '', x.subarea || '', x.danos || '',
        x.grado || '', x.cuadrante || '', x.medida || '', x.origen || '', x.cargo || '', x.observaciones || '',
        x.fechaRegistro || now.toISOString()
      ]);
    });

    rebuildRecuento_();
    SpreadsheetApp.flush();
    return {ok:true, id:r.id, averias:Array.isArray(r.averias) ? r.averias.length : 0, fotos:photoUrls.length, firma:!!firmaUrl};
  } finally {
    lock.releaseLock();
  }
}

function upsertRowById_(sh, row) {
  const last = sh.getLastRow();
  if (last < 2) {
    sh.appendRow(row);
    return;
  }
  const vals = sh.getRange(2,1,last-1,1).getValues();
  for (let i=0; i<vals.length; i++) {
    if (String(vals[i][0]) === String(row[0])) {
      sh.getRange(i+2,1,1,row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

function deleteRowsByColumn_(sh, col, value) {
  for (let r=sh.getLastRow(); r>=2; r--) {
    if (String(sh.getRange(r,col).getValue()) === String(value)) sh.deleteRow(r);
  }
}

function saveDataUrl_(folder, dataUrl, name) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error('Archivo base64 inválido: ' + name);
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
  return folder.createFile(blob).getUrl();
}

function rebuildRecuento_() {
  const ss = ss_();
  const shI = ss.getSheetByName(SHEETS.INSPECCIONES);
  const shR = ss.getSheetByName(SHEETS.RECUENTO);
  if (!shI || !shR) return;
  const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const map = {};
  months.forEach(m => map[m] = {f:0,a:0,s:0,c:0});
  const last = shI.getLastRow();
  if (last >= 2) {
    shI.getRange(2,1,last-1,14).getValues().forEach(x => {
      if (String(x[1]).toUpperCase() === 'BORRADOR') return;
      const m = String(x[2]).toUpperCase();
      if (!map[m]) return;
      if (String(x[5]).toUpperCase() === 'FURLONG') map[m].f++;
      if (String(x[5]).toUpperCase() === 'AUTOPORT') map[m].a++;
      map[m].s += Number(x[6] || 0);
      map[m].c += Number(x[7] || 0);
    });
  }
  if (shR.getLastRow() > 1) shR.getRange(2,1,shR.getLastRow()-1,7).clearContent();
  const rows = months.map(m => {
    const x = map[m], viajes = x.f + x.a, unidades = x.s + x.c;
    return [m, x.f, x.a, x.s, x.c, viajes, unidades];
  });
  shR.getRange(2,1,rows.length,7).setValues(rows);
}

function testConnection() {
  setupBase();
  return getAppData();
}
