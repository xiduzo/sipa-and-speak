# ADR 0004 — Messaging access checks stay split (read vs write)

- **Status**: Accepted
- **Date**: 2026-06-26
- **Context tags**: Conversation Practice / Messaging

## Context

The Messaging context guards conversation access in three places that look
like duplication and invite a "unify into one `MessagingAccess` module"
refactor:

- `checkConversationAccess(conv, senderId)` — gate for **sending** a message.
  Returns distinct errors: `CONVERSATION_NOT_FOUND`, `NOT_A_PARTICIPANT`,
  `CONVERSATION_NOT_OPEN`. The router maps these to different tRPC codes
  (`NOT_FOUND` vs `FORBIDDEN`).
- `checkReadAccess(conv, readerId)` — gate for **reading** messages. Deliberately
  collapses *every* failure (missing conversation, non-participant, suspended)
  to a single `NOT_A_PARTICIPANT`, so a reader cannot probe whether a
  conversation exists (#151).
- The inline suspended/removed-sender guard in `messaging.ts` (`sendMessage`),
  a single-callsite check.

`messaging-utils.ts` already states the governing rule: *"only deep helpers
worth extracting live here; shallow predicates have been inlined at their
callsites."*

## Decision

Keep the read-access and write-access checks as **two separate functions**, and
keep the suspended-sender guard inline. Do **not** merge them into a single
`MessagingAccess` decision module.

The two checks share shape but not semantics: write-access surfaces precise
errors so the client can distinguish "gone" from "forbidden"; read-access
intentionally obscures existence as a privacy property. A unified entry point
would need a mode flag to reproduce both behaviours — that is *more* complex
than the two six-line functions, and one slip would leak existence on the read
path. The suspended-sender guard has one caller, so extracting it concentrates
nothing.

## Consequences

- **Deletion test**: deleting a hypothetical merged module would not concentrate
  complexity — there are only two callers and they require divergent behaviour.
  The merge is shallow; the split is not.
- A future architecture review will see the near-identical bodies and be tempted
  to DRY them up. This ADR is the answer: the divergence is load-bearing (the
  `NOT_A_PARTICIPANT`-for-everything collapse is a security choice, not an
  oversight).
- If a third access path appears that genuinely shares the *write* semantics,
  revisit — two adapters make a real seam; one does not.
