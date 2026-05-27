/** Standard oppskrifter under Ernæring — delt mellom matplan og makroberegning. */
export type DefaultInspirationRecipe = {
  id: string;
  title: string;
  description: string;
  body: string;
  tag: string;
  createdAt: string;
  /** flexible = mengder kan skaleres mot kundens måltids-kcal; fixed = behold oppskriftens balanse. */
  scalingMode?: "flexible" | "fixed";
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
    scalingMode: "fixed",
    createdAt: "2026-05-26",
  },
  {
    id: "default-recipe-8",
    title: "Brødskive med smør, ost og skinke",
    description: "Klassisk norsk lunsj — raskt, mettende og lett å variere.",
    body: "**Til 1 porsjon · ca. 3 min**\n\n**Ingredienser**\n- 1 skive grovt brød\n- 1 ts smør\n- 30 g norvegia lett\n- 30 g skinke\n- 50 g agurk\n- 40 g tomat\n- 1 håndfull salat mix\n\n**Slik gjør du**\n1. Smør brødskiven.\n2. Legg på ost og skinke.\n3. Topp med tynne skiver agurk og tomat, og litt salat.\n\n**Tips:** Bytt skinke med kalkunkjøtt for mindre salt, eller dropp smøret hvis du vil spare fett.",
    tag: "3 min · Lunsj",
    scalingMode: "fixed",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-9",
    title: "Rugbrød med leverpostei og agurk",
    description: "Enkel frokost eller kveldsmat mange kjenner fra barndommen.",
    body: "**Til 1 porsjon · ca. 3 min**\n\n**Ingredienser**\n- 1 skive rugbrød\n- 20 g leverpostei\n- 50 g agurk\n- 1 tomat\n\n**Slik gjør du**\n1. Bre leverpostei på rugbrødet.\n2. Legg på tynne agurkskiver og tomat i skiver.\n3. Krydre med litt pepper om du vil.\n\n**Tips:** Tilsett en hardkokt egg for mer protein.",
    tag: "3 min · Frokost",
    scalingMode: "fixed",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-10",
    title: "Riskaker med cottage cheese og tomat",
    description: "Lett lunsj når du vil ha noe raskt uten brød.",
    body: "**Til 1 porsjon · ca. 2 min**\n\n**Ingredienser**\n- 4 stk riskaker\n- 100 g cottage cheese\n- 1 tomat\n- Salt og pepper\n\n**Slik gjør du**\n1. Bre cottage cheese på riskakene.\n2. Topp med tomat i skiver og litt salt og pepper.\n\n**Tips:** Bytt cottage cheese med skyr naturell for en lettere variant.",
    tag: "2 min · Lunsj",
    scalingMode: "fixed",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-11",
    title: "Kokt egg med grovbrød",
    description: "Proteinrik frokost eller lunsj på få minutter.",
    body: "**Til 1 porsjon · ca. 8 min**\n\n**Ingredienser**\n- 2 egg\n- 1 skive grovt brød\n- 1 ts smør\n- Salt og pepper\n\n**Slik gjør du**\n1. Kok eggene i 7–8 minutter for mykt kokt, eller 10 minutter for hardkokt.\n2. Skrell og skjær i skiver. Krydre med salt og pepper.\n3. Server med ristet grovbrød og smør.\n\n**Tips:** Kok flere egg samtidig — da har du protein klart flere dager.",
    tag: "8 min · Frokost",
    scalingMode: "fixed",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-12",
    title: "Skyr med müsli og bær",
    description: "Rask frokostbowl med protein og fiber.",
    body: "**Til 1 porsjon · ca. 2 min**\n\n**Ingredienser**\n- 200 g skyr naturell\n- 50 g müsli\n- 1 håndfull blåbær\n\n**Slik gjør du**\n1. Ha skyr i en bolle.\n2. Topp med müsli og blåbær.\n3. Rør sammen eller spis lagvis.\n\n**Tips:** Tilsett 1 ts honning eller litt nøtter hvis du trenger mer energi før trening.",
    tag: "2 min · Frokost",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-13",
    title: "Kyllingfilet med ris og grønnsaker",
    description: "Enkel hverdagsmiddag — protein, karbo og fiber på ett fat.",
    body: "**Til 1 porsjon · ca. 20 min**\n\n**Ingredienser**\n- 150 g kyllingbryst\n- 60 g basmatiris tørr\n- 150 g brokkoli\n- 50 g paprika\n- 1 ss olivenolje\n- Salt og pepper\n\n**Slik gjør du**\n1. Kok risen etter pakkens anvisning.\n2. Krydre kyllingen med salt og pepper. Stek i olivenolje på middels varme til den er gjennomstekt, ca. 5–6 minutter per side.\n3. Damp eller wok brokkoli og paprika i 3–4 minutter.\n4. Server kylling, ris og grønnsaker sammen.\n\n**Tips:** Bytt brokkoli med asparges eller squash etter sesong.",
    tag: "20 min · Middag",
    scalingMode: "flexible",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-14",
    title: "Tacogryte med mager kjøttdeig og ris",
    description: "Mettende middag som smaker mer enn den er vanskelig.",
    body: "**Til 1 porsjon · ca. 25 min**\n\n**Ingredienser**\n- 150 g karbonadedeig mager\n- 60 g basmatiris tørr\n- 50 g løk\n- 100 g tomat\n- 1/2 paprika\n- 1 ss olivenolje\n- 1 ts paprikakrydder\n- Salt og pepper\n\n**Slik gjør du**\n1. Kok risen.\n2. Brun kjøttdeig med løk i en panne. Krydre med paprika, salt og pepper.\n3. Tilsett hakket tomat og paprika. La småputre i 5 minutter.\n4. Server med ris.\n\n**Tips:** Topp med litt revet ost eller skyr naturell hvis du vil ha mer protein.",
    tag: "25 min · Middag",
    scalingMode: "flexible",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-15",
    title: "Ovnsbakt torsk med potet og gulrot",
    description: "Lett fordøyelig middag med magert protein.",
    body: "**Til 1 porsjon · ca. 30 min**\n\n**Ingredienser**\n- 150 g torsk\n- 200 g potet kokt\n- 100 g gulrot\n- 1 ss olivenolje\n- Saft fra 1/2 sitron\n- Salt og pepper\n\n**Slik gjør du**\n1. Varm ovnen til 200 °C. Skjær potet og gulrot i biter og kok til nesten mør.\n2. Legg fisk og grønnsaker på et brett, pensle med olivenolje, salt, pepper og sitron.\n3. Stek i 12–15 minutter til fisken er gjennomstekt.\n\n**Tips:** Server med frisk dill eller persille.",
    tag: "30 min · Middag",
    scalingMode: "flexible",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-16",
    title: "Kylling- og pastapanne",
    description: "Rask pastarett med grønnsaker og god metthet.",
    body: "**Til 1 porsjon · ca. 20 min**\n\n**Ingredienser**\n- 120 g kyllingbryst\n- 80 g fullkornspasta tørr\n- 100 g spinat\n- 80 g tomat\n- 1 ss olivenolje\n- 1 fedd hvitløk\n- Salt og pepper\n\n**Slik gjør du**\n1. Kok pastaen al dente.\n2. Stek kylling i strimler med hvitløk til gjennomstekt.\n3. Tilsett tomat og spinat, rør til spinaten faller sammen.\n4. Bland inn pasta og smak til med salt og pepper.\n\n**Tips:** Spar litt pastavann og rør inn for en silkemyk saus uten fløte.",
    tag: "20 min · Middag",
    scalingMode: "flexible",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-17",
    title: "Storfekjøtt med kokte poteter og brokkoli",
    description: "Klassisk tallerkenmiddag med magert kjøtt og enkle sides.",
    body: "**Til 1 porsjon · ca. 25 min**\n\n**Ingredienser**\n- 120 g storfekjøtt mager\n- 250 g potet kokt\n- 150 g brokkoli\n- 1 ss olivenolje\n- Salt og pepper\n\n**Slik gjør du**\n1. Kok potet og brokkoli til møre.\n2. Stek storfekjøttet raskt på høy varme til ønsket stekegrad. La hvile noen minutter.\n3. Server med potet og brokkoli.\n\n**Tips:** Skjær kjøttet tynt mot fiberen for maksimal mørhet.",
    tag: "25 min · Middag",
    scalingMode: "flexible",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-18",
    title: "Linsegryte med grønnsaker",
    description: "Plantebasert middag med fiber og protein — god som meat-free dag.",
    body: "**Til 1 porsjon · ca. 20 min**\n\n**Ingredienser**\n- 150 g linser kokt\n- 80 g gulrot\n- 50 g løk\n- 100 g tomat\n- 1 ss olivenolje\n- 1 ts paprikakrydder\n- Salt og pepper\n\n**Slik gjør du**\n1. Stek løk og gulrot i olivenolje i 3–4 minutter.\n2. Tilsett linser, tomat og krydder. La småputre i 8–10 minutter.\n3. Smak til med salt og pepper.\n\n**Tips:** Tilsett 100 g kyllingbryst hvis du vil ha mer protein denne dagen.",
    tag: "20 min · Middag",
    scalingMode: "flexible",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-19",
    title: "Kyllingsalat med quinoa",
    description: "Frisk middag eller stor lunsj — lett å ta med.",
    body: "**Til 1 porsjon · ca. 15 min**\n\n**Ingredienser**\n- 120 g kyllingbryst\n- 80 g quinoa kokt\n- 80 g salat mix\n- 80 g tomat\n- 1 ss olivenolje\n- Saft fra 1/2 sitron\n- Salt og pepper\n\n**Slik gjør du**\n1. Stek eller kok kyllingen og skjær i strimler.\n2. Bland quinoa, salat og tomat i en bolle.\n3. Topp med kylling, olivenolje, sitron, salt og pepper.\n\n**Tips:** Kok ekstra quinoa til lunsj dagen etter.",
    tag: "15 min · Middag",
    scalingMode: "flexible",
    createdAt: "2026-05-27",
  },
  {
    id: "default-recipe-20",
    title: "Laks i panne med potetmos",
    description: "Rask variant av fiskemiddag når du vil ha noe ekstra mettende.",
    body: "**Til 1 porsjon · ca. 20 min**\n\n**Ingredienser**\n- 130 g laks\n- 250 g potet kokt\n- 1 ss smør\n- 2 ss lettmelk\n- 100 g brokkoli\n- Salt og pepper\n\n**Slik gjør du**\n1. Kok potet og brokkoli. Mos poteten med smør og litt melk.\n2. Stek laksen i en panne med salt og pepper, ca. 3–4 minutter per side.\n3. Server laks med potetmos og brokkoli.\n\n**Tips:** Ikke stek for hardt — laksen skal være saftig inni.",
    tag: "20 min · Middag",
    scalingMode: "flexible",
    createdAt: "2026-05-27",
  },
];

export const DEFAULT_RECIPE_SCALING_BY_ID = new Map(
  DEFAULT_INSPIRATION_RECIPES.map((recipe) => [recipe.id, recipe.scalingMode ?? "flexible"]),
);

export const DEFAULT_RECIPE_BODY_BY_ID = new Map(
  DEFAULT_INSPIRATION_RECIPES.map((recipe) => [recipe.id, recipe.body]),
);
