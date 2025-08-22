const { read, write } = require('./index');

function saveTab(tab, data) {
  const db = read();
  const tableName = `admin_${tab}`;
  const backupTable = `${tableName}_backups`;
  db[tableName] = db[tableName] || [];
  db[backupTable] = db[backupTable] || [];
  const id = (db[tableName][db[tableName].length - 1]?.id || 0) + 1;
  const record = { id, ...data, saved_at: new Date().toISOString() };
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
