# Sip & Speak — Open Tasks from "Documentation S&S.xlsx"

Audited 2026-06-06 against the codebase (`apps/native`, `packages/api`, `packages/db`, `packages/notifications`).
Source: `~/Downloads/Documentation S&S.xlsx` (sheet "Overview", 36 items + Charlotte's feedback).

**Legend** — `NOT` not built · `BUG` built but broken · `PARTIAL` half-built / wrong surface · `Q` product decision needed · `DONE` already implemented.

---

## A. Bugs — built but broken (quick wins)

1. **`BUG` Chat "chat not available" after both press keep-in-touch.**
   Once both opt in, the server replaces the locked entry with an open conversation, so `chat.listEntries` drops the locked entry and the locked screen's `entry` becomes `undefined` → renders "Chat not available" until manual re-enter.
   `apps/native/app/chat/locked/[meetupId].tsx:83-126` · `packages/api/src/contexts/conversation/chat.ts:397-398`.
   Fix: on `respondToOptIn` success, navigate to the new open conversation instead of only invalidating.
   ✅ **Fixed 2026-06-06:** `respondToOptIn` now returns `conversationId` when both accept (looks up the existing convo if a concurrent accept won the race); locked screen `router.replace`s into `/chat/{id}` on success. `messaging.ts:89-200` · `[meetupId].tsx:88-100`. Server tests green.

2. **`BUG` Duplicate "(tabs)" back arrow in chat header.**
   Native Stack header renders on top of the screen's own custom back button.
   `apps/native/app/_layout.tsx:190` — `chat/[conversationId]` is missing `headerShown: false` (the sibling locked route at `:191` already has it). One-line fix.
   ✅ **Fixed 2026-06-06:** set `headerShown: false` on `chat/[conversationId]` (it renders its own back button at `[conversationId].tsx:157`). `_layout.tsx:190`.

3. **`BUG` "Report attendance" button in chat is a no-op.**
   In the locked chat the CTA only does `router.push("/(tabs)/confirmed-meetups")` — no mutation.
   `apps/native/app/chat/locked/[meetupId].tsx:38,132-138`. Should call `meetup.reportAttendance` like the meet-ups tab does (`confirmed-meetups.tsx:450-460`).
   ✅ **Fixed 2026-06-06:** the `awaiting_attendance` phase now renders real "We met up" / "We didn't" buttons that call `meetup.reportAttendance` ({meetupId, attended}) and invalidate listEntries + getConfirmed. `[meetupId].tsx`. (Re-schedule on "We didn't" is still the separate task #27.)

4. **`BUG` No chats badge to suggest keep-in-touch.** (Charlotte, 16 May)
   Badge counts only unread messages in open conversations; ignores locked entries awaiting *your* opt-in.
   `apps/native/app/(tabs)/_layout.tsx:33-35`. Fix: also count `kind === "locked" && phase === "awaiting_my_optin"`.
   ✅ **Fixed 2026-06-06:** chats badge now counts open-unread **plus** locked entries in `awaiting_my_optin`. `(tabs)/_layout.tsx:33-37`.

---

## B. Not implemented — net-new build

5. **`NOT` Delete account / profile.** No mutation anywhere; profile modal offers only Sign out. FKs already cascade. Add `deleteAccount` in `packages/api/.../identity/profile.ts` + button in `apps/native/components/profile-modal.tsx`. (Charlotte)
   ✅ **Done 2026-06-06:** added `profile.deleteAccount` (hard delete; all 25 user-FKs verified cascade/set-null) + a destructive "Delete account" button under Sign out that clears cache → signs out → AuthGuard routes to `/enrolment`. `profile.ts` · `profile-modal.tsx`.

6. **`NOT` Preferred time slots + meetup-suggestion cross-check.** No time-slot field in schema. Meetup suggestions are **hardcoded** ("10:30/14:00/15:00") in `apps/native/components/meetup-flow-modal.tsx:60-73`. Current only "cross-check" is confirmed-meetup collision avoidance (`meetup.ts:465-488`), not preference matching. (Charlotte)
   ⏸ **Deferred 2026-06-06:** explicitly excluded from the section-B build per request (needs a schema + suggestion-algorithm change — larger than the rest of the cluster).

7. **`NOT` Unmatch user** (button + confirm dialog + disclaimer + exclude from discover). No unmatch procedure in the matching router; `"voided"` status exists in schema (`packages/db/.../matching.ts:23`) but is never written. Discover only excludes pending/accepted requests + suspended users.
   ✅ **Done 2026-06-06:** added `matching.unmatch({partnerId})` — voids the accepted request + drops the `studentMatch` row; discover now also excludes `"voided"` so the pair isn't re-suggested. Surfaced as an "Unmatch" action on the partner profile (confirm + disclaimer). `matching.ts` · `partner/[id].tsx`.

8. **`NOT` Withdraw / cancel a sent invitation.** No outgoing-requests UI and no withdraw mutation.
   ✅ **Done 2026-06-06:** added `matching.getOutgoingRequests` + `matching.withdrawMatchRequest` (hard-deletes the pending request so it fully reverses). Surfaced in the new "Invitations sent" section on the Matches tab with a Withdraw button. `matching.ts` · `matches.tsx`.

9. **`NOT` Matches tab restructure.** Spec wants 3 sections — (1) invitations sent, (2) invitations received, (3) matches — plus "pending matches" and a "schedule a new moment" action in the matches section. Current `matches.tsx` has only RECEIVED requests + NEW-THIS-WEEK/EVERYONE; no outgoing query exists.
   ✅ **Done 2026-06-06:** restructured into **Invitations sent** (withdraw), **Invitations received** (relabelled, accept/decline), and **Matches** with a "Schedule a new moment" CTA → discover deck. `matches.tsx` (+ new `matches-sections.test.tsx`).

10. **`NOT` Send-proposal + unmatch buttons on the partner profile reached from matches.** `apps/native/app/partner/[id].tsx` has only back + report/safety buttons. The "nothing-queued" gating logic exists server-side (`matching.ts:512-535`) and a propose CTA exists — but on **Home** (`hero-matchfound.tsx:56-62`), not the profile.
   ✅ **Done 2026-06-06:** partner profile now shows a context-aware footer — when matched (`getMatchRequestStatus === "accepted"`), a "Propose a meet-up" button (→ `/propose-meetup`) + "Unmatch". Suppressed in the incoming-request context. `partner/[id].tsx` (+ `partner-profile.test.tsx` #10 block).

11. **`NOT` Tap partner photo → open profile (from match deck).** (Charlotte, 16 May) The card `Image` is bare, no `onPress`. `partner/[id].tsx` exists but is unreachable from the deck (the wiring lives only in dead `candidate-card.tsx`). `apps/native/components/match-card.tsx:90-101`.
   ✅ **Done 2026-06-06:** the deck card photo + name are now `Pressable` → `router.push("/partner/[id]")`. `match-card.tsx`.

12. **`NOT` (real) Matching percentage.** `score` is only ever `1.0` (zeros filtered out), so every card shows **100%**. `match-card.tsx:56,243-250` · `matching-utils.ts:10-29,91`. Either compute a gradient or drop the "%". (Charlotte asked "based on what?")
   ✅ **Done 2026-06-06 (decided: drop):** removed the `{matchPct}%` chip from the "MATCHING IN" band; the band keeps the overlapping-languages chips. `match-card.tsx`.

13. **`NOT` Swipe gestures on the discover deck.** Deck advances by buttons only (×/←/"Say hoi"); zero gesture code in the app. `apps/native/app/match.tsx:204-210`. (Spec says "swipe through people like cards" — confirm whether buttons are acceptable.)
   ✅ **Done 2026-06-06 (decided: swipe-only):** card is now drag-to-skip / drag-to-say-hoi via `PanResponder` (RN core — no new native deps) with LIKE/SKIP overlays + rotation; removed the ×/← buttons, kept the "Say hoi" confirm. Added `accessibilityActions` (skip/invite) for screen-reader users. `match-card.tsx` · `match.tsx` (+ rewritten `match-deck-navigation.test.tsx`).

26. **`NOT` (decided) Rename "partner" → "buddy" in all user-facing copy.** Sweep visible strings across `apps/native` (e.g. `match-card.tsx` "waiting for your partner", `hero-matchfound.tsx`, propose/unmatch dialogs, "awaiting a response from your partner"). Keep code identifiers (`/partner/[id]` route, `getPartnerProfile`) unchanged.
   ✅ **Done 2026-06-06:** swept 8 user-facing strings across 7 files ("Find/Pick a buddy", "Browse buddies", "waiting on buddy", "sent to your buddy", "So your buddy can spot you…", propose fallback). Code identifiers + `{partnerName}` interpolations left intact. `hero-nomeetup.tsx` · `secondary-card.tsx` · `onboarding-modal.tsx` · `index.tsx` · `meetup-flow-modal.tsx` · `locked/[meetupId].tsx` · `propose-meetup.tsx`.

27. **`NOT` (decided) "Didn't meet" → re-schedule flow.** Today "We didn't" just sets `not_attended` (`confirmed-meetups.tsx:463`, `meetup.reportAttendance`). New: after reporting not-met, prompt the user to propose a meetup again (re-open the propose-meetup modal). Server already permits re-propose once a meetup is not `pending` (`meetup.ts:124-135`). Apply on all three report surfaces: meet-ups tab, Home card (#14), and the locked-chat report path (#A3).
   ✅ **Done 2026-06-06:** after a "We didn't" report, all three surfaces now prompt "Want to set up another moment with {name}?" → re-opens the propose flow (Meet-ups tab + Home via `setMeetupModal`; locked chat via `/propose-meetup`). No server change (re-propose already allowed once a meetup isn't `pending`). `confirmed-meetups.tsx` · `hero-post.tsx` + `home.tsx` · `locked/[meetupId].tsx`.

---

## C. Partial / inconsistent — finish the migration

14. **`PARTIAL` Replace emoji rating with "did your meet-up take place?"** The NEW card ("We met up" / "We didn't") is live **only** in the meet-ups tab (`confirmed-meetups.tsx:446-463`). The **Home** screen still runs the OLD emoji rating "How was {partner}?" (`apps/native/components/home/hero-post.tsx:156-200`, `secondary-card.tsx:17`). Migrate Home to the new flow.

15. **`PARTIAL` "We met up" → status dialog.** Meet-ups tab shows a static label "You reported attending this meetup" (`confirmed-meetups.tsx:476`) — not the specified popup "you reported attending this meetup, wait for … to respond". Add the dialog + "wait for {partner}" wording.

16. **`PARTIAL` Keep-in-touch card copy + routing.** Opt-in works end-to-end (chats tab + locked screen, optional review). Gaps: Home tile is "STAY IN TOUCH? / Chat with {X} 🔒" not "would you like to chat and keep in touch"; waiting copy is "waiting on {X}" not "waiting for … to enable chatting"; no explicit yes/no popup. `hero-post.tsx`, `chats.tsx:77-80`.

17. **`PARTIAL` "Stay in touch? Chat with …" should route to chats.** On Home the tile fires `respondToOptIn` (opt-in) instead of navigating; only the later "UNLOCKED" tile routes to `/chat/{id}`. `hero-post.tsx:84-108`. (Chats-tab rows already route correctly.)

18. **`PARTIAL` Match-card bottom half shows "YOU SPEAK" (your own language).** (Charlotte, 16 May — "not very useful") `match-card.tsx:280-296`. Redesign to show partner-relevant info.

19. **`PARTIAL`/`Q` Chat unlock "2h → 30min".** No 2-hour constant exists; unlock is **phase-based** with a 0-minute offset (`messaging-utils.ts:89-108`, gate at `:99`). Nothing to change from 2h→30min literally. Decide: add a 30-min grace buffer after `meetupAt`, or leave phase-based.

---

## D. Product questions — decide before building

20. **`DECIDED — leave as is`** Matching algorithm stays unchanged: pairs you with anyone who *speaks* your learning language at any level (proficiency ignored), not native-only. No code change. `matching-utils.ts:10-29`.

21. **`DONE (decided + applied)` Venue list = List A only.** Kept `seed/venues.ts` (the 4 spec venues, auto-seeded on `migrate.ts:27`): Atlas - Brownies & Downies (TU/e) · Metaforum - Cafeteria (TU/e) · Auditorium - Cafeteria (TU/e) · Neuron - Terrace Cafeteria (TU/e). **Deleted** `seed/tue-locations.ts` and removed the `db:seed:tue-locations` script from `packages/db/package.json` — removes the conflicting near-duplicate venues. ⚠️ Any DB where the manual script already ran may hold the 3 stray rows (Metaforum Cantine / Atlas Brownies&Downies / Atlas Coffee&Co). Run the one-off cleanup to purge them: `bun run db:cleanup:stray-venues` (in `packages/db`). It's idempotent and skips any stray still referenced by a meetup (`meetup.venueId` is a RESTRICT FK). Script: `packages/db/src/seed/cleanup-stray-venues.ts`.

22. **`Q` Login is email-OTP-only** — `emailAndPassword.enabled=false` (`auth/index.ts:60`), sign-in via one-time code (`emailOTP`, `:91`), restricted to TU/e domains (`domain-validation.ts`). Alumni concern: a graduate whose @student.tue.nl is disabled can't receive the OTP → locked out. PARTIAL mechanism already scaffolded: `auth/alumni-registry.ts` allows specific non-TU/e emails (e.g. personal Gmail) to pass the domain check — but it's a **hardcoded stub of 3 placeholder addresses** with a TODO to become a real DB/API lookup. Decide: make the alumni registry real (DB/admin/self-service), add a user-set recovery email, or scope alumni out. (See chat explanation.)

23. **`DECIDED — use "buddy"`** Replace user-facing "partner" copy with **"buddy"** across the native app. → moved to build task **#26**. (Code identifiers like the `/partner/[id]` route + `getPartnerProfile` can stay; only visible strings change.)

24. **`DECIDED — design re-schedule flow`** "Didn't meet" path: after a user reports "we didn't meet", let them try scheduling a meetup again. → moved to build task **#27**.

25. **`Q` Onboarding "Pulled from TU/e" subtitle is misleading** — the name field is free-text, not seeded from TU/e (`onboarding-modal.tsx:99` vs free TextInput). Reword or actually seed.

---

## E. Already implemented — for reference (no action)

- Onboarding: first+last name, optional skippable photo, edit later, languages **with proficiency level**, learning languages, topics (min 3), back/forward nav, "add at least one language" error. (`onboarding-modal.tsx`)
- Profile auto-saves (no save button); removing a language re-syncs eligibility and discover drops those matches on next fetch. (`profile-modal.tsx`, `profile.ts:529-553`)
- Matching enforces mutual benefit (both learn same language OR you learn their spoken language); zero-score pairs filtered out. (`matching-utils.ts`)
- Propose + counter-propose, 5/5 rounds, receiver decline at round 5 with "oops … propose again" popup + push to BOTH users, re-propose allowed after decline. (`meetup.ts`, `meetup-aggregate.ts`, `meetup-flow-modal.tsx:524-528`)
- Keep-in-touch opt-in end-to-end; review is optional. (`messaging.ts`, `chats.tsx`)
- Push notifications for receiver of match request / proposal / counter-proposal — fully wired to Expo. (`packages/notifications/builders.ts`, `dispatcher.ts`, `apps/server/src/index.ts:18`)
- In-app badges on Matches + Meet-ups tabs (action-required). (`(tabs)/_layout.tsx`)
- "Invitation sent!" dialog (on the discover deck). (`match-card.tsx:66-69`)
