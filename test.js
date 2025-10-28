const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const mainSource = fs.readFileSync('index.js', 'utf8');
const adminSource = fs.readFileSync('admin.js', 'utf8');

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

const formbuilderFactory = new Function('window', `${formbuilderSlices.join('\n')}` + '\nreturn { normalizeFormbuilderSnapshot, normalizeIconLibraryEntries, normalizeIconPathMap, normalizeIconAssetPath, ICON_LIBRARY_ALLOWED_EXTENSION_RE };');
const { normalizeFormbuilderSnapshot, normalizeIconLibraryEntries, normalizeIconPathMap, normalizeIconAssetPath, ICON_LIBRARY_ALLOWED_EXTENSION_RE } = formbuilderFactory(formbuilderWindow);

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

const seededFromStoredPaths = normalizeFormbuilderSnapshot({
  categories: [],
  categoryIconPaths: {
    'id:303': 'icons-20/food.png'
  },
  subcategoryIconPaths: {
    'id:404': 'https://cdn.example.com/library/icon.webp'
  },
  iconLibrary: []
});

const expectedStoredPathIcons = new Set([
  'assets/icons-30/food.png',
  'https://cdn.example.com/library/icon.webp'
]);

assert.strictEqual(
  seededFromStoredPaths.iconLibrary.length,
  expectedStoredPathIcons.size,
  'Stored icon paths should seed the icon library when no explicit entries exist.'
);

expectedStoredPathIcons.forEach(icon => {
  assert(
    seededFromStoredPaths.iconLibrary.includes(icon),
    `Expected stored icon path seeding to retain ${icon}.`
  );
});

const seededFromPathsWithoutExplicitLibrary = normalizeFormbuilderSnapshot({
  categories: [],
  categoryIconPaths: {
    'id:505': 'icons-20/comedy.png'
  },
  subcategoryIconPaths: {
    'name:Standup': 'assets/icons-30/microphone.svg'
  }
});

const expectedIconsWithoutExplicitLibrary = new Set([
  'assets/icons-30/comedy.png',
  'assets/icons-30/microphone.svg'
]);

assert.strictEqual(
  seededFromPathsWithoutExplicitLibrary.iconLibrary.length,
  expectedIconsWithoutExplicitLibrary.size,
  'Snapshots without explicit icon libraries should still surface icons from stored paths.'
);

expectedIconsWithoutExplicitLibrary.forEach(icon => {
  assert(
    seededFromPathsWithoutExplicitLibrary.iconLibrary.includes(icon),
    `Expected icon library seeding without explicit entries to retain ${icon}.`
  );
});

assert(
  seededFromPathsWithoutExplicitLibrary.iconLibrary.length > 0,
  'Icon library should not be empty when category or subcategory icons are present.'
);

assert(
  mainSource.includes("trigger.removeAttribute('aria-disabled');")
    || adminSource.includes("trigger.removeAttribute('aria-disabled');"),
  'Icon picker triggers should remove aria-disabled when icons are available.'
);

const iconBootstrapStart = mainSource.indexOf('const ICON_LIBRARY = Array.isArray(window.iconLibrary)');
const iconBootstrapEnd = mainSource.indexOf('const FORM_FIELD_TYPES =', iconBootstrapStart);
assert(
  iconBootstrapStart !== -1 && iconBootstrapEnd !== -1,
  'Unable to locate icon library bootstrap block.'
);

const iconBootstrapSource = mainSource.slice(iconBootstrapStart, iconBootstrapEnd);

const assignMapLike = (target, source) => {
  if(!target || typeof target !== 'object'){
    return;
  }
  Object.keys(target).forEach(key => { delete target[key]; });
  if(source && typeof source === 'object'){
    Object.keys(source).forEach(key => {
      target[key] = source[key];
    });
  }
};

const persistedBootstrapSnapshot = {
  categories: [],
  categoryIconPaths: {
    'id:101': 'icons-20/music.png',
    'name:Rock': 'assets/icons-30/guitar.svg'
  },
  subcategoryIconPaths: {
    'name:Pop': 'assets/icons-30/music.png',
    'id:202': 'https://cdn.example.com/library/icon.webp'
  },
  iconLibrary: ['assets/icons-30/existing.png'],
  versionPriceCurrencies: []
};

const bootstrapWindow = {
  iconLibrary: [],
  categoryIconPaths: {},
  subcategoryIconPaths: {},
  categoryIcons: {},
  subcategoryIcons: {}
};

const bootstrapContext = {
  window: bootstrapWindow,
  normalizeFormbuilderSnapshot,
  normalizeIconPathMap,
  normalizeIconLibraryEntries,
  normalizeIconAssetPath,
  ICON_LIBRARY_ALLOWED_EXTENSION_RE,
  assignMapLike,
  getPersistedFormbuilderSnapshotFromGlobals: () => persistedBootstrapSnapshot,
  getSavedFormbuilderSnapshot: () => {
    throw new Error('getSavedFormbuilderSnapshot should not be called when persisted snapshot exists.');
  },
  console
};

vm.createContext(bootstrapContext);
vm.runInContext(iconBootstrapSource, bootstrapContext);

const expectedBootstrapIcons = new Set([
  'assets/icons-30/existing.png',
  'assets/icons-30/music.png',
  'assets/icons-30/guitar.svg',
  'https://cdn.example.com/library/icon.webp'
]);

assert.strictEqual(
  bootstrapWindow.iconLibrary.length,
  expectedBootstrapIcons.size,
  'Bootstrap icon library should include all unique seeded icons.'
);

expectedBootstrapIcons.forEach(icon => {
  assert(
    bootstrapWindow.iconLibrary.includes(icon),
    `Expected bootstrap icon library to include ${icon}.`
  );
});

assert(
  new Set(bootstrapWindow.iconLibrary).size === bootstrapWindow.iconLibrary.length,
  'Bootstrap icon library should not contain duplicate entries.'
);

if('ICON_LIBRARY' in bootstrapContext){
  assert.strictEqual(
    bootstrapContext.ICON_LIBRARY,
    bootstrapWindow.iconLibrary,
    'ICON_LIBRARY should reference the shared window icon library array.'
  );
}

const persistedBootstrapSnapshotFromPaths = {
  categories: [],
  categoryIconPaths: {
    'id:303': 'icons-20/food.png'
  },
  subcategoryIconPaths: {
    'id:404': 'https://cdn.example.com/library/icon.webp'
  },
  iconLibrary: [],
  versionPriceCurrencies: []
};

const bootstrapWindowFromPaths = {
  iconLibrary: [],
  categoryIconPaths: {},
  subcategoryIconPaths: {},
  categoryIcons: {},
  subcategoryIcons: {}
};

const bootstrapContextFromPaths = {
  window: bootstrapWindowFromPaths,
  normalizeFormbuilderSnapshot,
  normalizeIconPathMap,
  normalizeIconLibraryEntries,
  normalizeIconAssetPath,
  ICON_LIBRARY_ALLOWED_EXTENSION_RE,
  assignMapLike,
  getPersistedFormbuilderSnapshotFromGlobals: () => persistedBootstrapSnapshotFromPaths,
  getSavedFormbuilderSnapshot: () => {
    throw new Error('getSavedFormbuilderSnapshot should not be called when persisted snapshot exists.');
  },
  console
};

vm.createContext(bootstrapContextFromPaths);
vm.runInContext(iconBootstrapSource, bootstrapContextFromPaths);

const expectedBootstrapIconsFromPaths = new Set([
  'assets/icons-30/food.png',
  'https://cdn.example.com/library/icon.webp'
]);

assert.strictEqual(
  bootstrapWindowFromPaths.iconLibrary.length,
  expectedBootstrapIconsFromPaths.size,
  'Bootstrap should seed icon picker assets from stored category and subcategory icons.'
);

expectedBootstrapIconsFromPaths.forEach(icon => {
  assert(
    bootstrapWindowFromPaths.iconLibrary.includes(icon),
    `Expected bootstrap icon seeding to include ${icon}.`
  );
});

assert(
  bootstrapWindowFromPaths.iconLibrary.length > 0,
  'Icon picker triggers should enable when stored icons are available even without explicit library entries.'
);

const persistedBootstrapSnapshotCategoryOnly = {
  categories: [],
  categoryIconPaths: {
    'id:505': 'icons-20/comedy.png'
  },
  subcategoryIconPaths: {},
  iconLibrary: [],
  versionPriceCurrencies: []
};

const bootstrapWindowCategoryOnly = {
  iconLibrary: [],
  categoryIconPaths: {},
  subcategoryIconPaths: {},
  categoryIcons: {},
  subcategoryIcons: {}
};

const bootstrapContextCategoryOnly = {
  window: bootstrapWindowCategoryOnly,
  normalizeFormbuilderSnapshot,
  normalizeIconPathMap,
  normalizeIconLibraryEntries,
  normalizeIconAssetPath,
  ICON_LIBRARY_ALLOWED_EXTENSION_RE,
  assignMapLike,
  getPersistedFormbuilderSnapshotFromGlobals: () => persistedBootstrapSnapshotCategoryOnly,
  getSavedFormbuilderSnapshot: () => {
    throw new Error('Unexpected saved snapshot lookup for category-only bootstrap test.');
  },
  console
};

vm.createContext(bootstrapContextCategoryOnly);
vm.runInContext(iconBootstrapSource, bootstrapContextCategoryOnly);

const persistedBootstrapSnapshotSubcategoryOnly = {
  categories: [],
  categoryIconPaths: {},
  subcategoryIconPaths: {
    'id:606': 'https://cdn.example.com/library/icon.webp'
  },
  iconLibrary: [],
  versionPriceCurrencies: []
};

const bootstrapWindowSubcategoryOnly = {
  iconLibrary: [],
  categoryIconPaths: {},
  subcategoryIconPaths: {},
  categoryIcons: {},
  subcategoryIcons: {}
};

const bootstrapContextSubcategoryOnly = {
  window: bootstrapWindowSubcategoryOnly,
  normalizeFormbuilderSnapshot,
  normalizeIconPathMap,
  normalizeIconLibraryEntries,
  normalizeIconAssetPath,
  ICON_LIBRARY_ALLOWED_EXTENSION_RE,
  assignMapLike,
  getPersistedFormbuilderSnapshotFromGlobals: () => persistedBootstrapSnapshotSubcategoryOnly,
  getSavedFormbuilderSnapshot: () => {
    throw new Error('Unexpected saved snapshot lookup for subcategory-only bootstrap test.');
  },
  console
};

vm.createContext(bootstrapContextSubcategoryOnly);
vm.runInContext(iconBootstrapSource, bootstrapContextSubcategoryOnly);

const iconPickerSource = mainSource.includes('const attachIconPicker = (trigger, container, options = {})=>{')
  ? mainSource
  : adminSource;
const attachIconPickerStart = iconPickerSource.indexOf('const attachIconPicker = (trigger, container, options = {})=>{');
const attachIconPickerEnd = iconPickerSource.indexOf('const frag = document.createDocumentFragment();', attachIconPickerStart);

assert(
  attachIconPickerStart !== -1 && attachIconPickerEnd !== -1,
  'Unable to locate icon picker attachment helper.'
);

const attachIconPickerSource = iconPickerSource.slice(attachIconPickerStart, attachIconPickerEnd);

const attachIconPickerFactory = new Function('context', `with(context){ ${attachIconPickerSource} return attachIconPicker; }`);

const createIconPickerHarness = iconLibrary => {
  const windowStub = {
    __openIconPickers: new Set(),
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 1280,
    innerHeight: 720
  };
  const createElementStub = () => ({
    append: () => {},
    appendChild: () => {},
    remove: () => {},
    setAttribute: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 0, width: 0, height: 0 }),
    contains: () => false,
    addEventListener: () => {},
    removeEventListener: () => {},
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    style: {},
    textContent: '',
    innerHTML: '',
    focus: () => {}
  });
  const documentStub = {
    createElement: () => createElementStub(),
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: { clientWidth: 1280, clientHeight: 720 }
  };
  const context = {
    ICON_LIBRARY: iconLibrary,
    applyNormalizeIconPath: value => value,
    closeAllIconPickers: () => {},
    OPEN_ICON_PICKERS: windowStub.__openIconPickers,
    document: documentStub,
    window: windowStub,
    requestAnimationFrame: fn => { context.__raf = fn; return 1; },
    cancelAnimationFrame: () => {},
    ResizeObserver: undefined,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  return attachIconPickerFactory(context);
};

const createTriggerStub = () => {
  const attributes = new Map();
  const removedAttributes = [];
  return {
    disabled: true,
    addEventListener: () => {},
    setAttribute: (name, value) => { attributes.set(name, value); },
    removeAttribute: name => {
      attributes.delete(name);
      removedAttributes.push(name);
    },
    getAttribute: name => attributes.get(name),
    getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 0, width: 0, height: 0 }),
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    contains: () => false,
    _removedAttributes: removedAttributes
  };
};

const createContainerStub = () => ({
  classList: {
    add: () => {},
    remove: () => {}
  },
  appendChild: () => {},
  append: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  contains: () => false
});

const categoryIconPicker = createIconPickerHarness(bootstrapWindowCategoryOnly.iconLibrary);
const categoryTrigger = createTriggerStub();
categoryTrigger.setAttribute('aria-disabled', 'true');
categoryIconPicker(categoryTrigger, createContainerStub());

assert.strictEqual(
  categoryTrigger.disabled,
  false,
  'Category icon picker buttons should enable when saved category icons exist.'
);

assert(
  categoryTrigger._removedAttributes.includes('aria-disabled'),
  'Category icon picker buttons should clear aria-disabled when icons are available.'
);

const subcategoryIconPicker = createIconPickerHarness(bootstrapWindowSubcategoryOnly.iconLibrary);
const subcategoryTrigger = createTriggerStub();
subcategoryTrigger.setAttribute('aria-disabled', 'true');
subcategoryIconPicker(subcategoryTrigger, createContainerStub());

assert.strictEqual(
  subcategoryTrigger.disabled,
  false,
  'Subcategory icon picker buttons should enable when saved subcategory icons exist.'
);

assert(
  subcategoryTrigger._removedAttributes.includes('aria-disabled'),
  'Subcategory icon picker buttons should clear aria-disabled when icons are available.'
);

console.log('All tests passed');
