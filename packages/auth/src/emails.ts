import { render } from "emailmd";

/**
 * Shared Sip & Speak brand theme for all transactional emails.
 * The warm amber accent matches the web/native app palette (`#f99c00`),
 * set against a soft cream canvas with a white content card and rounded
 * corners so the messages feel like the app rather than a plain memo.
 *
 * emailmd converts the markdown templates below into email-safe HTML (via MJML)
 * that renders consistently across Gmail, Outlook, Apple Mail, etc.
 */
const brandTheme = {
  brandColor: "#f99c00",
  headingColor: "#1f1300",
  bodyColor: "#5b513f",
  backgroundColor: "#fdf6ec",
  contentColor: "#ffffff",
  cardColor: "#fff3e0",
  buttonColor: "#f99c00",
  buttonTextColor: "#ffffff",
  secondaryColor: "#fff3e0",
  secondaryTextColor: "#92400e",
  borderRadius: "16px",
  fontFamily: "'Poppins', 'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const;

/** Hosted brand font so the wordmark feels on-brand in clients that allow it. */
const brandFonts = {
  Poppins: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap",
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
preheader: "Your Sip & Speak verification code — expires in 10 minutes ☕"
---

::: header center color=#f99c00
**☕ Sip & Speak**
Conversations worth meeting for
:::

# Almost there — let's get you in

Pop the code below into your open Sip & Speak window and you're signed in.
No password to remember, no fuss.

::: highlight center bg=#fff3e0 border-radius=16px
Your verification code

# ${otp}

Valid for **10 minutes**
:::

::: callout compact
**Didn't request this?** No worries — just ignore this email and your
account stays locked down tight. The code only works in the window you
opened it from.
:::

See you soon — grab a drink, we'll do the talking. 🥂

::: footer center
**Sip & Speak** · Eindhoven, NL · Made with ☕ in Brabant
[${SUPPORT_EMAIL}](mailto:${SUPPORT_EMAIL}) · [sipandspeak.nl](${SITE_URL})
:::
`;

  const { html, text } = await render(markdown, {
    theme: brandTheme,
    fonts: brandFonts,
  });

  return {
    subject: "Your Sip & Speak verification code",
    html,
    text,
  };
}
