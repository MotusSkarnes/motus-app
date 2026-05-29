import { describe, expect, it } from "vitest";
import { buildExploreOverviewLayout } from "./inspirationExploreThemes";

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
