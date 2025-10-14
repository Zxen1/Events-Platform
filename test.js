const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

assert(
  html.includes("types: 'poi,place,address,venue'"),
  'Global geocoder must accept venue results.'
);

assert(
  html.includes("types:'poi,venue'"),
  'Remote venue search must request poi and venue types.'
);

assert(
  html.includes("types || 'poi,venue'"),
  'Remote venue search must default to poi and venue types.'
);

const start = html.indexOf('const LOCAL_GEOCODER_MAX_RESULTS = 10;');
const end = html.indexOf('const MAPBOX_VENUE_ENDPOINT');
assert(start !== -1 && end !== -1 && end > start, 'Unable to locate local venue search source in index.html');

const code = html.slice(start, end);
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(code, context);

const requiredFns = ['addVenueToLocalIndex', 'searchLocalVenues'];
for (const fn of requiredFns) {
  assert.strictEqual(typeof context[fn], 'function', `Expected ${fn} to be defined.`);
}

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
    results.some(result => result && result.text === venue.name && Array.isArray(result.place_type) && result.place_type.includes('venue')),
    `Expected ${venue.name} to be recognized as a venue.`
  );
});

console.log('All tests passed');
