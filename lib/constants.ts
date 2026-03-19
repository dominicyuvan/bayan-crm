export const SOURCE_OPTIONS = [
  "Walk In",
  "Exhibition",
  "Instagram",
  "Advertisement",
  "Call",
  "Other",
] as const;

export type ContactSource = typeof SOURCE_OPTIONS[number];
