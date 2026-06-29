import { render } from "emailmd";

/**
 * Shared Sip & Speak brand theme for all transactional emails.
 * The warm amber accent matches the web/native app palette (`#f99c00`).
 *
 * emailmd converts the markdown templates below into email-safe HTML (via MJML)
 * that renders consistently across Gmail, Outlook, Apple Mail, etc.
 */
const brandTheme = {
  brandColor: "#f99c00",
  buttonColor: "#f99c00",
  buttonTextColor: "#ffffff",
} as const;

const SUPPORT_EMAIL = "hello@sipandspeak.nl";
const SITE_URL = "https://sipandspeak.nl";

export interface RenderedEmail {
  subject: string;
  /** Complete HTML document for the `text/html` MIME part. */
  html: string;
  /** Plain-text fallback for the `text/plain` MIME part. */
  text: string;
}

/**
 * Branded sign-in / verification email containing the one-time code.
 *
 * The OTP is numeric and rendered server-side, so direct interpolation into the
 * markdown is safe (no untrusted user input).
 */
export async function renderVerificationOtpEmail(otp: string): Promise<RenderedEmail> {
  const markdown = `---
preheader: "Your Sip & Speak verification code — expires in 10 minutes"
---

::: header center color=#f99c00
**Sip & Speak**
:::

# Your verification code

Enter the code below in your open Sip & Speak window to finish signing in.

::: callout center compact
# ${otp}
:::

This code expires in **10 minutes**. If you didn't try to sign in, you can
safely ignore this email — your account stays secure.

::: footer center
Sip & Speak · Eindhoven, NL
[${SUPPORT_EMAIL}](mailto:${SUPPORT_EMAIL}) · [sipandspeak.nl](${SITE_URL})
:::
`;

  const { html, text } = await render(markdown, { theme: brandTheme });

  return {
    subject: "Your Sip & Speak verification code",
    html,
    text,
  };
}
