export const INTERNAL_API_VERSION = "1000-ojos.field.v1";

export const INTERNAL_API_SOURCE_LABELS = {
  fieldEvidence: {
    statuses: ["field-evidence-pending-review"],
    role: "1000 Ojos observations are field evidence pending authorized human review.",
  },
} as const;

export const INTERNAL_API_CAVEATS = [
  "Field observations are not structural diagnoses, habitability decisions, or official triage.",
  "Absence of an observation must not be interpreted as absence of damage.",
  "Only an authorized human reviewer may approve, correct, or reject a submitted record.",
] as const;
