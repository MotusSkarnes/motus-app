import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Flame, Quote } from "lucide-react";
import {
  buildExploreBentoTiles,
  filterItemsForInspoTheme,
  getInspoThemeById,
  INSPO_TOP_NAV_THEMES,
  type BentoTile,
  type InspoHubItem,
  type InspoThemeId,
} from "../../app/inspirationExploreThemes";
import { OutlineButton } from "../../app/ui";

type InspirationExploreThemePageProps = {
  themeId: InspoThemeId;
  items: InspoHubItem[];
  onBack: () => void;
  onOpenItem: (item: InspoHubItem) => void;
  renderNewsCard: (item: InspoHubItem, index: number, total: number) => ReactNode;
  renderMediaCard: (item: InspoHubItem, index: number, total: number, className?: string) => ReactNode;
};

export function InspirationExploreThemePage({
  themeId,
  items,
  onBack,
  onOpenItem,
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
          {filtered.map((item, index) => (
            <div
              key={item.id}
              className={`motus-inspo-theme-grid-item ${
                item.category === "news" ? "motus-inspo-theme-grid-item--news" : ""
              }`}
            >
              {item.category === "news"
                ? renderNewsCard(item, index, filtered.length)
                : renderMediaCard(item, index, filtered.length, "w-full max-w-none h-auto min-h-[18rem]")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type InspirationExploreBentoOverviewProps = {
  items: InspoHubItem[];
  excludeIds?: Set<string>;
  onOpenItem: (item: InspoHubItem) => void;
  renderNewsCard: (item: InspoHubItem, index: number, total: number) => ReactNode;
  renderMediaCard: (item: InspoHubItem, index: number, total: number, className?: string) => ReactNode;
  onOpenTheme: (themeId: InspoThemeId) => void;
};

export function InspirationExploreBentoOverview({
  items,
  excludeIds,
  onOpenItem,
  renderNewsCard,
  renderMediaCard,
  onOpenTheme,
}: InspirationExploreBentoOverviewProps) {
  const newsItems = items.filter((item) => item.category === "news" && !excludeIds?.has(item.id));
  const bentoTiles = buildExploreBentoTiles(items, excludeIds);

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
              <div key={item.id} className={index === 0 ? "motus-inspo-news-showcase-lead" : ""}>
                {renderNewsCard(item, index, Math.min(newsItems.length, 3))}
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
            {bentoTiles
              .filter((tile) => tile.size === "tall" || tile.size === "medium")
              .slice(0, 2)
              .map((tile, index) => (
                <div key={tile.item.id} className="motus-inspo-inspire-stack-card">
                  {tile.item.category === "news"
                    ? renderNewsCard(tile.item, index, 2)
                    : renderMediaCard(tile.item, index, 2, "w-full max-w-none h-[17.5rem]")}
                </div>
              ))}
          </div>
        </div>
      </section>

      {bentoTiles.length > 0 ? (
        <section className="motus-inspo-section">
          <div className="motus-inspo-section-head">
            <h2 className="motus-inspo-section-title">Utforsk mer</h2>
            <button type="button" onClick={() => onOpenTheme("all")} className="motus-inspo-section-link">
              Se alt
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="motus-inspo-bento-grid">
            {bentoTiles.map((tile, index) => (
              <BentoTileCell
                key={tile.item.id}
                tile={tile}
                index={index}
                renderNewsCard={renderNewsCard}
                renderMediaCard={renderMediaCard}
                total={bentoTiles.length}
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
  renderNewsCard: (item: InspoHubItem, index: number, total: number) => ReactNode;
  renderMediaCard: (item: InspoHubItem, index: number, total: number, className?: string) => ReactNode;
}) {
  const sizeClass = `motus-inspo-bento-item--${tile.size}`;
  const heightClass =
    tile.size === "hero"
      ? "h-[22rem] sm:h-[24rem]"
      : tile.size === "wide"
        ? "h-[14rem] sm:h-[16rem]"
        : tile.size === "tall"
          ? "h-[20rem]"
          : tile.size === "medium"
            ? "h-[18rem]"
            : "h-[16rem]";

  return (
    <div className={`motus-inspo-bento-item ${sizeClass}`}>
      {tile.item.category === "news"
        ? renderNewsCard(tile.item, index, total)
        : renderMediaCard(tile.item, index, total, `w-full max-w-none ${heightClass}`)}
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
    <section className="motus-inspo-quick-section">
      <div className="motus-inspo-quick-head">
        <h2 className="motus-inspo-quick-title">Hva vil du utforske?</h2>
      </div>
      <div className="motus-inspo-quick-grid motus-inspo-quick-grid--topics">
        {INSPO_TOP_NAV_THEMES.map((theme) => {
          const Icon = theme.icon;
          const isActive = activeThemeId === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelectTheme(theme.id)}
              className={`motus-inspo-quick-pill motus-inspo-quick-pill--${theme.tone} motus-pressable ${
                isActive ? "is-active" : ""
              }`}
            >
              <span className="motus-inspo-quick-pill-icon" aria-hidden>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="motus-inspo-quick-pill-label">{theme.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onSelectTheme("all")}
          className={`motus-inspo-quick-pill motus-inspo-quick-pill--all motus-pressable ${
            activeThemeId === "all" ? "is-active" : ""
          }`}
        >
          <span className="motus-inspo-quick-pill-icon" aria-hidden>
            <ArrowRight className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="motus-inspo-quick-pill-label">Se alle</span>
        </button>
      </div>
    </section>
  );
}
