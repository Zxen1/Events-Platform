function attachFieldsetHandlers(doc) {
  doc.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-fieldset-toggle]');
    if (!toggle) return;

    // Ignore generic containers that happen to carry the attribute.
    // Only explicit interactive elements (e.g. buttons or legends)
    // should trigger collapsing.
    const interactiveTags = ['button', 'summary', 'legend'];
    if (!interactiveTags.includes(toggle.tagName.toLowerCase())) return;

    const fieldset = toggle.closest('fieldset');
    if (!fieldset) return;

    fieldset.classList.toggle('collapsed');
  });
}
module.exports = { attachFieldsetHandlers };
