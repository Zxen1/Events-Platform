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

// Ensure clicks within a fieldset marked with the toggle attribute itself
// do not inadvertently trigger collapsing when interacting inside.
const outerFieldset = new MockElement({ tag: 'fieldset', attrs: { 'data-fieldset-toggle': '' } });
const outerToggle = new MockElement({ parent: outerFieldset, attrs: { 'data-fieldset-toggle': '' }, tag: 'button' });
const innerInput = new MockElement({ parent: outerFieldset, tag: 'input' });

document.dispatchEvent('click', { target: innerInput });
assert.strictEqual(outerFieldset.classList.contains('collapsed'), false);

document.dispatchEvent('click', { target: outerToggle });
assert.strictEqual(outerFieldset.classList.contains('collapsed'), true);

// Ensure non-interactive wrappers with the toggle attribute do not trigger collapsing.
const fs = new MockElement({ tag: 'fieldset' });
const wrapper = new MockElement({ parent: fs, attrs: { 'data-fieldset-toggle': '' }, tag: 'div' });
const buttonToggle = new MockElement({ parent: wrapper, attrs: { 'data-fieldset-toggle': '' }, tag: 'button' });
const inner = new MockElement({ parent: wrapper, tag: 'input' });

document.dispatchEvent('click', { target: inner });
assert.strictEqual(fs.classList.contains('collapsed'), false);

document.dispatchEvent('click', { target: buttonToggle });
assert.strictEqual(fs.classList.contains('collapsed'), true);

console.log('All tests passed!');
