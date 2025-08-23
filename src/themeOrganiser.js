let fields = {};

function updateFields(newFields) {
  fields = { ...fields, ...newFields };
  if (typeof document !== 'undefined') {
    Object.entries(newFields).forEach(([key, val]) => {
      const input = document.getElementById(key);
      if (input) input.value = val;
    });
  }
  console.log('Theme organiser updated', fields);
}

function getFields() {
  return fields;
}

// Bind color input elements to CSS variables for instant theme updates
// bindings: { inputId: cssVariable }
function bindColorInputs(bindings) {
  if (typeof document === 'undefined') return;
  Object.entries(bindings).forEach(([id, varName]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', e => {
      document.documentElement.style.setProperty(varName, e.target.value);
      updateFields({ [id]: e.target.value });
    });
  });
}

module.exports = { updateFields, getFields, bindColorInputs };
