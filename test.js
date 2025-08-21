const assert = require('assert');
const { attachFieldsetHandlers } = require('./fieldsetHandler');

class MockClassList {
  constructor() { this._set = new Set(); }
  add(cls) { this._set.add(cls); }
  remove(cls) { this._set.delete(cls); }
  contains(cls) { return this._set.has(cls); }
  toggle(cls) { if (this._set.has(cls)) { this._set.delete(cls); return false; } this._set.add(cls); return true; }
}

class MockElement {
  constructor({ parent = null, attrs = {}, tag = 'div' } = {}) {
    this.parentElement = parent;
    this.attrs = attrs;
    this.tagName = tag;
    this.classList = new MockClassList();
  }
  closest(selector) {
    let el = this;
    while (el) {
      if (selector === 'fieldset' && el.tagName === 'fieldset') return el;
      if (selector === '[data-fieldset-toggle]' && 'data-fieldset-toggle' in el.attrs) return el;
      el = el.parentElement;
    }
    return null;
  }
}

function createDocument() {
  const handlers = {};
  return {
    addEventListener(type, fn) { handlers[type] = fn; },
    dispatchEvent(type, event) { if (handlers[type]) handlers[type](event); }
  };
}

const document = createDocument();
attachFieldsetHandlers(document);

const fieldset = new MockElement({ tag: 'fieldset' });
const toggle = new MockElement({ parent: fieldset, attrs: { 'data-fieldset-toggle': '' }, tag: 'button' });
const input = new MockElement({ parent: fieldset, tag: 'input' });

document.dispatchEvent('click', { target: input });
assert.strictEqual(fieldset.classList.contains('collapsed'), false);

document.dispatchEvent('click', { target: toggle });
assert.strictEqual(fieldset.classList.contains('collapsed'), true);

document.dispatchEvent('click', { target: input });
assert.strictEqual(fieldset.classList.contains('collapsed'), true);

document.dispatchEvent('click', { target: toggle });
assert.strictEqual(fieldset.classList.contains('collapsed'), false);

console.log('All tests passed!');
