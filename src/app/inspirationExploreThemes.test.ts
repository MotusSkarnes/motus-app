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

  it("plasserer SUB45 under lÃ¸ping selv om planen nevner restitusjon", () => {
    const sub45 = programItem({
      id: "sub45",
      kind: "periodPlan",
      title: "SUB45 Â· 10 km pÃ¥ under 45 min",
      description: "12 uker for erfarne lÃ¸pere med intervaller, styrke og taper.",
      body: "Planen har rolige lÃ¸p, tempo, aktiv restitusjon og SUB45 Â· Mobilitet lÃ¸per mellom harde dager.",
    });

    expect(resolvePrimaryTopNavTheme(sub45)).toBe("running");
    expect(filterItemsForInspoTheme([sub45], "running").map((item) => item.id)).toEqual(["sub45"]);
    expect(filterItemsForInspoTheme([sub45], "recovery")).toHaveLength(0);
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

  it("lar PT velge tema manuelt for artikler", () => {
    const article = {
      id: "article-running",
      category: "tips" as const,
      kind: "article",
      title: "Slik bygger du en god løpevane",
      description: "Kort råd til nye løpere.",
      tag: "tips",
      topNavTheme: "running" as const,
    };

    expect(resolvePrimaryTopNavTheme(article)).toBe("running");
    expect(filterItemsForInspoTheme([article], "running").map((item) => item.id)).toEqual(["article-running"]);
    expect(filterItemsForInspoTheme([article], "motivation")).toHaveLength(0);
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
