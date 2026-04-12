# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-10

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

## Key Learnings

- **Project:** sip-and-speak
- **Description:** This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, TRPC, and more.
- **Auth:** `emailAndPassword` is disabled. The only auth mechanism is Better-Auth's `emailOTP` plugin. Both web and native auth clients already include `emailOTPClient()`.
- **heroui-native ButtonVariant:** Valid values are `primary | secondary | tertiary | outline | ghost | danger | danger-soft`. The values `"light"` and `"bordered"` used in index.tsx are type errors (pre-existing). Always use valid variants.
- **No test suite:** No test runner configured for apps. `packages/auth` now has Bun test set up (`bun test`). Write pure functions in packages to enable testing.
- **Navigation (native):** Only `app/index.tsx` and `app/_layout.tsx` exist. The `(drawer)` folder referenced in `_layout.tsx` does not yet exist — the app routes to `index.tsx` as the root.
- **Better-Auth emailOTP flow:** `sendVerificationOTP` callback is called AFTER OTP is stored in DB. Throwing an error in the callback returns the error to the client but leaves a dead OTP that expires naturally.

## User Preferences

- **Favour unified flows over separate screens for the same UX pattern.** When two user types (e.g. student vs alumni) share the same form + OTP flow, handle the distinction server-side (middleware / validation) rather than duplicating UI. Keep separate screens only when the UX genuinely diverges.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-04-12] Do not use `form.setFieldMeta()` for server-side errors in TanStack Form — this method doesn't exist. Use `useState` for server-side error state instead.
- [2026-04-12] Better-Auth `sendVerificationOTP` callback runs as a **background task** after the 200 response is already sent. Throwing inside it logs an error but does NOT gate the request. Domain validation MUST be done in a Hono middleware BEFORE the `app.on('/api/auth/*')` handler.
- [2026-04-12] For Better-Auth email OTP **sign-in** flow: use `authClient.signIn.emailOtp({ email, otp })` — NOT `authClient.emailOtp.verifyEmail()`. The `verifyEmail` method is only for `type: "email-verification"` (changing email). Using it for sign-in always returns 400.
- [2026-04-12] Do not use `variant="light"` or `variant="bordered"` in heroui-native Button — these are not in `ButtonVariant`. Use `"ghost"` for secondary/tertiary actions.
- [2026-04-12] `bun --hot` in `apps/server` does NOT watch workspace packages (`packages/api`, etc). After adding new tRPC procedures, the server must be manually restarted — otherwise clients get "No procedure found on path" even though the source is correct.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
