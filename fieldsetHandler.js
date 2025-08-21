function attachFieldsetHandlers(doc) {
  doc.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-fieldset-toggle]');
    if (!toggle) return;

    const fieldset = toggle.closest('fieldset');
    // Honor admin modal settings by ignoring clicks that bubble from
    // within a fieldset carrying the toggle attribute itself. Only
    // the dedicated toggle elements should trigger collapsing.
    if (!fieldset || toggle === fieldset) return;

    fieldset.classList.toggle('collapsed');
  });
}
module.exports = { attachFieldsetHandlers };
