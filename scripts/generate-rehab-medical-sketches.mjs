/**
 * Genererer medisinsk skisse-SVG for rehab-øvelser (e195a–e195v).
 * Kjør: node scripts/generate-rehab-medical-sketches.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "exercise-illustrations", "rehab");

const O = "#334155";
const SK = "#f5f2ed";
const SKS = "#e8e4de";
const MU = "#c4a0a0";
const MUS = "#8b7070";
const B = "#64748b";
const EQ = "#94a3b8";
const W = "#cbd5e1";
const F = "#e2e8f0";

const SIDE = 512;

function wrap(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${SIDE}" viewBox="0 0 200 200" fill="none" role="img" aria-hidden="true">
  <rect width="200" height="200" fill="#ffffff"/>
  ${inner}
</svg>`;
}

/** @type {Record<string, string>} */
const SKETCHES = {
  e195a: wrap(`
  <line x1="20" y1="175" x2="180" y2="175" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="52" rx="14" ry="16" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 68 Q100 78 112 68 L108 105 Q100 112 92 105 Z" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M70 78 L45 82" stroke="${B}" stroke-width="2.5" stroke-dasharray="4 3"/>
  <path d="M130 78 L155 82" stroke="${B}" stroke-width="2.5" stroke-dasharray="4 3"/>
  <path d="M88 82 L55 80" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M112 82 L145 80" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <ellipse cx="72" cy="78" rx="10" ry="7" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  <ellipse cx="128" cy="78" rx="10" ry="7" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  <path d="M95 105 L88 145 M105 105 L112 145" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M88 145 L82 172 M112 145 L118 172" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  `),

  e195b: wrap(`
  <line x1="25" y1="155" x2="175" y2="155" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="95" rx="38" ry="12" fill="${SKS}" stroke="${EQ}" stroke-width="1.2"/>
  <ellipse cx="100" cy="88" rx="22" ry="28" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M78 95 Q100 72 122 95" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  <circle cx="100" cy="55" r="12" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 67 L85 95 M112 67 L115 95" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M85 95 L78 120 M115 95 L122 120" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M78 120 L72 145 M122 120 L128 145" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
  `),

  e195c: wrap(`
  <line x1="35" y1="40" x2="35" y2="175" stroke="${W}" stroke-width="4"/>
  <line x1="25" y1="175" x2="175" y2="175" stroke="${F}" stroke-width="2"/>
  <circle cx="58" cy="48" r="11" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M52 60 Q58 68 64 60 L62 95 Q58 100 54 95 Z" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M54 95 L50 130 Q58 138 66 130 L62 95" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M50 130 L42 155" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M66 130 L74 155" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M48 105 L38 125" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
  <ellipse cx="58" cy="118" rx="14" ry="18" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195d: wrap(`
  <rect x="95" y="120" width="55" height="12" rx="2" fill="${EQ}" stroke="${O}" stroke-width="1.2"/>
  <line x1="20" y1="175" x2="180" y2="175" stroke="${F}" stroke-width="2"/>
  <circle cx="75" cy="55" r="11" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M68 68 L65 100 Q75 108 85 100 L82 68" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M65 100 L60 125" stroke="${O}" stroke-width="1.8"/>
  <path d="M85 100 L90 132" stroke="${O}" stroke-width="1.8"/>
  <path d="M90 132 L88 175" stroke="${O}" stroke-width="1.8"/>
  <path d="M60 125 L58 175" stroke="${O}" stroke-width="1.8"/>
  <ellipse cx="88" cy="115" rx="8" ry="12" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195e: wrap(`
  <line x1="30" y1="160" x2="170" y2="160" stroke="${F}" stroke-width="2"/>
  <ellipse cx="95" cy="100" rx="28" ry="10" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="70" cy="75" r="11" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M62 88 L58 115" stroke="${O}" stroke-width="1.8"/>
  <path d="M78 88 L82 115" stroke="${O}" stroke-width="1.8"/>
  <path d="M58 115 L52 145" stroke="${O}" stroke-width="1.8"/>
  <path d="M82 115 L95 130 L115 125" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M115 125 L140 120" stroke="${B}" stroke-width="2.5"/>
  <ellipse cx="72" cy="108" rx="12" ry="8" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  `),

  e195f: wrap(`
  <line x1="30" y1="155" x2="170" y2="155" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="105" rx="35" ry="12" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="100" cy="70" r="12" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 84 L85 120 M112 84 L115 120" stroke="${O}" stroke-width="1.8"/>
  <path d="M85 120 L82 150 M115 120 L118 150" stroke="${O}" stroke-width="1.8"/>
  <path d="M82 118 L118 118" stroke="${O}" stroke-width="1.8"/>
  <path d="M88 95 L112 95" stroke="${MUS}" stroke-width="1" stroke-dasharray="3 2"/>
  <ellipse cx="100" cy="108" rx="18" ry="10" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  `),

  e195g: wrap(`
  <line x1="25" y1="150" x2="175" y2="150" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="100" rx="40" ry="14" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="100" cy="62" r="12" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 76 L85 105 M112 76 L115 105" stroke="${O}" stroke-width="1.6"/>
  <path d="M85 105 L75 125" stroke="${O}" stroke-width="1.8"/>
  <path d="M115 105 L125 125" stroke="${O}" stroke-width="1.8"/>
  <path d="M75 125 L95 118" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M125 125 L105 118" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <ellipse cx="88" cy="112" rx="10" ry="6" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195h: wrap(`
  <line x1="25" y1="170" x2="175" y2="170" stroke="${F}" stroke-width="2"/>
  <path d="M55 95 Q100 88 145 95" stroke="${B}" stroke-width="2.5" fill="none"/>
  <circle cx="100" cy="52" r="11" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 65 Q100 78 112 65 L108 100 Q100 108 92 100 Z" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M92 100 L88 135 Q100 142 112 135 L108 100" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 135 L85 168 M112 135 L115 168" stroke="${O}" stroke-width="1.8"/>
  <ellipse cx="100" cy="118" rx="14" ry="12" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195i: wrap(`
  <line x1="30" y1="175" x2="170" y2="175" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="48" rx="12" ry="14" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 62 Q100 72 112 62 L108 98 Q100 104 92 98 Z" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M95 98 L92 140" stroke="${O}" stroke-width="1.8"/>
  <path d="M105 98 L108 140" stroke="${O}" stroke-width="1.8"/>
  <path d="M92 140 L88 172" stroke="${O}" stroke-width="1.8"/>
  <path d="M108 140 L118 168" stroke="${O}" stroke-width="1.8" opacity="0.35"/>
  <ellipse cx="96" cy="115" rx="8" ry="14" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.8"/>
  `),

  e195j: wrap(`
  <line x1="30" y1="155" x2="170" y2="155" stroke="${F}" stroke-width="2"/>
  <ellipse cx="115" cy="105" rx="42" ry="14" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="75" cy="88" r="10" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M68 98 L65 125" stroke="${O}" stroke-width="1.6"/>
  <path d="M82 98 L95 108 L108 95" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M95 108 L100 125" stroke="${O}" stroke-width="1.6"/>
  <path d="M100 125 L115 118" stroke="${O}" stroke-width="1.8"/>
  <path d="M55 95 Q70 85 85 95" stroke="${B}" stroke-width="2"/>
  <ellipse cx="92" cy="102" rx="10" ry="8" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  `),

  e195k: wrap(`
  <line x1="30" y1="155" x2="170" y2="155" stroke="${F}" stroke-width="2"/>
  <ellipse cx="110" cy="108" rx="40" ry="12" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="72" cy="90" r="10" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M65 100 L62 128" stroke="${O}" stroke-width="1.6"/>
  <path d="M78 100 L85 125" stroke="${O}" stroke-width="1.6"/>
  <path d="M85 125 L105 95" stroke="${O}" stroke-width="1.8"/>
  <path d="M105 95 L125 75" stroke="${O}" stroke-width="1.8"/>
  <path d="M100 118 Q115 112 125 118" stroke="${B}" stroke-width="2"/>
  <ellipse cx="108" cy="100" rx="12" ry="8" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  `),

  e195l: wrap(`
  <line x1="20" y1="175" x2="180" y2="175" stroke="${F}" stroke-width="2"/>
  <path d="M70 130 Q100 125 130 130" stroke="${B}" stroke-width="2.5" fill="none"/>
  <ellipse cx="100" cy="50" rx="12" ry="14" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 64 Q100 74 112 64 L108 100 Q100 106 92 100 Z" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M92 100 L85 135 M108 100 L115 135" stroke="${O}" stroke-width="1.8"/>
  <path d="M85 135 L78 172 M115 135 L122 168" stroke="${O}" stroke-width="1.8"/>
  <ellipse cx="88" cy="118" rx="8" ry="10" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  <ellipse cx="112" cy="118" rx="8" ry="10" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195m: wrap(`
  <line x1="25" y1="155" x2="175" y2="155" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="95" rx="36" ry="10" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="100" cy="58" r="11" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 70 L85 95 M112 70 L115 95" stroke="${O}" stroke-width="1.6"/>
  <path d="M85 95 L78 118" stroke="${O}" stroke-width="1.8"/>
  <path d="M115 95 L125 75 L135 95" stroke="${O}" stroke-width="1.8"/>
  <path d="M78 118 L72 145" stroke="${O}" stroke-width="1.8"/>
  <path d="M100 88 Q115 78 125 88" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  `),

  e195n: wrap(`
  <line x1="30" y1="175" x2="170" y2="175" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="50" rx="12" ry="14" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 64 L85 105 M112 64 L115 105" stroke="${O}" stroke-width="1.6"/>
  <path d="M85 105 L82 140 M115 105 L118 140" stroke="${O}" stroke-width="1.6"/>
  <path d="M70 82 L45 85" stroke="${B}" stroke-width="2.5"/>
  <path d="M70 82 L95 78" stroke="${O}" stroke-width="1.8"/>
  <path d="M95 78 L115 72" stroke="${O}" stroke-width="1.8"/>
  <ellipse cx="78" cy="78" rx="8" ry="10" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  `),

  e195o: wrap(`
  <rect x="40" y="115" width="120" height="10" rx="2" fill="${EQ}" stroke="${O}" stroke-width="1"/>
  <ellipse cx="100" cy="95" rx="50" ry="14" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="75" cy="78" r="9" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M65 88 L55 55" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M85 88 L100 50" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M95 88 L115 70" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <ellipse cx="72" cy="82" rx="8" ry="6" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  <ellipse cx="98" cy="78" rx="8" ry="6" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195p: wrap(`
  <line x1="25" y1="145" x2="175" y2="145" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="95" rx="55" ry="10" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="55" cy="105" r="8" fill="${SK}" stroke="${O}" stroke-width="1.4"/>
  <circle cx="145" cy="105" r="8" fill="${SK}" stroke="${O}" stroke-width="1.4"/>
  <path d="M55 105 L100 88 L145 105" stroke="${O}" stroke-width="1.6"/>
  <path d="M70 88 L75 75 M130 88 L125 75" stroke="${O}" stroke-width="1.6"/>
  <ellipse cx="100" cy="82" rx="18" ry="6" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195q: wrap(`
  <rect x="85" y="95" width="70" height="8" rx="2" fill="${EQ}" stroke="${O}" stroke-width="1"/>
  <line x1="30" y1="175" x2="170" y2="175" stroke="${F}" stroke-width="2"/>
  <circle cx="70" cy="70" r="10" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M62 82 L58 105" stroke="${O}" stroke-width="1.6"/>
  <path d="M78 82 L82 103" stroke="${O}" stroke-width="1.6"/>
  <path d="M82 103 L95 103 L100 130" stroke="${O}" stroke-width="1.8"/>
  <path d="M58 105 L55 140" stroke="${O}" stroke-width="1.8"/>
  <ellipse cx="88" cy="108" rx="8" ry="14" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  `),

  e195r: wrap(`
  <line x1="30" y1="50" x2="30" y2="175" stroke="${W}" stroke-width="4"/>
  <line x1="30" y1="175" x2="170" y2="175" stroke="${F}" stroke-width="2"/>
  <ellipse cx="75" cy="55" rx="10" ry="12" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M68 68 Q75 78 82 68 L80 100 Q75 106 70 100 Z" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M70 100 L68 140" stroke="${O}" stroke-width="1.8"/>
  <path d="M80 100 L82 140" stroke="${O}" stroke-width="1.8"/>
  <path d="M68 140 L65 172 M82 140 L85 172" stroke="${O}" stroke-width="1.8"/>
  <ellipse cx="76" cy="125" rx="6" ry="12" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.9"/>
  `),

  e195s: wrap(`
  <line x1="25" y1="155" x2="175" y2="155" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="110" rx="50" ry="12" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="85" cy="75" r="10" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M78 86 L72 105 L55 95" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M92 86 L98 105 L125 88" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M98 105 L102 130" stroke="${O}" stroke-width="1.8"/>
  <path d="M72 105 L68 128" stroke="${O}" stroke-width="1.8"/>
  <ellipse cx="100" cy="98" rx="14" ry="8" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195t: wrap(`
  <line x1="25" y1="155" x2="175" y2="155" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="105" rx="42" ry="12" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="100" cy="65" r="11" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M75 78 L65 55" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M125 78 L135 55" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M88 78 L85 105 M112 78 L115 105" stroke="${O}" stroke-width="1.6"/>
  <path d="M85 105 L78 128" stroke="${O}" stroke-width="1.8"/>
  <path d="M115 105 L122 128" stroke="${O}" stroke-width="1.8"/>
  <ellipse cx="100" cy="92" rx="16" ry="8" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195u: wrap(`
  <line x1="30" y1="175" x2="170" y2="175" stroke="${F}" stroke-width="2"/>
  <line x1="155" y1="60" x2="155" y2="120" stroke="${B}" stroke-width="2"/>
  <ellipse cx="100" cy="50" rx="12" ry="14" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M88 64 Q100 74 112 64 L108 100 Q100 106 92 100 Z" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M92 100 L88 140 M108 100 L112 140" stroke="${O}" stroke-width="1.8"/>
  <path d="M88 140 L85 172 M112 140 L115 172" stroke="${O}" stroke-width="1.8"/>
  <path d="M108 78 L145 75" stroke="${O}" stroke-width="1.8"/>
  <path d="M75 78 L108 78" stroke="${B}" stroke-width="2"/>
  <ellipse cx="100" cy="88" rx="14" ry="10" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.85"/>
  `),

  e195v: wrap(`
  <line x1="25" y1="155" x2="175" y2="155" stroke="${F}" stroke-width="2"/>
  <ellipse cx="100" cy="105" rx="48" ry="12" fill="${SKS}" stroke="${EQ}" stroke-width="1"/>
  <circle cx="75" cy="82" r="9" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <circle cx="125" cy="82" r="9" fill="${SK}" stroke="${O}" stroke-width="1.6"/>
  <path d="M70 92 Q100 75 130 92" stroke="${O}" stroke-width="1.8" fill="none"/>
  <path d="M75 92 L72 115 M125 92 L128 115" stroke="${O}" stroke-width="1.6"/>
  <path d="M72 115 L68 140 M128 115 L132 140" stroke="${O}" stroke-width="1.6"/>
  <path d="M85 88 Q100 72 115 88" fill="${MU}" stroke="${MUS}" stroke-width="1.2" opacity="0.7"/>
  `),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [id, svg] of Object.entries(SKETCHES)) {
  writeFileSync(join(OUT_DIR, `${id}.svg`), svg, "utf8");
}
console.log(`Wrote ${Object.keys(SKETCHES).length} rehab illustrations to ${OUT_DIR}`);
