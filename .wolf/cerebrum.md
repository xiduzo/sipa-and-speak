# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-10

## User Preferences

- **Native styling: prefer NativeWind className over inline style objects.** Use token utilities (`text-foreground`, `bg-background`, `font-manrope-bold`, etc.) from `apps/native/global.css`. Reserve `style` prop only for runtime-dynamic values (pressed states, conditional `borderColor`). Never declare BG/INK/MUTED color constants when a design token class exists.

## Key Learnings

- **Project:** sip-and-speak
- **Description:** This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, TRPC, and more.
- **Auth:** `emailAndPassword` is disabled. The only auth mechanism is Better-Auth's `emailOTP` plugin. Both web and native auth clients already include `emailOTPClient()`.
- **heroui-native ButtonVariant:** Valid values are `primary | secondary | tertiary | outline | ghost | danger | danger-soft`. The values `"light"` and `"bordered"` used in index.tsx are type errors (pre-existing). Always use valid variants.
- **No test suite:** No test runner configured for apps. `packages/auth` now has Bun test set up (`bun test`). Write pure functions in packages to enable testing.
- **Navigation (native):** Only `app/index.tsx` and `app/_layout.tsx` exist. The `(drawer)` folder referenced in `_layout.tsx` does not yet exist — the app routes to `index.tsx` as the root.
- **Better-Auth emailOTP flow:** `sendVerificationOTP` callback is called AFTER OTP is stored in DB. Throwing an error in the callback returns the error to the client but leaves a dead OTP that expires naturally.

## User Preferences

- **Onboarding gates use React Native `Modal` components, not routes.** When a user must complete an action before accessing the app (e.g. identity setup), show a full-screen `Modal` (`presentationStyle="fullScreen"`) rather than redirecting to a route. The modal is controlled by query state — hides automatically when the condition is met.

- **Favour unified flows over separate screens for the same UX pattern.** When two user types (e.g. student vs alumni) share the same form + OTP flow, handle the distinction server-side (middleware / validation) rather than duplicating UI. Keep separate screens only when the UX genuinely diverges.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-04-12] Do not use `form.setFieldMeta()` for server-side errors in TanStack Form — this method doesn't exist. Use `useState` for server-side error state instead.
- [2026-04-12] Better-Auth `sendVerificationOTP` callback runs as a **background task** after the 200 response is already sent. Throwing inside it logs an error but does NOT gate the request. Domain validation MUST be done in a Hono middleware BEFORE the `app.on('/api/auth/*')` handler.
- [2026-04-12] For Better-Auth email OTP **sign-in** flow: use `authClient.signIn.emailOtp({ email, otp })` — NOT `authClient.emailOtp.verifyEmail()`. The `verifyEmail` method is only for `type: "email-verification"` (changing email). Using it for sign-in always returns 400.
- [2026-04-12] Do not use `variant="light"` or `variant="bordered"` in heroui-native Button — these are not in `ButtonVariant`. Use `"ghost"` for secondary/tertiary actions.
- [2026-04-12] `bun --hot` in `apps/server` does NOT watch workspace packages (`packages/api`, etc). After adding new tRPC procedures, the server must be manually restarted — otherwise clients get "No procedure found on path" even though the source is correct.
- [2026-04-20] **Expo Router route groups cannot be navigated to directly.** `router.replace("/(tabs)")` resolves to `sip-and-speak:///` (empty URL) → Unmatched Route. Always navigate to a concrete route: `router.replace("/(tabs)/suggestions")`.
- [2026-04-20] Expo Router AuthGuard: `router.replace()` in `useEffect` silently fails if the navigator isn't mounted yet. Always gate on `useRootNavigationState().key` before any navigation. Missing this causes persistent white screen on app start.
- [2026-04-20] `Stack.Screen` entries for non-existent route files cause `[Layout children]: No route named X exists` warnings in Expo Router SDK 55. Remove them — they serve no purpose without the corresponding file.
- [2026-04-20] UniWind does NOT process `className` on `SafeAreaView` from `react-native-safe-area-context` (third-party). This causes zero-height render — blank screen. Always use `View` + `useSafeAreaInsets()` instead. Also add `style={{ flex: 1 }}` inline alongside `className="flex-1"` as a safety net for any container where height is critical.
- [2026-04-20] Do NOT use `router.replace("/")` to navigate to `index.tsx` for onboarding — Expo Router does not reliably mount `index.tsx` when navigating to it programmatically from `_layout.tsx`. The screen may never render (no network requests made). Onboarding gates MUST use the `Modal` pattern (always-mounted component in `_layout.tsx`, controlled by query state). See `OnboardingModal` in `components/onboarding-modal.tsx`.
- [2026-04-20] `queryClient.clear()` MUST be called on sign-out AND on sign-in redirect. Without this, React Query cache from user A bleeds into user B's session — stale `onboardingStatus.complete = true` causes new users to skip onboarding entirely.

- **Web test framework:** `apps/web` now has Vitest + React Testing Library (`vitest.config.ts`, `vitest-setup.ts`). Run with `bun run --cwd apps/web test`. Route components use `vi.mock()` for `@tanstack/react-router`, `@tanstack/react-query`, and `@/utils/trpc`.
- **`Closes #N` in PR body only auto-closes issues on merge to default branch (main).** Task PRs merged to feature branches don't close issues — they close when the feature PR merges to main.
- **`userFlag.status` values:** "open" | "resolved" only. No `outcome` or `resolvedAt` columns until Features #32-#34.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
