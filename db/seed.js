const { read, write } = require('../src/db');

function seed() {
  const db = read();
  if (db.themes.length === 0) {
    db.themes.push(
      { id: 1, name: 'light', data: JSON.stringify({ background: '#fff', color: '#000' }) },
      { id: 2, name: 'dark', data: JSON.stringify({ background: '#000', color: '#fff' }) }
    );
  }
  if (db.users.length === 0) {
    db.users.push({ id: 1, name: 'Alice' });
  }
  write(db);
}

if (require.main === module) {
  seed();
  console.log('Database seeded');
}

module.exports = seed;
