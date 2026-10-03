// Generates vector club crests (SVG) for managers without a custom badge, in
// two families that echo the supplied ones: a SHIELD (bold outline, cream face,
// big monogram) and a MEDALLION (gilded ring with the club name around it).
// Each manager gets an emblem that fits their club. Run:
//   node scripts/tools/makeBadges.js
// Output goes to design-samples/badges/{personKey}-{shield|medallion}.svg; once
// a style is chosen, copy the files to assets/badges/ and point the manager's
// profile `badge` at them (see assets/badges/README.md).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "design-samples", "badges");
mkdirSync(OUT, { recursive: true });

// ---------- colour helpers ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const lighten = (c, t) => mix(c, "#ffffff", t);
const darken = (c, t) => mix(c, "#000000", t);

// ---------- emblems: drawn around (0,0), roughly within +-70 ----------
const polar = (n, R, r, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = ((rot + (i * 180) / n) * Math.PI) / 180, rad = i % 2 ? r : R;
  return `${(Math.cos(a) * rad).toFixed(1)},${(Math.sin(a) * rad).toFixed(1)}`;
}).join(" ");
const star = (R, r, fill, stroke, x = 0, y = 0, sw = 3) => `<polygon transform="translate(${x} ${y})" points="${polar(5, R, r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const octagon = (R, rot = 22.5) => Array.from({ length: 8 }, (_, i) => { const a = ((rot + i * 45) * Math.PI) / 180; return `${(Math.cos(a) * R).toFixed(1)},${(Math.sin(a) * R).toFixed(1)}`; }).join(" ");

const ball = (f, s, accent) => `
  <circle r="54" fill="${f}" stroke="${s}" stroke-width="5"/>
  <polygon points="${polar(5, 20, 20)}" fill="${s}"/>
  ${[0, 72, 144, 216, 288].map((a) => `<line x1="0" y1="0" x2="${(Math.cos(((a - 90) * Math.PI) / 180) * 54).toFixed(1)}" y2="${(Math.sin(((a - 90) * Math.PI) / 180) * 54).toFixed(1)}" stroke="${s}" stroke-width="3.5"/>`).join("")}
  ${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(Math.cos(((a - 90) * Math.PI) / 180) * 41).toFixed(1)}" cy="${(Math.sin(((a - 90) * Math.PI) / 180) * 41).toFixed(1)}" r="8" fill="${accent}" stroke="${s}" stroke-width="2.5"/>`).join("")}`;

const EMBLEMS = {
  // Syria FC -- two titles: a crown over two stars
  crown: (f, s, a) => `
    <path d="M-60 34 L-66 -28 L-32 -2 L0 -50 L32 -2 L66 -28 L60 34 Z" fill="${f}" stroke="${s}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="-62" y="34" width="124" height="16" rx="4" fill="${f}" stroke="${s}" stroke-width="5"/>
    ${[[-66, -28], [0, -50], [66, -28]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${a}" stroke="${s}" stroke-width="4"/>`).join("")}
    ${star(11, 5, a, s, -30, 70, 2.5)}${star(11, 5, a, s, 30, 70, 2.5)}`,
  // i can fix him -- a wrench crossed with a ball
  wrench: (f, s, a) => `
    <g transform="translate(-6 0) rotate(40)">
      <rect x="-9" y="-6" width="18" height="86" rx="9" fill="${f}" stroke="${s}" stroke-width="5"/>
      <path d="M-26 -62 L-26 -26 Q0 -8 26 -26 L26 -62 L9 -62 L9 -40 L-9 -40 L-9 -62 Z" fill="${f}" stroke="${s}" stroke-width="5" stroke-linejoin="round"/>
    </g>
    <g transform="translate(34 28) scale(0.62)">${ball("#ffffff", s, a)}</g>`,
  // FC General -- three stars over rank chevrons
  general: (f, s, a) => `
    ${star(20, 9, f, s, -42, -38, 3)}${star(26, 11, f, s, 0, -50, 3)}${star(20, 9, f, s, 42, -38, 3)}
    ${[0, 24, 48].map((y, i) => `<path d="M-62 ${y - 4} L0 ${y + 30} L62 ${y - 4} L62 ${y + 14} L0 ${y + 48} L-62 ${y + 14} Z" fill="${i === 1 ? a : f}" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>`).join("")}`,
  // CPR -- a heart with a heartbeat line through it
  heart: (f, s, a) => `
    <path d="M0 62 C-80 6 -66 -52 -28 -46 C-12 -43 -2 -32 0 -22 C2 -32 12 -43 28 -46 C66 -52 80 6 0 62 Z" fill="${f}" stroke="${s}" stroke-width="5" stroke-linejoin="round"/>
    <polyline points="-70,6 -34,6 -20,-26 -4,36 12,-12 24,6 70,6" fill="none" stroke="${a}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Set Piece Fc -- a corner flag beside the ball
  flag: (f, s, a) => `
    <rect x="-34" y="-66" width="8" height="120" rx="3" fill="${s}"/>
    <path d="M-26 -64 L36 -42 L-26 -20 Z" fill="${f}" stroke="${s}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-62 56 A36 36 0 0 1 -26 20" fill="none" stroke="${s}" stroke-width="5"/>
    <g transform="translate(30 38) scale(0.5)">${ball("#ffffff", s, a)}</g>`,
  // Muks Militia -- crossed swords under a star
  swords: (f, s, a) => `
    ${[-42, 42].map((r) => `<g transform="rotate(${r})"><polygon points="-9,-70 9,-70 9,28 0,40 -9,28" fill="${f}" stroke="${s}" stroke-width="4" stroke-linejoin="round"/><rect x="-24" y="28" width="48" height="10" rx="4" fill="${a}" stroke="${s}" stroke-width="4"/><rect x="-5" y="38" width="10" height="26" rx="3" fill="${s}"/><circle cy="68" r="7" fill="${a}" stroke="${s}" stroke-width="3"/></g>`).join("")}
    ${star(22, 10, a, s, 0, -44, 3)}`,
  // Mourinho's Ego FT -- the Special One: a crown over a big 1
  one: (f, s, a) => `
    <path d="M-40 -36 L-44 -64 L-20 -50 L0 -72 L20 -50 L44 -64 L40 -36 Z" fill="${a}" stroke="${s}" stroke-width="4" stroke-linejoin="round"/>
    <rect x="-40" y="-36" width="80" height="9" rx="3" fill="${a}" stroke="${s}" stroke-width="4"/>
    <text x="0" y="62" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="900" font-size="112" fill="${f}" stroke="${s}" stroke-width="5" paint-order="stroke">1</text>`,
  // Patso Ball Fc -- the Stop Sign
  stop: (f, s, a) => `
    <polygon points="${octagon(64)}" fill="#d62828" stroke="${s}" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="${octagon(55)}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
    <text x="0" y="14" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="900" font-size="38" fill="#ffffff" letter-spacing="2">STOP</text>`,
  // Zacharias United -- a Z built as a lightning bolt
  zbolt: (f, s, a) => `
    <polygon points="-52,-58 58,-58 8,-4 62,-4 -56,64 -4,6 -58,6" fill="${f}" stroke="${s}" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="-34,-44 40,-44 4,-10 18,-10 -22,30 -8,-6 -34,-6" fill="${a}" opacity="0.75"/>`,
};

// ---------- the managers still without a custom badge ----------
const TEAMS = [
  { key: "ibrahim", emblem: "crown" }, { key: "david", emblem: "wrench" }, { key: "mitch", emblem: "general" },
  { key: "marshall", emblem: "heart" }, { key: "carmine", emblem: "flag" }, { key: "muk", emblem: "swords" },
  { key: "pat", emblem: "one" }, { key: "ostap", emblem: "stop" }, { key: "zac", emblem: "zbolt" },
];

const FONT = `font-family="Georgia, 'Times New Roman', serif"`;
const clean = (n) => n.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s*\*+$/, "").trim();
const fitSize = (text, maxWidth, base) => Math.min(base, (maxWidth / (text.length * 0.62)) | 0);

const SHIELD = "M200 20 L352 64 C352 192 332 284 200 384 C68 284 48 192 48 64 Z";

function shield(team) {
  const { color, abbr, club } = team;
  const dark = "#14161d", cream = "#fbf8f1", deep = darken(color, 0.25);
  const nm = club.toUpperCase();
  const layer = (s, fill) => `<path d="${SHIELD}" transform="translate(200 210) scale(${s}) translate(-200 -210)" fill="${fill}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs><clipPath id="face"><path d="${SHIELD}" transform="translate(200 210) scale(0.84) translate(-200 -210)"/></clipPath>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  ${layer(1, dark)}${layer(0.93, color)}${layer(0.88, dark)}${layer(0.84, cream)}
  <g clip-path="url(#face)">
    <path d="M0 0 H400 V126 Q200 170 0 126Z" fill="${lighten(color, 0.82)}" opacity="0.7"/>
    <g transform="translate(200 132) scale(0.84)">${EMBLEMS[team.emblem](color, dark, "#ffd24a")}</g>
    <text x="200" y="262" text-anchor="middle" ${FONT} font-weight="900" font-size="68" letter-spacing="3" fill="${dark}" stroke="${color}" stroke-width="2.4" paint-order="stroke">${abbr}</text>
    <path d="M112 278 Q200 260 288 278" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
    <path d="M146 288 Q200 276 254 288" fill="none" stroke="${deep}" stroke-width="3.5" stroke-linecap="round"/>
    <text x="200" y="316" text-anchor="middle" ${FONT} font-style="italic" font-weight="700" font-size="${fitSize(nm, 128, 20)}" letter-spacing="1.5" fill="${dark}">${nm}</text>
    <path d="${SHIELD}" transform="translate(200 210) scale(0.84) translate(-200 -210)" fill="url(#sheen)" opacity="0.35"/>
  </g>
</svg>`;
}

function medallion(team) {
  const { color, abbr, club } = team;
  const gold1 = "#fff1b8", gold2 = "#d9a53c", gold3 = "#8a5c14", ink = "#15100c";
  const nm = club.toUpperCase();
  const topSize = fitSize(nm, 270, 31);
  const stars = [-64, -32, 0, 32, 64].map((x, i) => star(8, 3.4, gold2, gold3, x, 0, 1.5)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${gold1}"/><stop offset="0.45" stop-color="${gold2}"/><stop offset="1" stop-color="${gold3}"/></linearGradient>
    <radialGradient id="disc" cx="0.4" cy="0.3" r="0.9"><stop offset="0" stop-color="${lighten(color, 0.1)}"/><stop offset="0.55" stop-color="${darken(color, 0.45)}"/><stop offset="1" stop-color="${darken(color, 0.78)}"/></radialGradient>
    <path id="top" d="M52 200 A148 148 0 0 1 348 200"/><path id="bot" d="M30 200 A170 170 0 0 0 370 200"/>
  </defs>
  <circle cx="200" cy="200" r="192" fill="url(#gold)"/>
  <circle cx="200" cy="200" r="174" fill="${ink}"/>
  <circle cx="200" cy="200" r="158" fill="none" stroke="url(#gold)" stroke-width="13" stroke-dasharray="11 7" opacity="0.9"/>
  <circle cx="200" cy="200" r="140" fill="url(#gold)"/>
  <circle cx="200" cy="200" r="132" fill="url(#disc)"/>
  <text ${FONT} font-weight="700" font-size="${topSize}" letter-spacing="4" fill="url(#gold)"><textPath href="#top" startOffset="50%" text-anchor="middle">${nm}</textPath></text>
  <text ${FONT} font-weight="700" font-size="18" letter-spacing="7" fill="${gold2}"><textPath href="#bot" startOffset="50%" text-anchor="middle">THE BUSINESS</textPath></text>
  <g transform="translate(200 176) scale(1.02)">${EMBLEMS[team.emblem]("url(#gold)", ink, color)}</g>
  <path d="M96 262 H304 L292 290 L304 318 H96 L108 290 Z" fill="${color}" stroke="url(#gold)" stroke-width="5" stroke-linejoin="round"/>
  <text x="200" y="304" text-anchor="middle" ${FONT} font-weight="900" font-size="46" letter-spacing="5" fill="#fff" stroke="${ink}" stroke-width="1.5" paint-order="stroke">${abbr}</text>
  <g transform="translate(200 336)">${stars}</g>
  <circle cx="200" cy="200" r="132" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
</svg>`;
}

const managers = JSON.parse(readFileSync(join(ROOT, "data", "managers.json"), "utf-8")).list;
let n = 0;
for (const t of TEAMS) {
  const m = managers.find((x) => x.personKey === t.key);
  if (!m) continue;
  const team = { ...t, color: m.color, abbr: m.abbreviation, club: clean(m.name) };
  writeFileSync(join(OUT, `${t.key}-shield.svg`), shield(team));
  writeFileSync(join(OUT, `${t.key}-medallion.svg`), medallion(team));
  n++;
}
console.log(`Wrote ${n * 2} crests to design-samples/badges/`);
