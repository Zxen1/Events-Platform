const { read, write } = require('../src/db');
const fs = require('fs');
const path = require('path');

function seed() {
  const db = read();
  if (db.themes.length === 0) {
    db.themes.push(
      { id: 1, name: 'light', data: JSON.stringify({ background: '#fff', color: '#000' }) },
      { id: 2, name: 'dark', data: JSON.stringify({ background: '#000', color: '#fff' }) }
    );

    // Add Beige Transparency theme using color data from provided file
    try {
      const raw = fs.readFileSync(
        path.join(__dirname, '..', 'beige transparency theme.txt'),
        'utf8'
      );
      const parsed = JSON.parse(raw)[0];
      const primary = parsed?.data?.['body-bg']?.color || '#a3956c';
      db.themes.push({
        id: 3,
        name: 'Beige Transparency',
        data: JSON.stringify({ primary })
      });
    } catch (e) {
      // If the file is missing or invalid, continue without seeding the theme
    }
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
