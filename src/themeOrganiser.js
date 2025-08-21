let fields = {};

function updateFields(newFields) {
  fields = { ...fields, ...newFields };
  console.log('Theme organiser updated', fields);
}

function getFields() {
  return fields;
}

module.exports = { updateFields, getFields };
