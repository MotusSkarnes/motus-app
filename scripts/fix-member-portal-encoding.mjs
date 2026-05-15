import { readFileSync, writeFileSync } from "fs";

const path = process.argv[2] ?? "src/features/MemberPortal.tsx";
let text = readFileSync(path, "utf8");

const replacements = [
  ["Ã¥", "å"],
  ["Ã¸", "ø"],
  ["Ã¦", "æ"],
  ["Ã…", "Å"],
  ["Ã˜", "Ø"],
  ["Ã†", "Æ"],
  ["Ã—", "×"],
  ["â€“", "–"],
  ["â€”", "—"],
  ["â€™", "'"],
  ["â€œ", '"'],
  ["â€\u009d", '"'],
  ["Â«", "«"],
  ["Â»", "»"],
  ["Â·", "·"],
  ["â€¦", "…"],
  ["âœ¨", "✨"],
  ["âœ…", "✅"],
  ["â†'", "→"],
  ["â†‘", "↑"],
  ["â†"", "↓"],
  ["FÃƒÂ¸dselsdato mÃƒÂ¥ vÃƒÂ¦re pÃƒÂ¥", "Fødselsdato må være på"],
  ["forsÃƒÂ¸kes", "forsøkes"],
  ["FÃƒ¸dselsdato mÃƒÂ¥ vÃƒÂ¦re pÃƒÂ¥", "Fødselsdato må være på"],
  ["forsÃƒ¸kes", "forsøkes"],
];

for (const [from, to] of replacements) {
  text = text.split(from).join(to);
}

const cp1252ToByte = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function decodeCp1252MojibakeToUtf8(value) {
  const bytes = [];
  for (let i = 0; i < value.length; i += 1) {
    let code = value.charCodeAt(i);
    if (code > 255) {
      code = cp1252ToByte[code] ?? code & 0xff;
    }
    bytes.push(code);
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

function fixQuotedString(match, inner) {
  if (!inner.includes("ð")) return match;
  return `"${decodeCp1252MojibakeToUtf8(inner)}"`;
}

text = text.replace(/"((?:\\.|[^"\\])*)"/g, fixQuotedString);

text = text.replace(/`((?:\\.|[^`\\]|\\$\{[^}]*\})*)`/g, (match, inner) => {
  if (!inner.includes("ð")) return match;
  const parts = inner.split(/(\$\{[^}]+\})/g);
  const fixed = parts
    .map((part) => (part.startsWith("${") ? part : part.includes("ð") ? decodeCp1252MojibakeToUtf8(part) : part))
    .join("");
  return `\`${fixed}\``;
});

text = text.replace(/="((?:\\.|[^"\\])*)"/g, (match, inner) => {
  if (!inner.includes("ð")) return match;
  return `="${decodeCp1252MojibakeToUtf8(inner)}"`;
});

text = text.replace(/\? "([^"]*ð[^"]*)"/g, (match, inner) => {
  return `? "${decodeCp1252MojibakeToUtf8(inner)}"`;
});

writeFileSync(path, text, "utf8");

let control = 0;
for (const ch of text) {
  const cp = ch.codePointAt(0);
  if (cp !== undefined && (cp < 9 || (cp > 13 && cp < 32))) control += 1;
}
const moj = (text.match(/Ã.|â€.|ðŸ/g) ?? []).length;
console.log({ control, mojibake: moj, slatt: text.includes("slått på"), settX: text.includes("sett ×"), party: text.includes("🥳") });
