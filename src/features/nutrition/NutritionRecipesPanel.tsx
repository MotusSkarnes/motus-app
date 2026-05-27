import { useMemo, useState } from "react";
import { ArrowLeft, Soup } from "lucide-react";
import { computeRecipeMacros } from "../../app/recipeMacros";
import { useInspirationRecipeItems, type InspirationRecipeItem } from "../../app/inspirationRecipeItems";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { RecipeMacroBlocks } from "../../components/RecipeMacroBlocks";
import { Card, EmptyState, OutlineButton } from "../../app/ui";

function RecipeDetail({ item, onBack }: { item: InspirationRecipeItem; onBack: () => void }) {
  const foodItems = useFoodBankItems();
  const macros = useMemo(() => computeRecipeMacros(item.body, foodItems), [item.body, foodItems]);

  return (
    <div className="space-y-4">
      <OutlineButton type="button" onClick={onBack} className="text-sm">
        <ArrowLeft className="mr-1.5 inline h-4 w-4" aria-hidden />
        Tilbake til oppskrifter
      </OutlineButton>
      <article className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        {item.imageUrl ? (
          <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          </div>
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center bg-teal-50">
            <Soup className="h-14 w-14 text-teal-600/60" aria-hidden />
          </div>
        )}
        <div className="p-4 sm:p-5">
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-100">
            {item.tag}
          </span>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{item.title}</h2>
          {item.description ? <p className="mt-2 text-sm text-slate-600 sm:text-base">{item.description}</p> : null}
          {macros ? (
            <div className="mt-4">
              <RecipeMacroBlocks result={macros} />
            </div>
          ) : null}
          {item.body.trim() ? (
            <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 sm:text-base">{item.body}</div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export function NutritionRecipesPanel() {
  const { items, loading } = useInspirationRecipeItems();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  if (loading) {
    return <Card className="p-6 text-center text-sm text-slate-600">Laster oppskrifter …</Card>;
  }

  if (selected) {
    return <RecipeDetail item={selected} onBack={() => setSelectedId(null)} />;
  }

  if (!items.length) {
    return (
      <EmptyState
        icon="🥗"
        title="Ingen oppskrifter ennå"
        description="Oppskrifter fra Utforsk vises her når PT har lagt dem ut."
        className="bg-white"
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Oppskrifter fra Motus med næringsinfo per porsjon der ingrediensene finnes i matvarebanken.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:border-teal-200 hover:shadow-md"
              style={{ borderColor: "rgba(15,23,42,0.08)" }}
            >
              {item.imageUrl ? (
                <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                </div>
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-teal-50 to-white">
                  <Soup className="h-10 w-10 text-teal-600/50" aria-hidden />
                </div>
              )}
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">{item.tag}</span>
                <span className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</span>
                {item.description ? (
                  <span className="mt-1 line-clamp-2 text-xs text-slate-500 sm:text-sm">{item.description}</span>
                ) : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
