import { normalizeMemberEmail } from "./memberEmailQueries.ts";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function isSharedMedlem(customerType: unknown): boolean {
  return normalizeString(customerType).toLowerCase() === "medlem";
}

export type NutritionFanoutMemberRow = {
  id?: string | null;
  email?: string | null;
  owner_user_id?: string | null;
  customer_type?: string | null;
};

/**
 * Nutrition access must only fan out to rows the trainer can edit:
 * shared Medlem roster rows, ownerless legacy rows, or rows owned by the trainer.
 * Matching on email alone would let any trainer toggle nutrition for another PT's customers.
 */
export function filterTrainerNutritionFanoutMemberIds(
  rows: NutritionFanoutMemberRow[] | null | undefined,
  emailSet: Iterable<string>,
  trainerUserId: string,
): string[] {
  const trainerId = normalizeString(trainerUserId);
  if (!trainerId) return [];

  const allowedEmails = new Set(
    [...emailSet].map((value) => normalizeMemberEmail(value)).filter((value) => value.includes("@")),
  );
  if (!allowedEmails.size) return [];

  return Array.from(
    new Set(
      (rows ?? [])
        .filter((row) => {
          const rowEmail = normalizeMemberEmail(row.email);
          if (!rowEmail || !allowedEmails.has(rowEmail)) return false;
          if (isSharedMedlem(row.customer_type)) return true;
          const ownerUserId = normalizeString(row.owner_user_id);
          if (!ownerUserId) return true;
          return ownerUserId === trainerId;
        })
        .map((row) => normalizeString(row.id))
        .filter(Boolean),
    ),
  );
}
