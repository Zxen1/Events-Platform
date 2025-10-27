const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const mainSource = fs.readFileSync('index.js', 'utf8');

assert(
  mainSource.includes("types: 'poi,place,address'"),
  'Global geocoder must request supported Mapbox types.'
);

assert(
  mainSource.includes("normalizeMapboxVenueTypes(options.types, 'poi');"),
  'Mapbox venue search must normalize unsupported types to poi.'
);

assert(
  mainSource.includes("const resolvedTypes = types || 'poi';"),
  'Mapbox venue search must fall back to poi when no types are provided.'
);

assert(
  !mainSource.includes("'poi,venue'"),
  'Mapbox integrations must not request deprecated venue types.'
);

assert(
  mainSource.includes("const MAPBOX_SUPPORTED_VENUE_TYPES = ['poi','place','address'];"),
  'Supported Mapbox venue types must be declared.'
);

const start = mainSource.indexOf('const LOCAL_GEOCODER_MAX_RESULTS = 10;');
const end = mainSource.indexOf('rebuildVenueIndex();');
assert(start !== -1 && end !== -1 && end > start, 'Unable to locate local venue search source in index.js');

const code = mainSource.slice(start, end);
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(code, context);

const requiredFns = ['addVenueToLocalIndex', 'searchLocalVenues', 'normalizeMapboxVenueTypes'];
for (const fn of requiredFns) {
  assert.strictEqual(typeof context[fn], 'function', `Expected ${fn} to be defined.`);
}

assert.strictEqual(
  context.normalizeMapboxVenueTypes('poi,venue'),
  'poi',
  'normalizeMapboxVenueTypes should strip unsupported venue types.'
);

assert.strictEqual(
  context.normalizeMapboxVenueTypes('poi,place,address'),
  'poi,place,address',
  'normalizeMapboxVenueTypes should retain supported types.'
);

assert.strictEqual(
  context.normalizeMapboxVenueTypes('', 'poi'),
  'poi',
  'normalizeMapboxVenueTypes should fall back to poi when empty.'
);

const venues = [
  { name: 'Sydney Opera House', address: 'Sydney NSW', city: 'Sydney', lng: 151.2153, lat: -33.8572 },
  { name: 'Federation Square', address: 'Melbourne VIC', city: 'Melbourne', lng: 144.9690, lat: -37.8179 },
  { name: 'Madison Square Garden', address: 'New York, NY', city: 'New York', lng: -73.9934, lat: 40.7505 }
];

venues.forEach(venue => context.addVenueToLocalIndex(venue));

venues.forEach(venue => {
  const results = context.searchLocalVenues(venue.name);
  assert(Array.isArray(results) && results.length > 0, `Expected results for ${venue.name}`);
  assert(
    results.some(result => {
      return result
        && result.text === venue.name
        && Array.isArray(result.place_type)
        && result.place_type.includes('venue')
        && result.place_type.includes('poi');
    }),
    `Expected ${venue.name} to be recognized as both a venue and a POI.`
  );
});

const formbuilderStart = mainSource.indexOf('function getSavedFormbuilderSnapshot(){');
assert(formbuilderStart !== -1, 'Unable to locate saved formbuilder snapshot helper.');
const baseFnStart = mainSource.indexOf('function baseNormalizeIconPath(path){');
const baseFnEnd = mainSource.indexOf('function applyNormalizeIconPath', baseFnStart);
assert(baseFnStart !== -1 && baseFnEnd !== -1, 'Unable to locate base icon normalization helper.');

const formbuilderWindow = {};
const formbuilderSlices = [
  mainSource.slice(
    mainSource.indexOf('function normalizeCategorySortOrderValue('),
    mainSource.indexOf('function compareCategoriesForDisplay', mainSource.indexOf('function normalizeCategorySortOrderValue('))
  ),
  mainSource.slice(
    mainSource.indexOf('function cloneFieldValue('),
    mainSource.indexOf('const DEFAULT_FORMBUILDER_SNAPSHOT')
  ),
  mainSource.slice(
    mainSource.indexOf('const DEFAULT_FORMBUILDER_SNAPSHOT'),
    mainSource.indexOf('const ICON_LIBRARY_ALLOWED_EXTENSION_RE')
  ),
  mainSource.slice(
    mainSource.indexOf('const ICON_LIBRARY_ALLOWED_EXTENSION_RE'),
    mainSource.indexOf('function normalizeCategoriesSnapshot(')
  ),
  mainSource.slice(
    mainSource.indexOf('function normalizeCategoriesSnapshot('),
    mainSource.indexOf('function normalizeFormbuilderSnapshot(')
  ),
  mainSource.slice(
    mainSource.indexOf('function normalizeFormbuilderSnapshot('),
    mainSource.indexOf('    window.getSavedFormbuilderSnapshot = getSavedFormbuilderSnapshot;')
  ),
  mainSource.slice(
    mainSource.indexOf('function normalizeIconLibraryEntries('),
    mainSource.indexOf('function normalizeIconAssetPath(')
  ),
  mainSource.slice(
    mainSource.indexOf('function normalizeIconAssetPath('),
    mainSource.indexOf('    const existingNormalizeIconPath', mainSource.indexOf('function normalizeIconAssetPath('))
  ),
  mainSource.slice(
    mainSource.indexOf('function normalizeIconPathMap('),
    mainSource.indexOf('    function lookupIconPath', mainSource.indexOf('function normalizeIconPathMap('))
  ),
  mainSource.slice(baseFnStart, baseFnEnd)
];

const formbuilderFactory = new Function('window', `${formbuilderSlices.join('\n')}` + '\nreturn { normalizeFormbuilderSnapshot };');
const { normalizeFormbuilderSnapshot } = formbuilderFactory(formbuilderWindow);

const seededSnapshot = normalizeFormbuilderSnapshot({
  categories: [],
  categoryIconPaths: {
    'id:101': 'icons-20/music.png',
    'name:Rock': 'assets/icons-30/guitar.svg',
    skip: '',
    custom: 'assets/icons-30/music.png',
    invalid: 'assets/icons-30/file.txt'
  },
  subcategoryIconPaths: {
    'name:Pop': 'assets/icons-30/music.png',
    'id:202': 'https://cdn.example.com/library/icon.webp',
    empty: ''
  },
  iconLibrary: ['assets/icons-30/existing.png', 'assets/icons-30/music.png']
});

const expectedSeededIcons = new Set([
  'assets/icons-30/existing.png',
  'assets/icons-30/music.png',
  'assets/icons-30/guitar.svg',
  'https://cdn.example.com/library/icon.webp'
]);

assert.strictEqual(
  seededSnapshot.iconLibrary.length,
  expectedSeededIcons.size,
  'Seeded icon library should deduplicate and retain all allowed icons.'
);

expectedSeededIcons.forEach(icon => {
  assert(
    seededSnapshot.iconLibrary.includes(icon),
    `Expected seeded icon library to include ${icon}.`
  );
});

assert(
  !seededSnapshot.iconLibrary.some(icon => /file\.txt$/.test(icon)),
  'Seeded icon library should exclude disallowed file types.'
);

assert(
  mainSource.includes("trigger.removeAttribute('aria-disabled');"),
  'Icon picker triggers should remove aria-disabled when icons are available.'
);

console.log('All tests passed');
