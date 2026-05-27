/** Standard oppskrifter i Utforsk — delt mellom hub, matplan og makroberegning. */
export type DefaultInspirationRecipe = {
  id: string;
  title: string;
  description: string;
  body: string;
  tag: string;
  createdAt: string;
};

export const DEFAULT_INSPIRATION_RECIPES: DefaultInspirationRecipe[] = [
  {
    id: "default-recipe-1",
    title: "Proteinrik frokostbolle",
    description: "Enkel frokost etter morgenøkt.",
    body: "**Til 1 porsjon · ca. 5 min**\n\n**Ingredienser**\n- 1 dl gresk yoghurt\n- 3 ss havregryn\n- 1 håndfull bær\n- 1 ss mandler\n- 1 ts honning\n- Kanel (valgfritt)\n\n**Slik gjør du**\n1. Bland yoghurt og havregryn i en bolle.\n2. Topp med bær, hakkede mandler og honning.\n3. Strø over kanel og la stå 5 minutter før servering.",
    tag: "5 min · Frokost",
    createdAt: "2026-05-01",
  },
  {
    id: "default-recipe-2",
    title: "Havregrøt med banan og peanøttsmør",
    description: "Mettende frokost som gir energi til lange dager.",
    body: "**Til 1 porsjon · ca. 10 min**\n\n**Ingredienser**\n- 1 dl havregryn\n- 2 dl melk eller havredrikk\n- 1 banan\n- 1 ss peanøttsmør (helst usaltet)\n- 1 ts kanel\n- Honning eller lønnesirup (valgfritt)\n\n**Slik gjør du**\n1. Kok havregryn og melk på middels varme i 3–4 minutter. Rør jevnt.\n2. Skjær bananen i skiver og legg halvparten i grøten, halvparten på toppen.\n3. Topp med peanøttsmør, kanel og litt søtning hvis du vil.\n\n**Tips:** Bytt peanøttsmør med mandelsmør eller cottage cheese for variasjon. Rør inn en scoop proteinpulver etter koking hvis du vil løfte proteininnholdet.",
    tag: "10 min · Frokost",
    createdAt: "2026-05-26",
  },
  {
    id: "default-recipe-3",
    title: "Eggerøre med grovbrød og avokado",
    description: "Rask, proteinrik frokost med mye smak.",
    body: "**Til 1 porsjon · ca. 10 min**\n\n**Ingredienser**\n- 3 egg\n- 1 ss smør\n- 1/2 avokado\n- 1–2 skiver grovbrød\n- Salt og pepper\n- Litt chiliflak eller frisk gressløk (valgfritt)\n\n**Slik gjør du**\n1. Pisk eggene lett sammen med en klype salt.\n2. Smelt smøret i en kald panne, hell over eggene og rør forsiktig på lav varme til de stivner men fortsatt er saftige.\n3. Risk brødet, mos avokadoen og smør på.\n4. Topp med eggerøren, mal litt pepper og strø over chili eller gressløk.\n\n**Tips:** Erstatt ett av eggene med 2 ekstra eggehviter hvis du vil senke fettinnholdet og holde proteinet høyt.",
    tag: "10 min · Frokost",
    createdAt: "2026-05-26",
  },
  {
    id: "default-recipe-4",
    title: "Kyllingwrap med hummus og grønnsaker",
    description: "Mettende lunsj du kan ta med på jobb eller etter trening.",
    body: "**Til 1 porsjon · ca. 15 min**\n\n**Ingredienser**\n- 1 stor fullkornstortilla\n- 120 g kyllingfilet\n- 2 ss hummus\n- 1 håndfull spinat eller ruccola\n- 1/2 paprika i strimler\n- 1/4 agurk i tynne skiver\n- Salt, pepper og litt paprikakrydder\n\n**Slik gjør du**\n1. Krydre kyllingen og stek den på middels varme ca. 4 minutter på hver side til den er gjennomstekt. La hvile noen minutter og skjær i strimler.\n2. Varm tortillaen kort i en tørr panne for å gjøre den mykere.\n3. Smør hummus over hele tortillaen. Legg på spinat, paprika, agurk og kyllingen.\n4. Brett inn endene og rull stramt sammen. Skjær på skrå.\n\n**Tips:** Lag dobbel porsjon kylling — da har du middag eller lunsj klar dagen etter også.",
    tag: "15 min · Lunsj",
    createdAt: "2026-05-26",
  },
  {
    id: "default-recipe-5",
    title: "Tunfisk- og bønnesalat",
    description: "Superrask lunsj som metter og holder energien stabil.",
    body: "**Til 1 porsjon · ca. 5 min**\n\n**Ingredienser**\n- 1 boks tunfisk i vann (ca. 120 g)\n- 1/2 boks hvite bønner (cannellini eller lima), avrent og skylt\n- 1 håndfull cherrytomater, halvert\n- 1/4 rødløk, finhakket\n- 2 ss olivenolje\n- Saft fra 1/2 sitron\n- Salt, pepper og frisk persille\n\n**Slik gjør du**\n1. Bland tunfisk, bønner, tomater og løk i en bolle.\n2. Visp sammen olivenolje, sitronsaft, salt og pepper. Hell over salaten og vend forsiktig.\n3. Strø over persille rett før servering.\n\n**Tips:** Server med en skive grovt knekkebrød eller et kokt egg hvis du trenger mer mat etter en hard økt.",
    tag: "5 min · Lunsj",
    createdAt: "2026-05-26",
  },
  {
    id: "default-recipe-6",
    title: "Bakt laks med søtpotetmos og brokkoli",
    description: "Klassisk restitusjons-middag med omega-3 og gode karbo.",
    body: "**Til 2 porsjoner · ca. 30 min**\n\n**Ingredienser**\n- 2 laksefileter (ca. 150 g per stk.)\n- 1 stor søtpotet\n- 1 lite brokkolihode\n- 1 ss olivenolje\n- 1 ss smør\n- Saft fra 1/2 sitron\n\n**Slik gjør du**\n1. Varm ovnen til 200 °C. Skrell og terne søtpoteten, kok i ca. 15 minutter til mør.\n2. Legg laksefiletene på et bakepapirkledd brett, pensle med olivenolje og krydre med salt, pepper og dill. Stek i 12–15 minutter.\n3. Damp eller kok brokkoli al dente (ca. 4–5 minutter).\n4. Mos søtpoteten med smør, salt og pepper. Skvis litt sitron over laksen før servering.\n\n**Tips:** Brokkoli kan også grilles raskt i pannen med hvitløk hvis du vil ha mer karakter.",
    tag: "30 min · Middag",
    createdAt: "2026-05-26",
  },
  {
    id: "default-recipe-7",
    title: "Bolognese med kjøttdeig og fullkornspasta",
    description: "Trofast hverdagsmiddag — mye protein og lett å meal-preppe.",
    body: "**Til 4 porsjoner · ca. 25 min**\n\n**Ingredienser**\n- 400 g kjøttdeig (5–10 % fett)\n- 1 løk, finhakket\n- 2 fedd hvitløk\n- 1 gulrot, finrevet\n- 1 boks hakkede tomater\n- 1 ss tomatpuré\n- 1 ts oregano\n- 1 ts paprikakrydder\n- Salt, pepper og litt sukker\n- 300 g fullkornspasta\n- 15 g revet parmesan\n\n**Slik gjør du**\n1. Stek løk, gulrot og hvitløk i litt olje i en stor panne i 2–3 minutter.\n2. Tilsett kjøttdeigen og stek til den er gjennomstekt og lett brun. Skill bort eventuell væske.\n3. Rør inn tomatpuré, hakkede tomater og krydder. La putre på lav varme i 10–15 minutter — gjerne lenger hvis du har tid.\n4. Kok pastaen al dente i godt saltet vann etter pakkens anvisning.\n5. Server pastaen med saus, parmesan og frisk basilikum på toppen.\n\n**Tips:** Lag dobbel porsjon saus og frys ned — perfekt for travle uker. Bytt kjøttdeig med kyllingdeig eller linser hvis du vil variere.",
    tag: "25 min · Middag",
    createdAt: "2026-05-26",
  },
];

export const DEFAULT_RECIPE_BODY_BY_ID = new Map(
  DEFAULT_INSPIRATION_RECIPES.map((recipe) => [recipe.id, recipe.body]),
);
