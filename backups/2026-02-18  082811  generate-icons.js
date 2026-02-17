const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'phospher light icons');
const outDir = path.join(__dirname, 'category-icons-new');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const categories = {
    'buy-and-sell':  'storefront-light.svg',
    'eat-and-drink': 'fork-knife-light.svg',
    'for-hire':      'briefcase-light.svg',
    'get-around':    'map-trifold-light.svg',
    'learning':      'graduation-cap-light.svg',
    'opportunities': 'rocket-launch-light.svg',
    'stay':          'bed-light.svg',
    'test':          'test-tube-light.svg',
    'venues':        'buildings-light.svg',
    'whats-on':      'calendar-star-light.svg'
};

const colors = {
    'blue':   '#2563EB',
    'cyan':   '#0891B2',
    'gray':   '#4B5563',
    'green':  '#16A34A',
    'orange': '#EA580C',
    'pink':   '#DB2777',
    'purple': '#9333EA',
    'red':    '#DC2626',
    'teal':   '#0D9488',
    'yellow': '#CA8A04'
};

function extractInnerContent(svgString) {
    // Remove opening <svg ...> tag
    var inner = svgString.replace(/^<svg[^>]*>/, '');
    // Remove closing </svg>
    inner = inner.replace(/<\/svg>\s*$/, '');
    // Remove the background rect
    inner = inner.replace(/<rect\s+width="256"\s+height="256"\s+fill="none"\s*\/>/, '');
    return inner.trim();
}

var count = 0;

for (var catKey in categories) {
    var srcFile = path.join(srcDir, categories[catKey]);
    var svgContent = fs.readFileSync(srcFile, 'utf8').trim();
    var innerContent = extractInnerContent(svgContent);

    // Plain version - just copy the source file
    var plainPath = path.join(outDir, catKey + '.svg');
    fs.copyFileSync(srcFile, plainPath);
    count++;

    // Coloured versions
    for (var colorName in colors) {
        var hex = colors[colorName];
        var coloredSvg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">\n' +
            '  <circle cx="12" cy="12" r="12" fill="' + hex + '"/>\n' +
            '  <g transform="translate(4, 4) scale(0.0625)">\n' +
            '    ' + innerContent + '\n' +
            '  </g>\n' +
            '</svg>\n';

        var outPath = path.join(outDir, catKey + '-' + colorName + '.svg');
        fs.writeFileSync(outPath, coloredSvg, 'utf8');
        count++;
    }
}

console.log('Generated ' + count + ' icons in ' + outDir);
