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

module.exports = { updateFields, getFields };
