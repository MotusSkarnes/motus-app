/**
 * Genererer to test-PDF-er (PT og medlem) for manuell QA av Motus-appen.
 * Kjøres lokalt med `node ./scripts/generate-test-plans.mjs`.
 *
 * Outputfiler:
 *   - docs/motus-testplan-pt.pdf
 *   - docs/motus-testplan-medlem.pdf
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs");

const MOTUS_TEAL = "#0d9488";
const MOTUS_PINK = "#d91278";
const MOTUS_INK = "#0f172a";
const MOTUS_MUTED = "#475569";
const MOTUS_BORDER = "#e2e8f0";
const MOTUS_SUBTLE = "#f8fafc";

const PAGE_OPTIONS = {
  size: "A4",
  margins: { top: 60, bottom: 64, left: 56, right: 56 },
  bufferPages: true,
};

function ensureDocsDir() {
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
}

function drawCover(doc, { title, role, palette }) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const width = doc.page.width - left - doc.page.margins.right;

  // Brand strip
  doc
    .save()
    .roundedRect(left, top, width, 64, 14)
    .fill(palette.accent)
    .restore();

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("MOTUS", left + 18, top + 22);
  doc
    .fontSize(11)
    .font("Helvetica")
    .text(role.toUpperCase(), left + 18, top + 44, { characterSpacing: 2 });

  // Title block
  const titleY = top + 110;
  doc
    .fillColor(MOTUS_INK)
    .font("Helvetica-Bold")
    .fontSize(30)
    .text(title, left, titleY, { width });

  doc
    .moveDown(0.4)
    .font("Helvetica")
    .fontSize(13)
    .fillColor(MOTUS_MUTED)
    .text(
      "Manuell testplan for å verifisere alle hovedfunksjoner i Motus-appen før release.",
      { width },
    );

  // Info card
  const cardY = doc.y + 24;
  const cardH = 130;
  doc
    .save()
    .roundedRect(left, cardY, width, cardH, 12)
    .fill(MOTUS_SUBTLE)
    .restore();

  doc
    .roundedRect(left, cardY, width, cardH, 12)
    .lineWidth(0.6)
    .strokeColor(MOTUS_BORDER)
    .stroke();

  const generatedAt = new Date().toLocaleDateString("no-NO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const lines = [
    ["Versjon", "1.0"],
    ["Generert", generatedAt],
    ["Rolle", role],
    ["Format", "Manuell sjekk – kryss av OK / FEIL per case"],
    ["Tips", "Skriv ut, eller fyll ut digitalt i Adobe Reader / Preview."],
  ];
  let lineY = cardY + 18;
  lines.forEach(([label, value]) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(MOTUS_MUTED)
      .text(label.toUpperCase(), left + 18, lineY, { characterSpacing: 1.4 });
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(MOTUS_INK)
      .text(value, left + 110, lineY, { width: width - 130 });
    lineY += 18;
  });

  // Instructions
  doc.y = cardY + cardH + 26;
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(MOTUS_INK)
    .text("Hvordan bruke testplanen", left, doc.y, { width });
  doc
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(11)
    .fillColor(MOTUS_MUTED);
  const instructions = [
    "Gå gjennom hver testseksjon i rekkefølge. Følg stegene som oppgis under hver case.",
    "Sammenlign faktisk oppførsel med «Forventet resultat». Hvis ulik – kryss av FEIL og noter detaljer i merknadsfeltet.",
    "Bruk en frisk innlogging for å unngå utdatert cache. Test på både mobil og desktop hvis mulig.",
    "Service worker oppdaterer ved relaunch – steng appen helt mellom store endringer.",
    "Eventuelle blokkerende feil rapporteres umiddelbart til PT/dev før release.",
  ];
  instructions.forEach((line) => {
    doc.text(`•  ${line}`, { width, indent: 2, paragraphGap: 4 });
  });
}

function pickPalette(role) {
  if (role === "pt") {
    return { accent: MOTUS_PINK, accentSoft: "#fce7f3" };
  }
  return { accent: MOTUS_TEAL, accentSoft: "#ccfbf1" };
}

function drawSectionHeader(doc, section, palette, sectionNumber) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const top = doc.y;

  doc
    .save()
    .roundedRect(left, top, width, 38, 8)
    .fill(palette.accent)
    .restore();

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(`${sectionNumber}.`, left + 14, top + 12, { lineBreak: false });
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#ffffff")
    .text(section.title, left + 38, top + 11, { lineBreak: false, width: width - 60 });

  doc.y = top + 50;

  if (section.description) {
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(MOTUS_MUTED)
      .text(section.description, left, doc.y, { width });
    doc.moveDown(0.6);
  }
}

function measureCaseHeight(doc, testCase, palette, opts) {
  // Estimate: title + steps + expected + checkbox row + paddings.
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right - 28;
  let h = 26; // header strip + padding
  doc.font("Helvetica-Bold").fontSize(11);
  h += doc.heightOfString(testCase.title, { width });
  h += 4;
  doc.font("Helvetica").fontSize(10);
  testCase.steps.forEach((step) => {
    h += doc.heightOfString(`• ${step}`, { width: width - 8, paragraphGap: 2 });
  });
  h += 4;
  doc.font("Helvetica-Bold").fontSize(9.5);
  h += doc.heightOfString("FORVENTET RESULTAT", { width });
  doc.font("Helvetica").fontSize(10);
  h += doc.heightOfString(testCase.expected, { width });
  h += 26; // checkbox + notes
  return h + 12;
}

function drawTestCase(doc, testCase, idLabel, palette) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const startY = doc.y;
  const estimatedHeight = measureCaseHeight(doc, testCase, palette);

  // Page-break if not enough room.
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (startY + estimatedHeight > bottomLimit) {
    doc.addPage();
  }

  const cardTop = doc.y;

  // Sidebar / id ribbon
  doc
    .save()
    .roundedRect(left, cardTop, width, 1, 0)
    .fill("#ffffff")
    .restore();

  // Card border + soft background
  const cardX = left;
  const cardW = width;

  // Title row with ID pill
  doc
    .save()
    .roundedRect(cardX, cardTop, 56, 18, 4)
    .fill(palette.accentSoft)
    .restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(palette.accent)
    .text(idLabel, cardX + 4, cardTop + 5, { width: 48, align: "center", characterSpacing: 1.2 });

  doc
    .font("Helvetica-Bold")
    .fontSize(11.5)
    .fillColor(MOTUS_INK)
    .text(testCase.title, cardX + 64, cardTop + 3, {
      width: cardW - 70,
    });

  doc.moveDown(0.5);

  // Steps
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(MOTUS_MUTED)
    .text("STEG", cardX, doc.y, { characterSpacing: 1.2 });
  doc.moveDown(0.1);

  doc.font("Helvetica").fontSize(10.5).fillColor(MOTUS_INK);
  testCase.steps.forEach((step, idx) => {
    doc.text(`${idx + 1}.  ${step}`, cardX, doc.y, {
      width: cardW,
      paragraphGap: 2,
      indent: 0,
    });
  });

  doc.moveDown(0.3);

  // Expected
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(MOTUS_MUTED)
    .text("FORVENTET RESULTAT", cardX, doc.y, { characterSpacing: 1.2 });
  doc.moveDown(0.1);
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(MOTUS_INK)
    .text(testCase.expected, cardX, doc.y, { width: cardW });

  doc.moveDown(0.4);

  // Checkbox row
  const rowY = doc.y;
  // OK box
  doc.lineWidth(0.8).strokeColor(MOTUS_MUTED).fillColor("#ffffff");
  doc.rect(cardX, rowY, 12, 12).fillAndStroke("#ffffff", MOTUS_MUTED);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(MOTUS_INK).text("OK", cardX + 18, rowY + 1);
  // FEIL box
  doc.rect(cardX + 60, rowY, 12, 12).fillAndStroke("#ffffff", MOTUS_MUTED);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(MOTUS_INK).text("FEIL", cardX + 78, rowY + 1);
  // Notes
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(MOTUS_MUTED)
    .text("Merknad:", cardX + 130, rowY + 1, { lineBreak: false });
  doc
    .moveTo(cardX + 172, rowY + 12)
    .lineTo(cardX + cardW, rowY + 12)
    .lineWidth(0.6)
    .strokeColor(MOTUS_BORDER)
    .stroke();

  doc.y = rowY + 24;

  // Divider
  doc
    .moveTo(cardX, doc.y)
    .lineTo(cardX + cardW, doc.y)
    .lineWidth(0.4)
    .strokeColor(MOTUS_BORDER)
    .dash(2, { space: 2 })
    .stroke()
    .undash();
  doc.moveDown(0.6);
}

function drawFooter(doc, totalPagesPlaceholder) {
  const range = doc.bufferedPageRange();
  const total = range.start + range.count;
  for (let i = range.start; i < total; i += 1) {
    doc.switchToPage(i);
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const y = doc.page.height - 40;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MOTUS_MUTED)
      .text("Motus PT-app · Manuell testplan", left, y, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MOTUS_MUTED)
      .text(`Side ${i - range.start + 1} av ${range.count}`, left, y, {
        width: right - left,
        align: "right",
        lineBreak: false,
      });
    doc
      .moveTo(left, y - 6)
      .lineTo(right, y - 6)
      .lineWidth(0.4)
      .strokeColor(MOTUS_BORDER)
      .stroke();
  }
  void totalPagesPlaceholder;
}

function buildPdf({ outputPath, title, role, sections }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument(PAGE_OPTIONS);
    const stream = fs.createWriteStream(outputPath);
    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
    doc.pipe(stream);

    const palette = pickPalette(role === "PT" ? "pt" : "member");

    // Cover
    drawCover(doc, { title, role, palette });

    // Sections
    doc.addPage();
    sections.forEach((section, sIdx) => {
      drawSectionHeader(doc, section, palette, sIdx + 1);
      section.cases.forEach((tc, tIdx) => {
        const idLabel = `${String(sIdx + 1).padStart(2, "0")}-${String(tIdx + 1).padStart(2, "0")}`;
        drawTestCase(doc, tc, idLabel, palette);
      });
      // Space between sections
      doc.moveDown(0.5);
    });

    drawFooter(doc);

    doc.end();
  });
}

/* -------------------------------------------------------------------------- */
/*  TEST CONTENT                                                              */
/* -------------------------------------------------------------------------- */

const PT_SECTIONS = [
  {
    title: "Innlogging og oppsett",
    description: "Verifiser at PT kan logge inn og at miljøet er klart.",
    cases: [
      {
        title: "Logg inn som PT",
        steps: [
          "Åpne app.motus.no i en frisk fane (privat/inkognito anbefales).",
          "Logg inn med PT-kontoen (e-post + magic link / passord).",
        ],
        expected:
          "Du lander på PT-portalen (Klienter-fanen) uten feilmeldinger. PT-navn vises øverst til høyre.",
      },
      {
        title: "Sjekk produksjonsmiljø-flagg",
        steps: [
          "Åpne devtools / konsoll.",
          "Sjekk at Supabase URL og publishable key peker på prod-prosjekt.",
        ],
        expected:
          "Ingen advarsler om manglende env. Service worker registrert med siste versjon.",
      },
    ],
  },
  {
    title: "Klientdashboard",
    description: "Oversikt over alle medlemmer, oppfølging og statistikk.",
    cases: [
      {
        title: "Klientliste vises korrekt",
        steps: [
          "Åpne Klienter-fanen.",
          "Verifiser at alle aktive medlemmer listes i kortrutenettet.",
        ],
        expected:
          "Alle aktive medlemmer vises. Navn, e-post, treningsmål og siste aktivitet er synlig per kort.",
      },
      {
        title: "Inaktive medlemmer kan vises",
        steps: [
          "Trykk på «Vis inaktive»-knappen.",
          "Verifiser at inaktive medlemmer dukker opp.",
        ],
        expected:
          "Inaktive medlemmer vises i en egen seksjon med tydelig merking (grå tone / etikett).",
      },
      {
        title: "Søk og filtrering",
        steps: [
          "Skriv et delvis navn i søkefeltet.",
          "Sjekk at listen filtreres live.",
        ],
        expected:
          "Klientlisten oppdateres etter hvert som du skriver. Tom resultatliste viser passende «ingen treff»-melding.",
      },
      {
        title: "Statistikk-innsiktskort",
        steps: [
          "Åpne dashboard-toppen.",
          "Verifiser tall for siste 7 og 30 dager (gjennomførte økter, gruppetimer).",
        ],
        expected:
          "Tall stemmer overens med summen av medlemslogger i tilsvarende tidsrom.",
      },
      {
        title: "Foreslått oppfølging",
        steps: [
          "Sjekk «Foreslåtte kontakter»-listen.",
          "Marker én klient som fulgt opp.",
        ],
        expected:
          "Klienten flyttes til «Fulgt opp» eller forsvinner fra listen. Statusen lagres på server.",
      },
      {
        title: "Coach AI er fjernet (regresjon)",
        steps: [
          "Bla nedover på klientens detaljside.",
        ],
        expected:
          "«Coach AI»-panelet skal ikke vises på klientvisning lenger.",
      },
    ],
  },
  {
    title: "Klientadministrasjon",
    description: "Invitasjoner, deaktivering, sammenslåing av profiler.",
    cases: [
      {
        title: "Inviter nytt medlem",
        steps: [
          "Trykk «Inviter medlem».",
          "Fyll inn navn, e-post, telefon.",
          "Trykk Send invitasjon.",
        ],
        expected:
          "Statusbanner bekrefter at invitasjonen er sendt. Medlemmet dukker opp i listen som invitert.",
      },
      {
        title: "Deaktiver et medlem",
        steps: [
          "Åpne medlemskortet.",
          "Trykk «Deaktiver» og bekreft.",
        ],
        expected:
          "Medlemmet flyttes til inaktive. Hvis aktivert igjen, vises de tilbake i aktiv liste umiddelbart.",
      },
      {
        title: "Duplikatklienter slås sammen",
        steps: [
          "Sjekk at medlemmer med samme e-post vises som én klient i oversikten.",
        ],
        expected:
          "Klientkortet viser samlet treningsdata fra alle profil-ID-er knyttet til e-posten.",
      },
    ],
  },
  {
    title: "Programbibliotek",
    description: "Standalone programmer og periodeplan-pakker.",
    cases: [
      {
        title: "Opprett standalone program",
        steps: [
          "Åpne Programmer-fanen.",
          "Trykk «Nytt program».",
          "Legg til 3 øvelser fra øvelsesbanken.",
          "Lagre.",
        ],
        expected:
          "Programmet vises i biblioteket. Antall øvelser stemmer. Cover-bilde / standardgradient vises riktig.",
      },
      {
        title: "Opprett periodeplan-pakke",
        steps: [
          "Trykk «Ny pakke / periodeplan».",
          "Definer 4 uker med dagsprogrammer.",
          "Sett startdato og lagre.",
        ],
        expected:
          "Pakken vises i biblioteket med riktige uker. Filtrerbart under «Pakker / Periodeplaner».",
      },
      {
        title: "Filtrer biblioteket",
        steps: [
          "Bruk filterknappene (Alle / Standalone / Periodeplan).",
        ],
        expected:
          "Bibliotekslisten viser kun riktig type per filter.",
      },
      {
        title: "Dupliser og slett",
        steps: [
          "Bruk meny på et programkort: Dupliser.",
          "Slett kopien.",
        ],
        expected:
          "Kopien får navn med «(kopi)». Sletting fjerner programmet fra bibliotek + medlemslister.",
      },
    ],
  },
  {
    title: "Programbygger",
    description: "Bygging og tilpasning av økter.",
    cases: [
      {
        title: "Legg til øvelse fra bank",
        steps: [
          "Åpne et program for redigering.",
          "Søk og legg til en øvelse.",
        ],
        expected:
          "Øvelsen plasseres nederst i listen med standardverdier for sett/reps.",
      },
      {
        title: "Intervall-rad med min + sek",
        steps: [
          "Legg til en kondisjons-øvelse.",
          "Sett varighet til 1 minutt 30 sekunder.",
        ],
        expected:
          "Verdiene lagres som 01:30. Etter reload vises samme format.",
      },
      {
        title: "Vekt-forslag",
        steps: [
          "Trykk forslagsknappen på en styrkeøvelse.",
        ],
        expected:
          "Forslag basert på medlemmets siste prestasjon (eller default) settes inn. Endring overstyrer lokalt.",
      },
      {
        title: "Demo-modus blokkerer lagring",
        steps: [
          "Logg inn i demo-modus (uten Supabase).",
          "Prøv å lagre et nytt program.",
        ],
        expected:
          "Visuell feilmelding indikerer at lagring krever live-konto.",
      },
    ],
  },
  {
    title: "Øvelsesbank",
    description: "Søk, kategorier og redigering av øvelser.",
    cases: [
      {
        title: "Søk etter øvelse",
        steps: [
          "Åpne øvelsesbanken.",
          "Søk på et navn / utstyr / beskrivelse.",
        ],
        expected:
          "Listen filtreres riktig på treff i navn, utstyr, beskrivelse eller muskelgruppe.",
      },
      {
        title: "Legg til ny øvelse",
        steps: [
          "Trykk «Ny øvelse».",
          "Fyll inn navn, kategori, muskelgruppe, beskrivelse, bilde.",
          "Lagre.",
        ],
        expected:
          "Øvelsen dukker opp i banken og er valgbar i programbyggeren.",
      },
      {
        title: "Rediger og slett",
        steps: [
          "Endre beskrivelsen på en øvelse.",
          "Lagre, og slett en testøvelse.",
        ],
        expected:
          "Endringer reflekteres umiddelbart. Slettede øvelser fjernes fra banken (og programmer som bruker dem flagges).",
      },
    ],
  },
  {
    title: "Periodeplan-redaktør",
    description: "Ukesplaner og periodisering for medlemmer.",
    cases: [
      {
        title: "Lag plan med startdato",
        steps: [
          "Bygg en plan med Mon–Sun-økter i uke 1–4.",
          "Sett startdato til neste mandag.",
        ],
        expected:
          "Planen vises i medlemmets «Periodeplan» og hjemskjerm med riktig dato.",
      },
      {
        title: "Lag plan uten startdato",
        steps: [
          "Bygg en plan uten startdato.",
          "Tildel til medlemmet.",
        ],
        expected:
          "Hjemskjerm bruker dagens kalender-ukedag for «dagens økt». Auto-fullføring fungerer for fullført økt.",
      },
      {
        title: "Bytt to dager",
        steps: [
          "Bruk swap-funksjonen i ukesvisningen.",
        ],
        expected:
          "Daglige etiketter bytter plass i medlemmets kalender og hjemskjerm. Lagres lokalt + i sky.",
      },
      {
        title: "Auto-fullføring etter trening",
        steps: [
          "La medlemmet starte et koblet program fra periodeplanen og fullføre.",
        ],
        expected:
          "Periodeplan-dagen merkes automatisk som fullført (med haken).",
      },
    ],
  },
  {
    title: "Gruppetimer",
    description: "Opprett og administrer gruppetimetilbud.",
    cases: [
      {
        title: "Opprett gruppetime",
        steps: [
          "Åpne gruppetime-administrasjon.",
          "Lag «Smilepuls» med tid, dag, instruktør.",
          "Lagre.",
        ],
        expected:
          "Timen er tilgjengelig som forhåndsvalg for medlemmer ved logging av gruppetrening.",
      },
      {
        title: "Tilpass tilbakemeldingsspørsmål",
        steps: [
          "Rediger gruppetime og legg til refleksjons-spørsmål.",
        ],
        expected:
          "Medlemmer ser de oppdaterte spørsmålene neste gang de logger timen.",
      },
    ],
  },
  {
    title: "Utforsk (PT-redigering)",
    description: "Artikler, hero, Dagens utvalgte, sortering.",
    cases: [
      {
        title: "Opprett ny artikkel",
        steps: [
          "Trykk + på hero, velg artikkel.",
          "Skriv tittel, beskrivelse, body med markdown (heading, liste, lenke).",
          "Last opp cover-bilde og lagre.",
        ],
        expected:
          "Artikkelen vises som kort i Utforsk for alle medlemmer. Markdown rendres korrekt.",
      },
      {
        title: "Sorter artikler",
        steps: [
          "Bruk pil opp / ned på en artikkel.",
        ],
        expected:
          "Rekkefølgen lagres for alle. Refresh viser samme rekkefølge.",
      },
      {
        title: "Rediger hero-tekst",
        steps: [
          "Trykk «Rediger tekst» på heroen.",
          "Endre tittel, undertekst, CTA.",
          "Lagre.",
        ],
        expected:
          "Endringer slår igjennom for alle. Tom verdi gir standardtekst.",
      },
      {
        title: "Bytt hero-bilde",
        steps: [
          "Trykk «Bytt bilde» og last opp et nytt bilde.",
        ],
        expected:
          "Bilde komprimeres og lastes opp. Vises umiddelbart på Utforsk.",
      },
      {
        title: "Pin Dagens utvalgte manuelt",
        steps: [
          "Trykk «Velg artikkel» under Dagens utvalgte-banneret.",
          "Velg en spesifikk artikkel og bekreft.",
        ],
        expected:
          "Banneret viser den valgte artikkelen for alle medlemmer. Status: «Pinnet av PT».",
      },
      {
        title: "Aktivér AI-rotasjon",
        steps: [
          "Med en pinnet artikkel, trykk «La AI rotere».",
        ],
        expected:
          "Status endres til «AI velger daglig». Banneret bytter automatisk artikkel hver dag.",
      },
      {
        title: "Slett artikkel",
        steps: [
          "Trykk søppelkasse på en artikkel og bekreft.",
        ],
        expected:
          "Artikkelen forsvinner umiddelbart. Hvis pinnet, faller systemet tilbake til AI-rotasjon.",
      },
    ],
  },
  {
    title: "Meldinger",
    description: "Tråder mellom PT og medlem.",
    cases: [
      {
        title: "Send melding til medlem",
        steps: [
          "Åpne et medlemskort og start en samtale.",
          "Skriv og send en testmelding.",
        ],
        expected:
          "Meldingen vises i tråden med riktig tidsstempel. Push-/in-app-varsling går til medlemmet.",
      },
      {
        title: "Lest-status",
        steps: [
          "Få medlemmet til å åpne meldingen.",
        ],
        expected:
          "Statusen oppdateres til lest i PT-tråden.",
      },
    ],
  },
  {
    title: "Onboarding-oppfølging",
    description: "Verifiser onboarding-status og fallback-sjekker.",
    cases: [
      {
        title: "Onboarding-status på klientkort",
        steps: [
          "Sjekk klientkort for et nytt medlem som ikke har fylt ut onboarding.",
        ],
        expected:
          "Tydelig statusindikator «Ikke fullført» eller liknende vises.",
      },
      {
        title: "Status «Fullført»",
        steps: [
          "Sjekk klient som har fullført onboarding.",
        ],
        expected:
          "Statusen endres til Fullført. Periodeplan-dager etter completion-dato auto-fullføres ikke.",
      },
    ],
  },
  {
    title: "Statistikk og innsikt",
    description: "PT-statistikkvisning for klienter og trening.",
    cases: [
      {
        title: "Innsiktskort 7/30 dager",
        steps: [
          "Bytt mellom 7- og 30-dagers visning.",
        ],
        expected:
          "Tall reflekterer riktig periode. Grafer fungerer uten å krasje.",
      },
      {
        title: "Treningstype-fordeling",
        steps: [
          "Se ringer / fordeling per treningstype.",
        ],
        expected:
          "Summen stemmer med antall logger per kategori i valgt periode.",
      },
    ],
  },
  {
    title: "Profil og innstillinger",
    description: "PT-profil og logout.",
    cases: [
      {
        title: "Rediger PT-profil",
        steps: [
          "Endre navn, e-post, profilbilde.",
          "Lagre.",
        ],
        expected:
          "Endringer lagres på Supabase og vises på PT-headeren.",
      },
      {
        title: "Logout",
        steps: [
          "Trykk Logg ut.",
        ],
        expected:
          "Sesjonen avsluttes. Tilbake til innloggingsside. Lokal sensitiv state ryddes.",
      },
    ],
  },
];

const MEMBER_SECTIONS = [
  {
    title: "Onboarding og første kjøring",
    description: "Verifiser at nye medlemmer kommer trygt i gang.",
    cases: [
      {
        title: "Åpne invitasjonslenke",
        steps: [
          "Klikk på invitasjonslenken i e-post fra PT.",
          "Logg inn via magic link / passord.",
        ],
        expected:
          "Lander på Hjem-skjermen. Velkomstmodal kan vises før onboarding-prompt.",
      },
      {
        title: "Fyll ut onboarding-skjema",
        steps: [
          "Trykk «Sett i gang» / åpne onboarding.",
          "Svar på alle spørsmål (mål, nivå, helse, ukentlig mål osv.).",
          "Lagre.",
        ],
        expected:
          "Skjemaet lagres mot Supabase. Hjem-prompten forsvinner for godt på denne enheten.",
      },
      {
        title: "Dismiss home prompt",
        steps: [
          "Hvis prompten fortsatt vises (etter delvis fyll-ut), trykk X-knappen.",
        ],
        expected:
          "Prompten forsvinner på denne enheten. Skal ikke dukke opp igjen ved relaunch.",
      },
      {
        title: "Logg inn på ny enhet",
        steps: [
          "Åpne app.motus.no på en annen enhet/nettleser uten cache.",
        ],
        expected:
          "Hvis onboarding er fylt ut tidligere, vises IKKE prompten igjen (sync fra Supabase).",
      },
      {
        title: "PWA-installasjon",
        steps: [
          "Trykk «Legg til på Hjem» i nettleseren / via app-prompt.",
        ],
        expected:
          "App-ikon legges til. Splash + ikon ser ut som forventet.",
      },
    ],
  },
  {
    title: "Hjemskjerm",
    description: "Den daglige sentralskjermen.",
    cases: [
      {
        title: "Dagens økt — Start dagens økt",
        steps: [
          "Når periodeplan-dagen er et koblet styrkeprogram, sjekk Hjem-knappen.",
        ],
        expected:
          "Knappen viser «Start dagens økt» med play-ikon. Trykk åpner treningsmodus.",
      },
      {
        title: "Logg dagens økt — gruppetime",
        steps: [
          "Når periodeplan-dagen er en gruppetime, åpne Hjem.",
          "Trykk «Logg dagens økt».",
        ],
        expected:
          "Økten logges, status oppdateres umiddelbart til «Dagens økt er logget» og knappen disables.",
      },
      {
        title: "Hviledag-melding",
        steps: [
          "Når periodeplan-dagen er hvile / aktiv restitusjon, åpne Hjem.",
        ],
        expected:
          "Hjem viser hviledag-merking, ingen start-knapp.",
      },
      {
        title: "Treningsfri uten plan",
        steps: [
          "Medlem uten aktiv periodeplan / dagens økt.",
        ],
        expected:
          "Hjem viser nestebeste handling / programvalg uten å krasje.",
      },
      {
        title: "Ukens treningsstatus",
        steps: [
          "Se den lille ukekortet (man–søn).",
        ],
        expected:
          "Fullførte dager er fylt, planlagte er stiplet, hviledag er markert. Streak-tallet stemmer.",
      },
    ],
  },
  {
    title: "Treningsmodus",
    description: "Selve økt-loggingen.",
    cases: [
      {
        title: "Start workout",
        steps: [
          "Trykk «Start dagens økt» fra hjem eller program-kort.",
        ],
        expected:
          "Treningsmodus åpnes med riktig program og øvelsesliste.",
      },
      {
        title: "Logg sett",
        steps: [
          "Skriv inn vekt og reps for hver øvelse.",
          "Trykk + for ekstra sett.",
        ],
        expected:
          "Verdier lagres lokalt. Etter avslutning persisteres alt til Supabase.",
      },
      {
        title: "Forrige økt-vekt vises som hint",
        steps: [
          "Sjekk grå placeholder-vekt på styrkeøvelser.",
        ],
        expected:
          "Forrige øktens vekt vises som grå tekst – nullstilles når du skriver inn ny verdi.",
      },
      {
        title: "Ny rekord-badge",
        steps: [
          "Logg en høyere vekt × reps enn forrige rekord.",
        ],
        expected:
          "«Ny rekord!»-badge vises inline på det aktuelle settet.",
      },
      {
        title: "Avslutt og feiringskort",
        steps: [
          "Trykk «Avslutt økt» og bekreft.",
        ],
        expected:
          "Feiringskort vises etter avslutning. Loggen havner under «Sist gjennomført».",
      },
      {
        title: "Periodeplan-auto-fullføring",
        steps: [
          "Verifiser at dagens periodeplan-rad er haket av etter at økten er fullført.",
        ],
        expected:
          "Periodeplan-radens hake er aktiv. Hjem viser «Dagens økt er fullført».",
      },
    ],
  },
  {
    title: "Gruppetrening",
    description: "Logging av gruppetimer.",
    cases: [
      {
        title: "Logg gruppetrening fra hero-kort",
        steps: [
          "Trykk «Logg gruppetrening» (cover-bilde-kort på Hjem).",
          "Velg gruppetime, dato, refleksjon, lagre.",
        ],
        expected:
          "Loggen vises i progress og oppdaterer periodeplanen hvis matchende rad finnes i dag.",
      },
      {
        title: "Logg gruppetrening med tilbakedato",
        steps: [
          "Logg en gruppetime fra forrige uke ved å velge dato.",
        ],
        expected:
          "Loggen får riktig dato, periodeplan oppdaterer bare for matchende dag i fortiden (ikke fremtid).",
      },
    ],
  },
  {
    title: "Periodeplan",
    description: "Ukesplan og periodisering for medlemmet.",
    cases: [
      {
        title: "Bla i denne uken",
        steps: [
          "Åpne Periodeplan-fanen.",
          "Sjekk ukesvisning med dagsetiketter.",
        ],
        expected:
          "Alle dager vises med øktnavn / gruppetime / hvile. Dagens kolonne uthevet.",
      },
      {
        title: "Marker økt manuelt",
        steps: [
          "Trykk haken på en dag som ikke er fullført.",
        ],
        expected:
          "Dagen merkes som fullført. Lagres på server.",
      },
      {
        title: "Avmarker økt",
        steps: [
          "Trykk haken igjen på en fullført dag.",
        ],
        expected:
          "Dagen blir umarkert. Status synkroniseres på tvers av enheter.",
      },
      {
        title: "Bytt to dager",
        steps: [
          "Bruk swap-funksjon.",
        ],
        expected:
          "Etikettene bytter posisjon. Hjem viser den nye dags-økten.",
      },
    ],
  },
  {
    title: "Programmer",
    description: "Mine programmer og start-flyt.",
    cases: [
      {
        title: "Bla i mine programmer",
        steps: [
          "Åpne Programmer-listen.",
        ],
        expected:
          "Alle tildelte programmer listes med cover/gradient. «X ganger fullført» vises (ikke prosent).",
      },
      {
        title: "Start program fra liste",
        steps: [
          "Trykk «Start»-knappen på et program.",
        ],
        expected:
          "Treningsmodus åpnes med valgt program.",
      },
    ],
  },
  {
    title: "Progress og status",
    description: "Kalender, streak, badges.",
    cases: [
      {
        title: "Kalender dag/uke/måned",
        steps: [
          "Bytt mellom visninger.",
        ],
        expected:
          "Fullførte økter vises på riktig dato. Tap åpner detalj.",
      },
      {
        title: "Streak-tall",
        steps: [
          "Sjekk current + best streak.",
        ],
        expected:
          "Tallene stemmer overens med ukentlige mål og fullførte uker.",
      },
      {
        title: "Badges-karusell",
        steps: [
          "Åpne bunnen av Hjem.",
          "Bla gjennom karusellen.",
        ],
        expected:
          "Alle badges vises uten klipping. Aktive er fargerike, inaktive er grå. Tap åpner detaljside.",
      },
      {
        title: "Del badge (Skrytekort)",
        steps: [
          "Åpne en oppnådd badge.",
          "Trykk Del / Last ned.",
        ],
        expected:
          "Et bilde med Motus-branding genereres og kan lagres / deles.",
      },
    ],
  },
  {
    title: "Ukesoppsummering",
    description: "Slutten-av-uken oppsummeringskort.",
    cases: [
      {
        title: "Generer ukesoppsummering",
        steps: [
          "Åpne ukesoppsummeringskortet.",
          "Sjekk hero-bilde, sparkle-header og statistikk-cellene.",
        ],
        expected:
          "Tallene (økter, dager, snitt, vekt) er korrekte og fargene følger Motus-merket.",
      },
      {
        title: "Del / last ned",
        steps: [
          "Trykk Del-knappen.",
        ],
        expected:
          "Et delbart bilde genereres. Kan lagres lokalt eller deles via systemet.",
      },
    ],
  },
  {
    title: "Utforsk",
    description: "Inspirasjon, artikler, Dagens utvalgte.",
    cases: [
      {
        title: "Hero vises korrekt",
        steps: [
          "Åpne Utforsk-fanen.",
        ],
        expected:
          "Hero-kortet viser bilde (eller PT-tilpasset), tittel, undertekst og CTA. Ingen UKENS UTVALGTE-badge på heroen.",
      },
      {
        title: "Dagens utvalgte-banner",
        steps: [
          "Bla under hero.",
        ],
        expected:
          "Full-bredde banner med cover-bilde, «DAGENS UTVALGTE»-pille, tittel, beskrivelse og «Les mer»-CTA. Tap åpner artikkelen.",
      },
      {
        title: "Bla i kategorier",
        steps: [
          "Bruk «Hva vil du utforske?»-pillene.",
        ],
        expected:
          "Smooth scrolling til seksjonen (Tips / Programmer / Oppskrifter / Nyheter).",
      },
      {
        title: "App-guide undermeny",
        steps: [
          "Bytt til «App-guide»-tab.",
        ],
        expected:
          "Kun app-guide-artikler vises. Antall i pillen stemmer.",
      },
      {
        title: "Åpne en artikkel",
        steps: [
          "Trykk på en artikkel-kort.",
        ],
        expected:
          "Artikkelens fulle tekst vises med riktig markdown-formatering, bilder, lenker.",
      },
    ],
  },
  {
    title: "Sjekk-inn (månedlig)",
    description: "Månedlig refleksjons-flyt.",
    cases: [
      {
        title: "Få prompt",
        steps: [
          "Vent til neste sjekk-inn-måned eller åpne manuelt via meny.",
        ],
        expected:
          "Overlay åpnes med refleksjonsspørsmål.",
      },
      {
        title: "Fyll ut og lagre",
        steps: [
          "Svar på spørsmål.",
          "Trykk Lagre.",
        ],
        expected:
          "Svar lagres og bekreftes. Promp-en kommer ikke igjen før neste måned.",
      },
    ],
  },
  {
    title: "Profil",
    description: "Personlige innstillinger.",
    cases: [
      {
        title: "Rediger navn og e-post",
        steps: [
          "Åpne Profil.",
          "Endre navn / e-post og trykk Lagre.",
        ],
        expected:
          "Lagres mot Supabase. Endringer synlige for PT.",
      },
      {
        title: "Last opp avatar",
        steps: [
          "Trykk profilbilde-feltet.",
          "Velg bilde fra enheten.",
        ],
        expected:
          "Bildet komprimeres og lastes opp. Vises overalt avatar brukes.",
      },
      {
        title: "Personlige mål og ukentlig mål",
        steps: [
          "Sett ukentlig økt-mål til f.eks. 4.",
          "Skriv inn personlig mål-tekst.",
        ],
        expected:
          "Lagres. Hjem viser ukesoppsummering / progresjonskort mot dette målet.",
      },
    ],
  },
  {
    title: "Meldinger",
    description: "Tråd mot PT.",
    cases: [
      {
        title: "Send melding til PT",
        steps: [
          "Åpne meldingsfanen.",
          "Skriv og send en testmelding.",
        ],
        expected:
          "Meldingen vises i tråden. PT mottar varsel.",
      },
      {
        title: "Les melding fra PT",
        steps: [
          "Vent til PT sender en melding (eller test selv).",
        ],
        expected:
          "Notifikasjons-badge vises på fanen. Etter åpning markeres som lest hos PT.",
      },
    ],
  },
  {
    title: "Treningshistorikk",
    description: "Tidligere økter og detaljer.",
    cases: [
      {
        title: "Se siste økter",
        steps: [
          "Åpne hjem / progress og se «Sist gjennomført».",
        ],
        expected:
          "De 5 siste øktene listes med tittel og dato. Tap utvider med detaljer.",
      },
      {
        title: "Utvid logg-detalj",
        steps: [
          "Trykk én logg for å se detaljer.",
        ],
        expected:
          "Sett-by-sett-resultater vises med vekt + reps.",
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */

async function main() {
  ensureDocsDir();
  const ptPath = path.join(docsDir, "motus-testplan-pt.pdf");
  const memberPath = path.join(docsDir, "motus-testplan-medlem.pdf");

  await buildPdf({
    outputPath: ptPath,
    title: "Testplan – PT-portal",
    role: "PT",
    sections: PT_SECTIONS,
  });
  console.log(`Skrev ${path.relative(repoRoot, ptPath)}`);

  await buildPdf({
    outputPath: memberPath,
    title: "Testplan – Medlemsapp",
    role: "Medlem",
    sections: MEMBER_SECTIONS,
  });
  console.log(`Skrev ${path.relative(repoRoot, memberPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
