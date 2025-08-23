let fields = {};

// Update the tracked fields. By default new values are merged with any
// existing ones, but passing `true` for `replace` will overwrite the entire
// set. DOM inputs are updated to reflect the provided values.
function updateFields(newFields, replace = false) {
  if (replace) fields = {};
  fields = { ...fields, ...newFields };
  if (typeof document !== 'undefined') {
    const entries = replace ? fields : newFields;
    Object.entries(entries).forEach(([key, val]) => {
      const input = document.getElementById(key);
      if (input) input.value = val;
    });
  }
  console.log('Theme organiser updated', fields);
}

// Clear all stored fields and any associated DOM input values so that stale
// data does not linger when a new theme is applied.
function resetFields() {
  if (typeof document !== 'undefined') {
    Object.keys(fields).forEach(key => {
      const input = document.getElementById(key);
      if (input) input.value = '';
    });
  }
  fields = {};
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

module.exports = { updateFields, getFields, bindColorInputs, resetFields };
