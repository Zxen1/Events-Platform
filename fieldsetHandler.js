function attachFieldsetHandlers(doc) {
  doc.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-fieldset-toggle]');
    if (!toggle) return;
    const fieldset = toggle.closest('fieldset');
    if (!fieldset) return;
    fieldset.classList.toggle('collapsed');
  });
}

module.exports = { attachFieldsetHandlers };
