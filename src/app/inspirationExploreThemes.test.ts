import { describe, expect, it } from "vitest";
import {
  buildExploreOverviewLayout,
  filterItemsForInspoTheme,
  resolvePrimaryTopNavTheme,
} from "./inspirationExploreThemes";
import type { InspoHubItem } from "./inspirationExploreThemes";

function programItem(partial: Partial<InspoHubItem> & Pick<InspoHubItem, "id" | "title">): InspoHubItem {
  return {
    category: "programs",
    kind: "program",
    description: "",
    tag: "",
    ...partial,
  };
}

describe("buildExploreOverviewLayout", () => {
  it("viser hvert innlegg bare én gang på oversikten", () => {
    const items = [
      { id: "featured", category: "tips" as const, kind: "article", title: "A", description: "", tag: "" },
      { id: "n1", category: "news" as const, kind: "article", title: "N1", description: "", tag: "" },
      { id: "n2", category: "news" as const, kind: "article", title: "N2", description: "", tag: "" },
      { id: "n3", category: "news" as const, kind: "article", title: "N3", description: "", tag: "" },
      { id: "n4", category: "news" as const, kind: "article", title: "N4", description: "", tag: "" },
      { id: "p1", category: "programs" as const, kind: "program", title: "P1", description: "", tag: "" },
      { id: "t1", category: "tips" as const, kind: "article", title: "T1", description: "", tag: "" },
      { id: "nut1", category: "nutrition" as const, kind: "article", title: "K1", description: "", tag: "" },
    ];

    const layout = buildExploreOverviewLayout(items, new Set(["featured"]));
    const ids = [
      ...layout.newsItems.map((item) => item.id),
      ...layout.inspireTiles.map((tile) => tile.item.id),
      ...layout.gridTiles.map((tile) => tile.item.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
    expect(layout.newsItems.map((item) => item.id)).toEqual(["n1", "n2", "n3"]);
    expect(ids).not.toContain("featured");
    expect(ids).not.toContain("n4");
  });
});

describe("resolvePrimaryTopNavTheme", () => {
  it("plasserer løpeplaner kun under løping, ikke styrke", () => {
    const sub60 = programItem({
      id: "sub60",
      kind: "periodPlan",
      title: "SUB60 · 10 km på under 60 min",
      description: "12 uker med løp, intervaller, styrke og mobilitet",
    });

    expect(resolvePrimaryTopNavTheme(sub60)).toBe("running");
    expect(filterItemsForInspoTheme([sub60], "running").map((item) => item.id)).toEqual(["sub60"]);
    expect(filterItemsForInspoTheme([sub60], "strength")).toHaveLength(0);
  });

  it("plasserer generelle styrkeprogram under styrke", () => {
    const fullkropp = programItem({
      id: "fullkropp",
      title: "Fullkropp 30 minutter",
      description: "Kort økt for travle dager",
    });

    expect(resolvePrimaryTopNavTheme(fullkropp)).toBe("strength");
    expect(filterItemsForInspoTheme([fullkropp], "strength").map((item) => item.id)).toEqual(["fullkropp"]);
  });

  it("plasserer ikke alle tips under restitusjon", () => {
    const tip = { id: "tip", category: "tips" as const, kind: "article", title: "Vaner", description: "", tag: "" };
    const recoveryNutrition = {
      id: "nut",
      category: "nutrition" as const,
      kind: "article",
      title: "Protein etter trening",
      description: "Hvorfor og hvor mye du bør spise for restitusjon.",
      tag: "",
    };

    expect(resolvePrimaryTopNavTheme(tip)).toBe("motivation");
    expect(resolvePrimaryTopNavTheme(recoveryNutrition)).toBe("nutrition");
    expect(filterItemsForInspoTheme([tip, recoveryNutrition], "recovery").map((item) => item.id)).toEqual(["nut"]);
    expect(filterItemsForInspoTheme([tip, recoveryNutrition], "motivation").map((item) => item.id)).toEqual(["tip"]);
  });
});
