import type { FoodMicronutrientKey } from "./foodBankMicronutrients";
import {
  HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY,
  HEALTH_DIRECTORATE_OTHER_DAILY,
} from "./healthDirectorateNutritionReferences";
import { parseMemberAgeYears } from "./memberAge";
import type { MemberGender } from "./memberGender";
import { memberGenderLabel, normalizeMemberGender } from "./memberGender";

export type NutritionReferenceMissingField = "age" | "gender";

export type NutritionReferenceContext = {
  isPersonalized: boolean;
  missingFields: NutritionReferenceMissingField[];
  ageYears: number | null;
  gender: MemberGender;
  profileLabel: string | null;
  micronutrientDaily: Record<FoodMicronutrientKey, number>;
  otherDaily: typeof HEALTH_DIRECTORATE_OTHER_DAILY;
};

type AgeBand = "child" | "teen" | "adult" | "senior";
type SexKey = "male" | "female";

function ageBandFromYears(ageYears: number): AgeBand {
  if (ageYears < 10) return "child";
  if (ageYears < 18) return "teen";
  if (ageYears < 70) return "adult";
  return "senior";
}

/** Daglige mikroreferanser (vitaminer/mineraler) — basert på nordiske anbefalinger, differensiert kjønn og alder. */
const MICRONUTRIENT_BY_BAND_SEX: Record<AgeBand, Record<SexKey, Record<FoodMicronutrientKey, number>>> = {
  child: {
    female: {
      vitaminA: 400,
      vitaminD: 10,
      vitaminE: 6,
      vitaminC: 40,
      vitaminB1: 0.7,
      vitaminB2: 0.8,
      niacin: 9,
      vitaminB6: 0.8,
      folate: 200,
      vitaminB12: 1.5,
      calcium: 700,
      iron: 8,
      potassium: 2500,
      magnesium: 130,
      phosphorus: 460,
      zinc: 5,
      selenium: 25,
      iodine: 90,
      copper: 0.5,
    },
    male: {
      vitaminA: 400,
      vitaminD: 10,
      vitaminE: 6,
      vitaminC: 40,
      vitaminB1: 0.7,
      vitaminB2: 0.8,
      niacin: 9,
      vitaminB6: 0.8,
      folate: 200,
      vitaminB12: 1.5,
      calcium: 700,
      iron: 8,
      potassium: 2500,
      magnesium: 130,
      phosphorus: 460,
      zinc: 5,
      selenium: 25,
      iodine: 90,
      copper: 0.5,
    },
  },
  teen: {
    female: {
      vitaminA: 600,
      vitaminD: 10,
      vitaminE: 7,
      vitaminC: 60,
      vitaminB1: 1,
      vitaminB2: 1.1,
      niacin: 12,
      vitaminB6: 1.2,
      folate: 300,
      vitaminB12: 2,
      calcium: 900,
      iron: 15,
      potassium: 3000,
      magnesium: 280,
      phosphorus: 550,
      zinc: 7,
      selenium: 40,
      iodine: 120,
      copper: 0.8,
    },
    male: {
      vitaminA: 700,
      vitaminD: 10,
      vitaminE: 8,
      vitaminC: 60,
      vitaminB1: 1.1,
      vitaminB2: 1.3,
      niacin: 14,
      vitaminB6: 1.3,
      folate: 300,
      vitaminB12: 2,
      calcium: 900,
      iron: 11,
      potassium: 3000,
      magnesium: 300,
      phosphorus: 600,
      zinc: 9,
      selenium: 45,
      iodine: 120,
      copper: 0.9,
    },
  },
  adult: {
    female: {
      vitaminA: 800,
      vitaminD: 10,
      vitaminE: 8,
      vitaminC: 75,
      vitaminB1: 1.1,
      vitaminB2: 1.3,
      niacin: 14,
      vitaminB6: 1.4,
      folate: 300,
      vitaminB12: 2,
      calcium: 800,
      iron: 15,
      potassium: 3500,
      magnesium: 310,
      phosphorus: 600,
      zinc: 8,
      selenium: 50,
      iodine: 150,
      copper: 0.9,
    },
    male: {
      vitaminA: 900,
      vitaminD: 10,
      vitaminE: 9,
      vitaminC: 75,
      vitaminB1: 1.2,
      vitaminB2: 1.5,
      niacin: 16,
      vitaminB6: 1.5,
      folate: 300,
      vitaminB12: 2,
      calcium: 800,
      iron: 9,
      potassium: 3500,
      magnesium: 350,
      phosphorus: 600,
      zinc: 11,
      selenium: 55,
      iodine: 150,
      copper: 0.9,
    },
  },
  senior: {
    female: {
      vitaminA: 800,
      vitaminD: 20,
      vitaminE: 8,
      vitaminC: 75,
      vitaminB1: 1.1,
      vitaminB2: 1.3,
      niacin: 14,
      vitaminB6: 1.4,
      folate: 300,
      vitaminB12: 2,
      calcium: 900,
      iron: 15,
      potassium: 3500,
      magnesium: 310,
      phosphorus: 600,
      zinc: 8,
      selenium: 50,
      iodine: 150,
      copper: 0.9,
    },
    male: {
      vitaminA: 900,
      vitaminD: 20,
      vitaminE: 9,
      vitaminC: 75,
      vitaminB1: 1.2,
      vitaminB2: 1.5,
      niacin: 16,
      vitaminB6: 1.5,
      folate: 300,
      vitaminB12: 2,
      calcium: 900,
      iron: 9,
      potassium: 3500,
      magnesium: 350,
      phosphorus: 600,
      zinc: 11,
      selenium: 55,
      iodine: 150,
      copper: 0.9,
    },
  },
};

const OTHER_BY_BAND: Record<AgeBand, typeof HEALTH_DIRECTORATE_OTHER_DAILY> = {
  child: { fiber: 15, sodium: 2000, saturatedFat: 15 },
  teen: { fiber: 21, sodium: 2200, saturatedFat: 18 },
  adult: { ...HEALTH_DIRECTORATE_OTHER_DAILY },
  senior: { fiber: 25, sodium: 2400, saturatedFat: 20 },
};

function resolveSexKey(gender: MemberGender): SexKey | null {
  if (gender === "female" || gender === "male") return gender;
  return null;
}

export function resolveNutritionReferenceContext(
  birthDate: string,
  genderInput: unknown,
): NutritionReferenceContext {
  const gender = normalizeMemberGender(genderInput);
  const ageYears = parseMemberAgeYears(birthDate);
  const missingFields: NutritionReferenceMissingField[] = [];
  if (ageYears === null) missingFields.push("age");
  if (!gender) missingFields.push("gender");

  if (missingFields.length > 0) {
    return {
      isPersonalized: false,
      missingFields,
      ageYears,
      gender,
      profileLabel: null,
      micronutrientDaily: { ...HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY },
      otherDaily: { ...HEALTH_DIRECTORATE_OTHER_DAILY },
    };
  }

  const sex = resolveSexKey(gender)!;
  const band = ageBandFromYears(ageYears!);
  return {
    isPersonalized: true,
    missingFields: [],
    ageYears,
    gender,
    profileLabel: `${memberGenderLabel(gender)}, ${ageYears} år`,
    micronutrientDaily: { ...MICRONUTRIENT_BY_BAND_SEX[band][sex] },
    otherDaily: { ...OTHER_BY_BAND[band] },
  };
}

export function nutritionReferenceWarningMessage(missingFields: NutritionReferenceMissingField[]): string | null {
  if (!missingFields.length) return null;
  const parts: string[] = [];
  if (missingFields.includes("age")) parts.push("fødselsdato");
  if (missingFields.includes("gender")) parts.push("kjønn");
  const list =
    parts.length === 2 ? `${parts[0]} og ${parts[1]}` : parts[0] ?? "profildata";
  return `Mangler ${list} på kundekortet — referanseverdiene er generelle anbefalinger for voksne. Fyll inn under Rediger på kundekortet for personlige anbefalinger.`;
}

export function nutritionReferenceFootnote(context: NutritionReferenceContext): string {
  if (context.isPersonalized && context.profileLabel) {
    return `Referanser basert på ${context.profileLabel} (nordiske anbefalinger for vitaminer og mineraler).`;
  }
  return "Referanser er generelle daglige voksenverdier når alder eller kjønn mangler.";
}
