# GitHub Issues — Bug plan of attack

Source: open `bug`-labeled issues in `xiduzo/sipa-and-speak`. Scan date 2026-06-25.
8 open bugs. No formal dependency edges (`gh issue-dependency` empty for all). Ordering driven by **file conflicts** + severity.

---

## The 8 bugs

| # | Title | Severity | Primary files |
|---|-------|----------|---------------|
| 447 | Deleted member's profile still appears (hard delete, no soft-delete) | High (privacy/data) | `packages/api/.../matching/matching.ts`, `packages/db/.../schema/conversation.ts`, `packages/api/.../scheduling/meetup.ts` |
| 446 | Deleting account mid-meetup doesn't cancel/notify partner | High (data integrity, GDPR) | `deleteAccount` mutation, meetup schema cascade, `scheduling/meetup.ts` |
| 422 | Unread indicators don't clear after opening chat | Medium | `chat/[conversationId].tsx`, `(tabs)/chats.tsx`, `(tabs)/_layout.tsx` |
| 444 | Sent messages take ~5s to appear (no optimistic update) | Medium | `chat/[conversationId].tsx` (~101, 123-131) |
| 443 | Conversation ⓘ button does nothing (no onPress) | Medium | `chat/[conversationId].tsx` (185-191), `chat/locked/[meetupId].tsx:188` |
| 441 | Profile language removal can empty a category (no min-1 guard) | Medium | profile editor + language mutation |
| 442 | Pasting long message overflows screen (no maxHeight) | Low | `chat/[conversationId].tsx` (286-297) |
| 421 | Conversation cards/picker use grey not brand yellow | Low | `conversation-starters/card-deck.tsx:102`, `card-language-picker.tsx:68` |

---

## File-conflict clusters (drive parallelism)

- **Cluster CHAT** — `apps/native/app/chat/[conversationId].tsx` touched by **#422, #444, #443, #442**. Same file → MUST serialize (or bundle into one branch).
- **Cluster DELETE** — `deleteAccount` + meetup schema/cascade + `scheduling/meetup.ts` touched by **#447 + #446**. Shared root cause (hard delete → soft delete). Do together.
- **Isolated** — #441 (profile), #421 (conversation-starters). No overlap with anything.

---

## Proposed execution plan

### Phase 1 — Foundational, alone  ⚠️ biggest blast radius
- **#447 + #446 together** — introduce soft-delete + "user unavailable" placeholder + meetup→cancelled transition + partner dialog/notify. Touches api + db schema + (likely) native deletion/placeholder UI.
- Do first and alone: schema/cascade change is the riskiest, and its native placeholder work may touch chat screens (potential overlap with Cluster CHAT — see risk below).

### Phase 2 — 3 parallel worktrees (after Phase 1 merges)

**2.1 — Cluster CHAT (serial, one file, in this order):**
1. **#422** unread invalidation (`markRead onSuccess` → invalidate `chat.listEntries`)
2. **#444** optimistic send / `sendMessage onSuccess` invalidation
3. **#443** ⓘ button onPress — ⚠️ **design gate**: destination screen may not exist; confirm intended target before wiring
4. **#442** compose `TextInput` maxHeight cap

**2.2 — #441** profile min-one-language guard (mirror `OnboardingProgression.assertCanSubmit()` in profile edit mutation + UI dialog). Independent.

**2.3 — #421** swap `bg-muted` → brand-gold token in 2 card components. Independent, trivial.

---

## Risks / gates
- **#443 needs design input** — dead control with no defined destination. Don't auto-wire blind.
- **Phase 1 ↔ Cluster CHAT overlap**: #447's "deleted partner = placeholder in existing chats" may edit `chat/[conversationId].tsx`. If so, Phase 1 and 2.1 conflict on that file → keep them sequential (already are).
- **#447 + #446 are large** (schema migration, soft-delete pattern, cascade rework). Consider splitting into sub-tasks rather than one PR.

---

## Suggested merge order
`#447+#446` → then parallel { `#422→#444→#443→#442`, `#441`, `#421` }.

3 phases · 8 bugs · 3 parallel tracks in phase 2.
