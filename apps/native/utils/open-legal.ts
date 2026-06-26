import { Linking } from "react-native";

/** Canonical origin for the public Sip&Speak legal pages. */
export const LEGAL_BASE_URL = "https://sipandspeak.nl";

/**
 * Open a legal document (e.g. "/terms", "/community-code", "/privacy") in the
 * device's default browser.
 *
 * Best-effort by design: a missing browser/link handler, a rejected open, or an
 * offline target page must never throw, crash the app, or block the enrolment
 * (email / OTP) sign-up flow. The canonical `https://sipandspeak.nl/<path>` URL
 * is always handed to the OS unchanged, so the browser opens at the correct
 * address even when the page itself is unreachable.
 */
export async function openLegal(path: string): Promise<void> {
  const url = `${LEGAL_BASE_URL}${path}`;
  try {
    await Linking.openURL(url);
  } catch {
    // Swallow: opening external reference content is non-critical and must not
    // surface as an unhandled rejection or interrupt sign-up. No app state
    // changes on failure — the prospective member stays on the enrolment screen.
  }
}
