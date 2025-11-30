function hexToRgb(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}

function adjust(hex, amt) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex({
    r: clamp(rgb.r + amt),
    g: clamp(rgb.g + amt),
    b: clamp(rgb.b + amt)
  });
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const { r, g, b } = rgb;
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

const DEFAULT_BASE_COLOR = '#336699';

function isValidHex(hex) {
  return /^#([0-9a-fA-F]{6})$/.test(hex);
}

function generateTheme(baseColor) {
  const base = isValidHex(baseColor) ? baseColor : DEFAULT_BASE_COLOR;
  const primary = base;
  const secondary = adjust(base, 30);
  const accent = adjust(base, -30);
  const background = adjust(base, 60);
  const text = luminance(background) > 0.5 ? '#000000' : '#ffffff';
  const buttonText = luminance(secondary) > 0.5 ? '#000000' : '#ffffff';
  const buttonHoverText = luminance(accent) > 0.5 ? '#000000' : '#ffffff';
  return { primary, secondary, accent, background, text, buttonText, buttonHoverText };
}

module.exports = { generateTheme, DEFAULT_BASE_COLOR };
