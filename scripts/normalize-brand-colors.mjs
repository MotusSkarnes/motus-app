import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");

const replacements = [
  [/linear-gradient\(135deg,\s*\$\{MOTUS\.turquoise\}\s*0%,\s*\$\{MOTUS\.pink\}\s*100%\)/g, "${MOTUS.gradient}"],
  [/linear-gradient\(135deg,\s*\$\{MOTUS\.turquoise\},\s*\$\{MOTUS\.pink\}\)/g, "${MOTUS.gradient}"],
  [
    /const MOTUS_GRADIENT = `linear-gradient\(135deg, \$\{MOTUS\.turquoise\} 0%, \$\{MOTUS\.pink\} 100%\)`;/g,
    "const MOTUS_GRADIENT = MOTUS.gradient;",
  ],
  [
    /const MOTUS_GRADIENT_90 = `linear-gradient\(90deg, \$\{MOTUS\.turquoise\} 0%, \$\{MOTUS\.pink\} 100%\)`;/g,
    "const MOTUS_GRADIENT_90 = MOTUS.gradient;",
  ],
  [/rgba\(236,\s*72,\s*153/g, "rgba(217, 18, 120"],
  [/#0d9488/gi, "#30E3BE"],
  [/#0f766e/gi, "#30E3BE"],
  [/#0e8068/gi, "#30E3BE"],
  [/#c4106a/gi, "#D91278"],
  [/#5cdfc6/gi, "#30E3BE"],
  [/#8de8d4/gi, "#30E3BE"],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(root)) {
  const original = fs.readFileSync(file, "utf8");
  let next = original;
  for (const [pattern, value] of replacements) {
    next = next.replace(pattern, value);
  }
  if (next !== original) {
    fs.writeFileSync(file, next, "utf8");
    changed += 1;
    console.log("updated", path.relative(process.cwd(), file));
  }
}

console.log(`Done. ${changed} files updated.`);
