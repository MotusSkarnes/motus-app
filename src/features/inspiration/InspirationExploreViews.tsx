import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Flame, LayoutGrid, Quote } from "lucide-react";
import {
  buildExploreBentoTiles,
  filterItemsForInspoTheme,
  getInspoThemeById,
  INSPO_TOP_NAV_THEMES,
  type BentoTile,
  type BentoTileSize,
  type InspoHubItem,
  type InspoThemeId,
} from "../../app/inspirationExploreThemes";
import { OutlineButton } from "../../app/ui";

const THEME_PAGE_SIZE_PATTERN: readonly BentoTileSize[] = ["hero", "compact", "medium", "tall", "compact", "wide"];

function themePageSizeForIndex(index: number, item: InspoHubItem): BentoTileSize {
  if (item.category === "news") return index === 0 ? "wide" : "compact";
  if (item.kind === "program" || item.kind === "periodPlan") return index === 0 ? "hero" : "medium";
  return THEME_PAGE_SIZE_PATTERN[index % THEME_PAGE_SIZE_PATTERN.length] ?? "compact";
}

type InspirationExploreThemePageProps = {
  themeId: InspoThemeId;
  items: InspoHubItem[];
  onBack: () => void;
  renderNewsCard: (item: InspoHubItem, index: number, total: number, variant?: "lead" | "side") => ReactNode;
  renderMediaCard: (item: InspoHubItem, index: number, total: number, bentoSize?: BentoTileSize) => ReactNode;
};

export function InspirationExploreThemePage({
  themeId,
  items,
  onBack,
  renderNewsCard,
  renderMediaCard,
}: InspirationExploreThemePageProps) {
  const theme = getInspoThemeById(themeId);
  const filtered = filterItemsForInspoTheme(items, themeId);

  return (
    <div className="motus-inspo-theme-page space-y-4">
      <button type="button" onClick={onBack} className="motus-inspo-back-link">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Tilbake til Utforsk
      </button>
      <header className="motus-inspo-theme-header">
        {theme ? (
          <>
            <p className="motus-inspo-theme-kicker">Tema</p>
            <h2 className="motus-inspo-theme-title">{theme.label}</h2>
            <p className="motus-inspo-theme-desc">{theme.description}</p>
          </>
        ) : (
          <h2 className="motus-inspo-theme-title">Utforsk</h2>
        )}
        <p className="motus-inspo-theme-count">
          {filtered.length} {filtered.length === 1 ? "innlegg" : "innlegg"}
        </p>
      </header>
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
          Ingen innlegg i dette temaet ennå.
        </p>
      ) : (
        <div className="motus-inspo-theme-grid">
          {filtered.map((item, index) => {
            const size = themePageSizeForIndex(index, item);
            return (
              <div
                key={item.id}
                className={`motus-inspo-theme-grid-item motus-inspo-theme-grid-item--${size} ${
                  item.category === "news" ? "motus-inspo-theme-grid-item--news" : ""
                }`}
              >
                {item.category === "news"
                  ? renderNewsCard(item, index, filtered.length, index === 0 ? "lead" : "side")
                  : renderMediaCard(item, index, filtered.length, size)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type InspirationExploreBentoOverviewProps = {
  items: InspoHubItem[];
  excludeIds?: Set<string>;
  renderNewsCard: (item: InspoHubItem, index: number, total: number, variant?: "lead" | "side") => ReactNode;
  renderMediaCard: (item: InspoHubItem, index: number, total: number, bentoSize?: BentoTileSize) => ReactNode;
  onOpenTheme: (themeId: InspoThemeId) => void;
};

export function InspirationExploreBentoOverview({
  items,
  excludeIds,
  renderNewsCard,
  renderMediaCard,
  onOpenTheme,
}: InspirationExploreBentoOverviewProps) {
  const newsItems = items.filter((item) => item.category === "news" && !excludeIds?.has(item.id));
  const bentoTiles = buildExploreBentoTiles(items, excludeIds);
  const inspireTiles = bentoTiles.filter((tile) => tile.size === "tall" || tile.size === "wide").slice(0, 2);
  const inspireIds = new Set(inspireTiles.map((tile) => tile.item.id));
  const gridTiles = bentoTiles.filter((tile) => !inspireIds.has(tile.item.id));

  return (
    <div className="motus-inspo-bento-overview space-y-8">
      {newsItems.length > 0 ? (
        <section className="motus-inspo-section">
          <div className="motus-inspo-section-head">
            <h2 className="motus-inspo-section-title">Nytt fra Motus</h2>
            <button type="button" onClick={() => onOpenTheme("news")} className="motus-inspo-section-link">
              Se alle
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="motus-inspo-news-showcase">
            {newsItems.slice(0, 3).map((item, index) => (
              <div
                key={item.id}
                className={`motus-inspo-news-showcase-item ${index === 0 ? "is-lead" : "is-side"}`}
              >
                {renderNewsCard(item, index, Math.min(newsItems.length, 3), index === 0 ? "lead" : "side")}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="motus-inspo-section">
        <div className="motus-inspo-section-head">
          <h2 className="motus-inspo-section-title">Inspirasjon</h2>
        </div>
        <div className="motus-inspo-inspire-split">
          <article className="motus-inspo-quote motus-inspo-quote--bento">
            <Quote className="motus-inspo-quote-mark" aria-hidden />
            <div className="motus-inspo-quote-body">
              <div className="motus-inspo-quote-title">Du er sterkere enn du tror.</div>
              <div className="motus-inspo-quote-sub">Fortsett å bygge de gode vanene.</div>
            </div>
            <Flame className="motus-inspo-quote-flame" aria-hidden />
          </article>
          <div className="motus-inspo-inspire-stack">
            {inspireTiles.length > 0 ? (
              inspireTiles.map((tile, index) => (
                <div key={tile.item.id} className={`motus-inspo-inspire-stack-card is-${tile.size}`}>
                  {tile.item.category === "news"
                    ? renderNewsCard(tile.item, index, inspireTiles.length, index === 0 ? "lead" : "side")
                    : renderMediaCard(tile.item, index, inspireTiles.length, tile.size)}
                </div>
              ))
            ) : (
              gridTiles.slice(0, 2).map((tile, index) => (
                <div key={tile.item.id} className={`motus-inspo-inspire-stack-card is-${tile.size}`}>
                  {renderMediaCard(tile.item, index, 2, index === 0 ? "tall" : "compact")}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {gridTiles.length > 0 ? (
        <section className="motus-inspo-section">
          <div className="motus-inspo-section-head">
            <h2 className="motus-inspo-section-title">Utforsk mer</h2>
            <button type="button" onClick={() => onOpenTheme("all")} className="motus-inspo-section-link">
              Se alt
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="motus-inspo-bento-grid">
            {gridTiles.map((tile, index) => (
              <BentoTileCell
                key={tile.item.id}
                tile={tile}
                index={index}
                renderNewsCard={renderNewsCard}
                renderMediaCard={renderMediaCard}
                total={gridTiles.length}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="motus-inspo-community-banner">
        <div className="motus-inspo-community-banner-body">
          <p className="motus-inspo-community-kicker">Motus-fellesskapet</p>
          <h3 className="motus-inspo-community-title">Små steg i dag — stor forskjell i morgen</h3>
          <p className="motus-inspo-community-desc">
            Utforsk temaene over, eller snakk med treneren din når du vil ha noe tilpasset deg.
          </p>
        </div>
        <OutlineButton type="button" onClick={() => onOpenTheme("motivation")} className="motus-inspo-community-cta">
          Se motivasjon
        </OutlineButton>
      </section>
    </div>
  );
}

function BentoTileCell({
  tile,
  index,
  total,
  renderNewsCard,
  renderMediaCard,
}: {
  tile: BentoTile;
  index: number;
  total: number;
  renderNewsCard: (item: InspoHubItem, index: number, total: number, variant?: "lead" | "side") => ReactNode;
  renderMediaCard: (item: InspoHubItem, index: number, total: number, bentoSize?: BentoTileSize) => ReactNode;
}) {
  const sizeClass = `motus-inspo-bento-item--${tile.size}`;

  return (
    <div className={`motus-inspo-bento-item ${sizeClass}`}>
      {tile.item.category === "news"
        ? renderNewsCard(tile.item, index, total, tile.size === "wide" ? "lead" : "side")
        : renderMediaCard(tile.item, index, total, tile.size)}
    </div>
  );
}

export function InspirationExploreTopNav({
  activeThemeId,
  onSelectTheme,
}: {
  activeThemeId: InspoThemeId | null;
  onSelectTheme: (themeId: InspoThemeId) => void;
}) {
  return (
    <nav className="motus-inspo-topic-nav" aria-label="Utforsk temaer">
      <div className="motus-inspo-topic-nav-row">
        {INSPO_TOP_NAV_THEMES.map((theme) => {
          const Icon = theme.icon;
          const isActive = activeThemeId === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelectTheme(theme.id)}
              className={`motus-inspo-topic-tile motus-pressable ${isActive ? "is-active" : ""}`}
            >
              <span className={`motus-inspo-topic-icon motus-inspo-topic-icon--${theme.tone}`} aria-hidden>
                <Icon className="motus-inspo-topic-icon-glyph" strokeWidth={2.25} />
              </span>
              <span className="motus-inspo-topic-label">{theme.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onSelectTheme("all")}
          className={`motus-inspo-topic-tile motus-pressable ${activeThemeId === "all" ? "is-active" : ""}`}
        >
          <span className="motus-inspo-topic-icon motus-inspo-topic-icon--all" aria-hidden>
            <LayoutGrid className="motus-inspo-topic-icon-glyph" strokeWidth={2.25} />
          </span>
          <span className="motus-inspo-topic-label">Se alle</span>
        </button>
      </div>
    </nav>
  );
}
