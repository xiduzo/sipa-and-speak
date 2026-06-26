# Bug hunt — plan of attack

Scan date: 2026-06-25. 4 parallel agents across web / native / db / api. Only confirmed bugs listed (speculative items dropped).

---

## P0 — Critical (security / auth / data-deletion). Fix immediately.

### 1. Hardcoded email OTP — full auth bypass
- **`packages/auth/src/index.ts:96`** — `generateOTP: () => "310394"`. No env/dev gate. Any account: request OTP for any email → sign in with `310394`. Also `console.log`s every OTP (line 99). **VERIFIED.**
- Fix: remove override (let better-auth generate random OTP); drop the unconditional OTP log or gate behind `__DEV__`.

### 2. Account deletion fails for any user who left a comment
- **`packages/db/src/schema/moderation.ts:17-19`** — `student_comment.author_id` is `.notNull()` but FK uses `onDelete: "set null"`. Deleting such a user → Postgres tries `SET NULL` on NOT NULL col → whole `DELETE user` aborts. Breaks GDPR account-deletion. Test only checks `onDelete`, not nullability, so it passes.
- Fix: drop `.notNull()` on `authorId` + migration `ALTER COLUMN author_id DROP NOT NULL`.

---

## P1 — High (broken access control / broken core flows).

### 3. Venue admin router unprotected
- **`packages/api/src/contexts/scheduling/venue-admin.ts:22-142`** — create/update/deactivate/reactivate use plain `protectedProcedure`. Any logged-in student can mutate global venue catalog. Fix: require admin/moderator role.

### 4. Moderation actions unprotected
- **`packages/api/src/contexts/moderation/moderation.ts:41,111,169,231,273`** — `warnStudent`/`suspendStudent`/`liftSuspension`/`removeStudent`/`listOpenFlags` have no moderator gate. Any user can suspend/remove anyone. (Known TODO, but live hole.) Fix: moderator-role procedure.

### 5. startConversation bypasses messaging consent
- **`packages/api/src/contexts/conversation/chat.ts:159`** — no match/opt-in check; any user can open a conversation + inject greeting to any `partnerId`, bypassing post-meetup consent flow. Fix: verify caller is matched/connected with partner.

### 6. match_accepted push → dead route
- **`apps/native/hooks/use-notification-tap-handler.ts:14`** — taps `match_accepted` push → `router.push('/schedule/<id>')` but no `/schedule/[id]` route exists → not-found screen at the key conversion moment. Test only asserts push string, so green. Fix: route to existing propose-meetup flow.

### 7. dev-users seed crashes on bad import
- **`packages/db/src/seed/dev-users.ts:33`** — imports `"../schema/sip-and-speak"` (nonexistent). Seed cannot run. Fix: import `"../schema"`.

---

## P2 — Medium (correctness, partial writes, stale data).

### 8. Removed (banned) students still appear in discovery
- **`packages/api/src/contexts/matching/matching.ts:94`** — filter `ne(studentStatus,"suspended")` only. Fix: `notInArray(studentStatus,["suspended","removed"])`.

### 9. reportAttendance — non-transactional multi-write
- **`packages/api/src/contexts/scheduling/meetup.ts:886-904`** — report insert + meetup status + match promotion not wrapped. Mid-failure → inconsistent state. Fix: `db.transaction`.

### 10. acceptMatchRequest — non-transactional
- **`packages/api/src/contexts/matching/matching.ts:489-498`** — request status update + match insert not atomic → orphan/missing match. Fix: `db.transaction`.

### 11. Chat read-state invalidation is a no-op
- **`apps/native/app/chat/[conversationId].tsx:76`** — `invalidateQueries({queryKey:["chat.getMessages"]})` hand-written key never matches real tRPC key → silent no-op (masked by 5s poll). Fix: use `trpc.chat.getMessages.queryKey()`.

### 12. Web admin venues — hardcoded coordinates
- **`apps/web/src/routes/admin/locations.tsx:110-111`** — every new venue gets `lat 51.4483, long 5.4903`. All collide → distance/map logic wrong. Fix: add coord inputs or geocode.

### 13. dev-users seed not idempotent (messages)
- **`packages/db/src/seed/dev-users.ts:277-284`** — message insert has no `.onConflictDoNothing()` + random UUIDs → 6 dup messages per re-run. Fix: top-of-fn guard or onConflict.

### 14. Suggestions card full-page reload
- **`apps/web/src/routes/suggestions.tsx:34-37`** — raw `<a href>` instead of TanStack `Link` → full reload, loses SPA state. Fix: `<Link to>`.

---

## P3 — Low (hygiene, edge cases, leaks).

- **`packages/notifications/src/delivery.ts:24-35`** — `ExpoPushDelivery.send` never checks `response.ok` → swallows push failures, skips stale-token cleanup. Fix: check `response.ok`.
- **`packages/api/src/contexts/conversation/messaging.ts:318`** — `setPresence` no participant check; user can write presence to arbitrary conversations. Fix: verify participation.
- **`apps/web/src/routes/suggestions.tsx:109-117`** — `handleWebShare` async onClick, no try/catch → unhandled rejection on share dismiss (AbortError). Fix: wrap, ignore AbortError.
- **`apps/web/src/routes/dashboard.tsx:29`** — `console.log` of subscription data in prod. Remove.
- **`apps/web/src/routes/dashboard.tsx:28`** — misplaced `!` on optional chain (type lie). Fix: `(...?.length ?? 0) > 0`.
- **`apps/native/app/_layout.tsx:153-175`** — AuthGuard `console.log`s full auth/session state every render in prod. Gate behind `__DEV__`.
- **`apps/native/components/meetup-flow-modal.tsx:922`** — reschedule picker seeds Date in runtime tz vs device tz. Edge inconsistency. Fix: use device-tz helper.
- **`packages/db/src/schema/moderation.ts:38,41`** — `blocked_email.email` has redundant `.unique()` + `uniqueIndex`. Drop one.
- **`packages/db/src/migrations/0002_thick_the_call.sql`** — orphaned migration not in `_journal.json`. Delete.

---

## Suggested execution order

1. **P0 batch** (#1, #2) — independent files, ship today. Auth file + db schema/migration.
2. **P1 access-control batch** (#3, #4, #5) — all api authorization gates; likely share a role-check helper → do together. Then #6 (native route), #7 (seed import, trivial).
3. **P2 transactions** (#9, #10) together; #8 + #11–14 independent, parallel-safe.
4. **P3** — sweep in one cleanup PR.

Each item = candidate `wtf.write-task`. P0/P1 should become tracked issues before fixing.
