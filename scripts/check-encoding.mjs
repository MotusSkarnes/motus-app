import { execSync } from "child_process";
import fs from "fs";

const path = process.argv[2];
let text;
if (path.startsWith("git:")) {
  text = execSync(`git show ${path.slice(4)}:src/features/MemberPortal.tsx`).toString("utf8");
} else {
  text = fs.readFileSync(path, "utf8");
}

let control = 0;
for (const ch of text) {
  const cp = ch.codePointAt(0);
  if (cp !== undefined && (cp < 9 || (cp > 13 && cp < 32))) control += 1;
}
const moj = (text.match(/Ã.|â€.|Â./g) ?? []).length;
const brokenEmoji = (text.match(/ðŸ/g) ?? []).length;
console.log({
  control,
  mojibake: moj,
  brokenEmoji,
  slatt: text.includes("slått på"),
  settX: text.includes("sett ×"),
  fodselsdato: text.includes("Fødselsdato"),
  party: text.includes("🥳"),
});
