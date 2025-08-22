const { read, write } = require('./index');

function normalizeTheme(data) {
  const toHex = (val) => {
    if (typeof val !== 'string') return val;
    const m = val.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return val;
    let hex = val.toUpperCase();
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return hex;
  };
  const out = {};
  Object.entries(data).forEach(([k, v]) => {
    out[k] = toHex(v);
  });
  return out;
}

function saveTab(tab, data) {
  const db = read();
  const tableName = `admin_${tab}`;
  const backupTable = `${tableName}_backups`;
  db[tableName] = db[tableName] || [];
  db[backupTable] = db[backupTable] || [];
  const id = (db[tableName][db[tableName].length - 1]?.id || 0) + 1;
  const cleaned = tab === 'theme' ? normalizeTheme(data) : data;
  const record = { id, ...cleaned, saved_at: new Date().toISOString() };
  db[tableName].push(record);
  db[backupTable].push(record);
  write(db);
  return record;
}

function listBackups(tab) {
  const db = read();
  return db[`admin_${tab}_backups`] || [];
}

function restoreBackup(tab, id) {
  const db = read();
  const backupTable = `admin_${tab}_backups`;
  const tableName = `admin_${tab}`;
  const backup = (db[backupTable] || []).find(b => b.id === id);
  if (!backup) return null;
  db[tableName] = db[tableName] || [];
  const newId = (db[tableName][db[tableName].length - 1]?.id || 0) + 1;
  const record = { ...backup, id: newId, restored_at: new Date().toISOString() };
  db[tableName].push(record);
  write(db);
  return record;
}

module.exports = { saveTab, listBackups, restoreBackup };
