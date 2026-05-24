import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function readSource(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("source encoding", () => {
  it("keeps critical member and trainer UI sources free of replacement characters", () => {
    const criticalSources = [
      "src/features/MemberHomeOverview.tsx",
      "src/features/TrainerPortal.tsx",
    ];

    for (const sourcePath of criticalSources) {
      expect(readSource(sourcePath), sourcePath).not.toContain("\uFFFD");
    }
  });

  it("preserves Norwegian labels used in member home and trainer program flows", () => {
    expect(readSource("src/features/MemberHomeOverview.tsx")).toContain("Åpne profil");

    const trainerPortal = readSource("src/features/TrainerPortal.tsx");
    expect(trainerPortal).toContain('targetHrPercent: "65–75"');
    expect(trainerPortal).toContain('<div class="section-title">Øvelser</div>');
  });
});
