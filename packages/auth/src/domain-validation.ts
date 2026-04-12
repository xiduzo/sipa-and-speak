export const TUE_DOMAINS = ["@student.tue.nl", "@tue.nl"] as const;

export function validateTueDomain(email: string): boolean {
  const lower = email.toLowerCase().trim();
  return TUE_DOMAINS.some((domain) => lower.endsWith(domain));
}

export const TUE_DOMAIN_ERROR =
  "Only TU/e institutional email addresses (@student.tue.nl or @tue.nl) are accepted. Please use your TU/e email to enrol.";
