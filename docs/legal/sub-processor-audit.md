# Sub-processor audit — member personal data

**Owner:** Sander (xiduzo), solo PO / controller contact `hello@sipandspeak.nl`
**Last updated:** 25 June 2026
**Task:** #458 (Feature #437 — Privacy Statement) · **Underpins AC3** (the statement names every processor).

## Purpose

A confirmed, code-derived list of every external service that receives a member's
personal data, so the Privacy Statement (`apps/web/src/routes/privacy.tsx`) can be
truthful and complete. If a service here is not named on `/privacy`, members are
misled about who handles their data. Keep this file and `privacy.tsx` in sync; this
is the baseline the content tasks (#459/#460) consume.

> Method: walked the auth, web sign-in, native push, payments and monitoring
> integrations in the codebase (June 2026). Each row is backed by a real call site.

## Confirmed processors (named in `/privacy`)

| Service | Data shared | Purpose | Location | Transfer safeguard | Code evidence |
| ------- | ----------- | ------- | -------- | ------------------ | ------------- |
| **Resend** | Member email address | Sends one-time sign-in (OTP) codes and account emails | United States (outside EEA) | SCCs (GDPR Art. 46) | `packages/auth/src/index.ts` — `emailOTP.sendVerificationOTP` → `resend.emails.send({ from: env.RESEND_FROM, to: email, ... })`; client init `new Resend(env.RESEND_API_KEY)`. Triggered from `apps/web/src/components/sign-in-form.tsx` (`authClient.emailOtp.sendVerificationOtp`). |
| **Expo** (Expo Push / EAS) | Device Expo push token + notification content | Delivers push notifications | United States (outside EEA) | SCCs (GDPR Art. 46) | `apps/native/lib/notifications.ts` — `getExpoPushTokenAsync({ projectId })`; registered in `apps/native/app/_layout.tsx` (`useDeviceTokenRegistration` → `trpc.profile.registerDeviceToken`). |
| **Apple APNs** | Device push token | Underlying iOS push delivery (behind Expo) | United States (outside EEA) | SCCs (GDPR Art. 46) | Same push chain as Expo (iOS leg). Named on `/privacy` as "Apple … push services". |
| **Google FCM** | Device push token | Underlying Android push delivery (behind Expo) | United States (outside EEA) | SCCs (GDPR Art. 46) | Same push chain as Expo (Android leg). Named on `/privacy` as "Google … push services". |
| **Own server (hosting)** | All member data (email, name, profile, app content) | Primary hosting / database | Netherlands (EEA) | N/A — data stays in the EEA | Self-hosted (Dokploy). Stated on `/privacy`: "stored on our own server in the Netherlands". |

## Flagged — processors that receive member data but are NOT yet named on `/privacy`

These are out of the literal task scope (email/push/hosting) but the audit invariant
is "every external service that receives member data must appear in the audit list".
They are flagged here for the content tasks (#459/#460) to decide on, not fixed here.

| Service | Data shared | Purpose | Location | Transfer safeguard | Code evidence | Action |
| ------- | ----------- | ------- | -------- | ------------------ | ------------- | ------ |
| **Polar** | Member email + name | Payments / customer record (created on user sign-up) | United States (outside EEA) | SCCs (GDPR Art. 46) | `packages/auth/src/lib/payments.ts` (`new Polar({ accessToken, server: "sandbox" })`); `packages/auth/src/index.ts` user-create hook → `polarClient.customers.create({ email: user.email, name: user.name })`. | **DECISION (#460, PO-settled):** do NOT name Polar on `/privacy` now — it runs in `server: "sandbox"` and is not processing production member data. **BEFORE GO-LIVE:** Polar MUST be added as a sub-processor (US, SCCs, GDPR Art. 46) to `/privacy` before it is enabled in production (before `server` flips off `"sandbox"`). A matching code comment guards the call sites in `payments.ts` and `index.ts`. |
| **Sentry** | Crash/error events (may incidentally include device/user context) | Error & performance monitoring (native app) | EU region — `ingest.de.sentry.io` (Germany, EEA) | N/A — EU data residency | `apps/native/lib/sentry.ts` — `Sentry.init({ dsn: "https://…@o…ingest.de.sentry.io/…" })`. | **FLAG (minor):** EU-hosted so no transfer concern; consider naming for completeness. |

## Notes

- No analytics, tracking, or marketing-email provider is used (confirmed: no such
  integration in the codebase; `/privacy` already states this).
- Content-drift control: this file plus the "last updated" date and named owner on
  `/privacy` are the discipline that keeps the processor list truthful. Update both
  whenever a processor is added, removed, or changes region.
