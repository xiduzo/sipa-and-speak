import { Polar } from "@polar-sh/sdk";
import { env } from "@sip-and-speak/env/server";

// Polar processes member email+name (see customers.create in ../index.ts).
// It is NOT yet listed on the Privacy Statement because it runs in `sandbox`
// (no production member data). It MUST be added as a sub-processor (US, SCCs,
// GDPR Art. 46) on /privacy — and to docs/legal/sub-processor-audit.md — before
// Polar is enabled in production (i.e. before this `server` flips off "sandbox").
export const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: "sandbox",
});
