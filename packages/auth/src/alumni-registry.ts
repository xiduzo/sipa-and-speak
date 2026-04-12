/**
 * Static TU/e alumni registry.
 * For this iteration, this is a hardcoded list of verified alumni email addresses.
 * Future iterations should replace this with a database or external API lookup.
 */
export const ALUMNI_REGISTRY: readonly string[] = [
  // Sample alumni entries — replace with actual verified alumni emails
  "j.doe@gmail.com",
  "a.smith@gmail.com",
  "m.van.den.berg@gmail.com",
];

/**
 * Checks whether the given email address appears in the TU/e alumni registry.
 * Comparison is case-insensitive and strips surrounding whitespace.
 */
export function isAlumniEmail(email: string): boolean {
  const lower = email.toLowerCase().trim();
  if (!lower) return false;
  return ALUMNI_REGISTRY.some((entry) => entry.toLowerCase() === lower);
}

export const ALUMNI_REGISTRY_ERROR =
  "Your email address was not found in the TU/e alumni registry. Please check your address or contact alumni@tue.nl for help.";

export const ALUMNI_REGISTRY_UNAVAILABLE_ERROR =
  "The alumni registry is temporarily unavailable. Please try again in a moment.";
