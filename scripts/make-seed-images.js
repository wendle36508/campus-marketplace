// Generates simple flat illustrations used as photos for the demo listings.
// Run once: node scripts/make-seed-images.js  (output: public/img/seed/*.svg)
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'img', 'seed');
fs.mkdirSync(OUT, { recursive: true });

const frame = (bg, floor, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
<defs>
  <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
  <radialGradient id="s" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<rect width="600" height="600" fill="url(#w)"/>
<rect y="455" width="600" height="145" fill="${floor}"/>
<ellipse cx="300" cy="470" rx="190" ry="26" fill="url(#s)"/>
${body}
</svg>`;

const items = {
  fridge: frame(['#e8eef2', '#d6dfe5'], '#c9b79c', `
    <rect x="200" y="120" width="200" height="350" rx="18" fill="#f7f8f9" stroke="#b9c2c9" stroke-width="4"/>
    <line x1="200" y1="225" x2="400" y2="225" stroke="#b9c2c9" stroke-width="4"/>
    <rect x="370" y="150" width="10" height="50" rx="5" fill="#9aa5ad"/>
    <rect x="370" y="250" width="10" height="90" rx="5" fill="#9aa5ad"/>
    <rect x="215" y="455" width="30" height="14" rx="4" fill="#555"/><rect x="355" y="455" width="30" height="14" rx="4" fill="#555"/>`),
  chair: frame(['#efe9e1', '#e3dacd'], '#a98d6b', `
    <rect x="215" y="95" width="170" height="180" rx="40" fill="#2f3a45"/>
    <rect x="230" y="110" width="140" height="150" rx="30" fill="#3f4c59" opacity=".8"/>
    <rect x="290" y="270" width="20" height="40" fill="#222"/>
    <rect x="195" y="300" width="210" height="45" rx="20" fill="#2f3a45"/>
    <rect x="292" y="345" width="16" height="70" fill="#666"/>
    <path d="M300 415 L190 445 M300 415 L410 445 M300 415 L250 455 M300 415 L350 455" stroke="#444" stroke-width="12" stroke-linecap="round"/>
    <circle cx="190" cy="450" r="12" fill="#222"/><circle cx="410" cy="450" r="12" fill="#222"/><circle cx="250" cy="460" r="12" fill="#222"/><circle cx="350" cy="460" r="12" fill="#222"/>`),
  rug: frame(['#f1ece6', '#e7e0d6'], '#b89b78', `
    <g transform="translate(300 330) skewX(-18)">
      <rect x="-200" y="-110" width="400" height="220" rx="6" fill="#8d96a0"/>
      <rect x="-180" y="-92" width="360" height="184" fill="none" stroke="#e9edf0" stroke-width="8"/>
      <path d="M-120 -60 L-60 0 L-120 60 M0 -60 L60 0 L0 60 M120 -60 L60 0 M-60 0 L0 -60 M-60 0 L0 60 M60 0 L120 60" stroke="#dfe4e8" stroke-width="7" fill="none"/>
      ${Array.from({ length: 20 }, (_, i) => `<line x1="${-195 + i * 20.5}" y1="110" x2="${-195 + i * 20.5}" y2="126" stroke="#d9d2c7" stroke-width="4"/>`).join('')}
    </g>`),
  textbook: frame(['#eef0f5', '#dfe3ec'], '#8c6f52', `
    <rect x="170" y="370" width="260" height="70" rx="6" fill="#1f5c99"/><rect x="170" y="370" width="260" height="12" fill="#174a7c"/>
    <rect x="185" y="300" width="240" height="70" rx="6" fill="#c0392b"/><rect x="185" y="300" width="240" height="12" fill="#9b2e22"/>
    <rect x="175" y="235" width="250" height="65" rx="6" fill="#e8b22d"/><rect x="175" y="235" width="250" height="12" fill="#c7961f"/>
    <rect x="200" y="395" width="120" height="10" rx="5" fill="#fff" opacity=".7"/><rect x="215" y="325" width="140" height="10" rx="5" fill="#fff" opacity=".7"/><rect x="200" y="260" width="100" height="10" rx="5" fill="#fff" opacity=".7"/>`),
  tv: frame(['#e9ebee', '#d8dce2'], '#7d6650', `
    <rect x="95" y="120" width="410" height="250" rx="10" fill="#15181c"/>
    <rect x="108" y="133" width="384" height="224" fill="url(#scr)"/>
    <defs><linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b6cb0"/><stop offset=".55" stop-color="#6b46c1"/><stop offset="1" stop-color="#d53f8c"/></linearGradient></defs>
    <path d="M108 300 Q 220 230 320 290 T 492 260 L492 357 L108 357Z" fill="#1a365d" opacity=".55"/>
    <rect x="160" y="370" width="16" height="70" fill="#2a2e33" transform="rotate(-12 168 370)"/><rect x="424" y="370" width="16" height="70" fill="#2a2e33" transform="rotate(12 432 370)"/>`),
  lamp: frame(['#f3efe7', '#e6dfd2'], '#9c7f5f', `
    <ellipse cx="300" cy="445" rx="80" ry="18" fill="#2d2d2d"/>
    <line x1="300" y1="440" x2="250" y2="270" stroke="#3a3a3a" stroke-width="14" stroke-linecap="round"/>
    <line x1="250" y1="270" x2="360" y2="170" stroke="#3a3a3a" stroke-width="14" stroke-linecap="round"/>
    <circle cx="250" cy="270" r="14" fill="#555"/>
    <path d="M330 150 L430 190 L400 250 L300 200 Z" fill="#f2f2f2" stroke="#3a3a3a" stroke-width="8" stroke-linejoin="round"/>
    <path d="M300 200 L400 250 L380 420 L220 420Z" fill="#fff6c9" opacity=".45"/>`),
  futon: frame(['#e7ecef', '#d5dde2'], '#a78a68', `
    <rect x="95" y="190" width="410" height="140" rx="22" fill="#4a6b5d"/>
    <rect x="95" y="300" width="410" height="80" rx="18" fill="#3f5e51"/>
    <rect x="80" y="230" width="45" height="160" rx="16" fill="#35503f"/><rect x="475" y="230" width="45" height="160" rx="16" fill="#35503f"/>
    <line x1="300" y1="200" x2="300" y2="325" stroke="#3a5649" stroke-width="5"/>
    <rect x="110" y="385" width="18" height="65" fill="#6b4f35"/><rect x="472" y="385" width="18" height="65" fill="#6b4f35"/>`),
  drawers: frame(['#eceff2', '#dde2e7'], '#a28866', `
    <rect x="200" y="140" width="200" height="315" rx="12" fill="#f4f6f8" stroke="#c3cad1" stroke-width="5"/>
    ${[0, 1, 2].map((i) => `<rect x="215" y="${158 + i * 98}" width="170" height="84" rx="8" fill="#dfe6ec" stroke="#c3cad1" stroke-width="4"/><rect x="270" y="${190 + i * 98}" width="60" height="14" rx="7" fill="#9fb0bf"/>`).join('')}`),
  coffee: frame(['#f2ece6', '#e5dbd0'], '#7d5f45', `
    <rect x="215" y="140" width="150" height="300" rx="22" fill="#1d1f22"/>
    <rect x="230" y="160" width="120" height="70" rx="12" fill="#2c3035"/>
    <circle cx="290" cy="195" r="14" fill="#4fd1c5"/>
    <rect x="230" y="250" width="120" height="30" rx="8" fill="#2c3035"/>
    <rect x="215" y="400" width="150" height="40" rx="10" fill="#2c3035"/>
    <rect x="262" y="335" width="56" height="62" rx="8" fill="#fff"/><path d="M318 350 q 22 0 22 18 q 0 18 -22 18" stroke="#fff" stroke-width="8" fill="none"/>
    <path d="M280 320 q -8 -14 0 -26 M298 320 q -8 -14 0 -26" stroke="#bbb" stroke-width="4" fill="none"/>`),
  hoodie: frame(['#eef1ee', '#dfe5df'], '#b59a7a', `
    <path d="M220 130 Q300 80 380 130 L470 190 L440 300 L410 285 L410 445 L190 445 L190 285 L160 300 L130 190 Z" fill="#006644"/>
    <path d="M250 130 Q300 210 350 130 Q300 100 250 130Z" fill="#004d33"/>
    <rect x="245" y="330" width="110" height="60" rx="10" fill="#005538"/>
    <text x="300" y="275" text-anchor="middle" font-family="Georgia,serif" font-size="46" font-weight="700" fill="#fff">BABSON</text>
    <line x1="285" y1="175" x2="280" y2="235" stroke="#fff" stroke-width="5"/><line x1="315" y1="175" x2="320" y2="235" stroke="#fff" stroke-width="5"/>`),
  tickets: frame(['#eaf0f7', '#d7e1ee'], '#8a7158', `
    <g transform="rotate(-8 300 300)"><rect x="130" y="190" width="340" height="140" rx="14" fill="#007a33"/><line x1="380" y1="200" x2="380" y2="320" stroke="#fff" stroke-width="4" stroke-dasharray="8 8"/>
    <text x="160" y="250" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#fff">ADMIT ONE</text><text x="160" y="290" font-family="Arial,sans-serif" font-size="20" fill="#d9f2e3">SEC 305 · ROW 8</text></g>
    <g transform="rotate(6 300 360)"><rect x="150" y="300" width="340" height="140" rx="14" fill="#ba9653"/><line x1="400" y1="310" x2="400" y2="430" stroke="#fff" stroke-width="4" stroke-dasharray="8 8"/>
    <text x="180" y="360" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#fff">ADMIT ONE</text><text x="180" y="400" font-family="Arial,sans-serif" font-size="20" fill="#fff6e0">SEC 305 · ROW 8</text></g>`),
  hangers: frame(['#f0eef3', '#e2deea'], '#a68b6c', `
    ${[0, 1, 2, 3].map((i) => `<g transform="translate(${-60 + i * 40} ${i * 22})"><path d="M300 150 q0 -22 18 -22 q18 0 18 18 q0 14 -36 30 L180 260 L420 260 Z" fill="none" stroke="${['#e15b64', '#3a8dde', '#f2b134', '#7b61c9'][i]}" stroke-width="10" stroke-linejoin="round"/></g>`).join('')}`),
  mirror: frame(['#eef0ee', '#e0e4e0'], '#b29676', `
    <rect x="215" y="70" width="170" height="390" rx="85" fill="#c9a96e"/>
    <rect x="230" y="85" width="140" height="360" rx="70" fill="#cfe3ec"/>
    <path d="M260 140 L330 110 M255 190 L345 150" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".8"/>`),
  microwave: frame(['#edf0f2', '#dde2e6'], '#93795c', `
    <rect x="120" y="190" width="360" height="230" rx="18" fill="#f2f2f2" stroke="#b8bfc6" stroke-width="5"/>
    <rect x="145" y="215" width="230" height="180" rx="10" fill="#2b2f33"/>
    <rect x="160" y="230" width="200" height="150" rx="6" fill="#3b4148"/>
    <rect x="395" y="220" width="65" height="30" rx="5" fill="#1d3b2c"/><text x="427" y="242" text-anchor="middle" font-family="monospace" font-size="18" fill="#7cf0a5">0:30</text>
    ${[0, 1, 2, 3].map((r) => [0, 1].map((c) => `<rect x="${400 + c * 30}" y="${265 + r * 30}" width="22" height="20" rx="4" fill="#cdd3d8"/>`).join('')).join('')}`),
  bike: frame(['#e9f0ec', '#d8e4dd'], '#8f7a5f', `
    <circle cx="180" cy="370" r="80" fill="none" stroke="#222" stroke-width="12"/><circle cx="420" cy="370" r="80" fill="none" stroke="#222" stroke-width="12"/>
    <path d="M180 370 L260 250 L390 250 L420 370 M260 250 L300 370 L390 250 M300 370 L180 370" fill="none" stroke="#c0392b" stroke-width="12" stroke-linejoin="round"/>
    <line x1="250" y1="225" x2="285" y2="225" stroke="#222" stroke-width="14" stroke-linecap="round"/><line x1="260" y1="250" x2="265" y2="228" stroke="#c0392b" stroke-width="10"/>
    <path d="M390 250 L380 210 L415 205" fill="none" stroke="#333" stroke-width="10" stroke-linecap="round"/>`),
  bookshelf: frame(['#f1ede6', '#e4ddd2'], '#9a7d5d', `
    <rect x="200" y="90" width="200" height="370" fill="#f6f1e7" stroke="#c9bda8" stroke-width="6"/>
    ${[0, 1, 2, 3].map((i) => `<line x1="200" y1="${180 + i * 90}" x2="400" y2="${180 + i * 90}" stroke="#c9bda8" stroke-width="6"/>`).join('')}
    <rect x="215" y="120" width="18" height="57" fill="#c0392b"/><rect x="236" y="130" width="18" height="47" fill="#2c6e9b"/><rect x="257" y="115" width="16" height="62" fill="#e8b22d"/>
    <rect x="300" y="215" width="70" height="52" fill="#7aa874"/>`),
  airpods: frame(['#f3f4f6', '#e5e7eb'], '#a3a3a3', `
    <rect x="215" y="200" width="170" height="200" rx="60" fill="#fafafa" stroke="#d1d5db" stroke-width="5"/>
    <line x1="215" y1="260" x2="385" y2="260" stroke="#d1d5db" stroke-width="4"/><circle cx="300" cy="320" r="6" fill="#9ca3af"/>`),
  beerpong: frame(['#eef1f5', '#dde3ea'], '#8a7158', `
    <rect x="70" y="300" width="460" height="40" rx="8" fill="#1e3a8a"/>
    <rect x="90" y="340" width="14" height="110" fill="#555"/><rect x="496" y="340" width="14" height="110" fill="#555"/>
    ${[0, 1, 2].map((i) => `<path d="M${110 + i * 34} 300 l6 -42 h26 l6 42z" fill="#dc2626"/>`).join('')}
    ${[0, 1, 2].map((i) => `<path d="M${388 + i * 34} 300 l6 -42 h26 l6 42z" fill="#dc2626"/>`).join('')}`),
};

for (const [name, svg] of Object.entries(items)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg.trim() + '\n');
}
console.log(`Wrote ${Object.keys(items).length} images to ${OUT}`);
