const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

assert(
  html.includes("types: 'poi,place,address'"),
  'Global geocoder must request supported Mapbox types.'
);

assert(
  html.includes("const MAPBOX_SUPPORTED_VENUE_TYPES = ['poi','place','address'];"),
  'Supported Mapbox venue types must be declared.'
);

const start = html.indexOf('const LOCAL_GEOCODER_MAX_RESULTS = 10;');
const end = html.indexOf('rebuildVenueIndex();');
assert(start !== -1 && end !== -1 && end > start, 'Unable to locate local venue search source in index.html');

const code = html.slice(start, end);
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

console.log('All tests passed');
