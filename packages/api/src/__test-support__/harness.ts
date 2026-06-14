/**
 * Integration test harness for tRPC procedures.
 *
 * Boots an in-memory Postgres via pg-mem, applies the production migrations,
 * mocks `@sip-and-speak/db` so router code transparently uses the test DB,
 * and exposes helpers to build a tRPC caller bound to a fake session and to
 * capture emitted domain events.
 *
 * Importing this module has side effects: it installs `mock.module` shims for
 * the db package. Import it FIRST in any test file that needs DB-backed
 * integration coverage.
 */
import { mock } from "bun:test";
import { newDb, DataType, type IMemoryDb } from "pg-mem";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as schema from "@sip-and-speak/db/schema";
import { domainEvents } from "../domain-events";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "../../../db/src/migrations");

function buildMemoryDb(): IMemoryDb {
  const mem = newDb({ autoCreateForeignKeyIndices: true });

  // pg-mem ships without these PG built-ins; register no-op/native equivalents.
  mem.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    implementation: () => crypto.randomUUID(),
    impure: true,
  });
  mem.public.registerFunction({
    name: "now",
    returns: DataType.timestamp,
    implementation: () => new Date(),
    impure: true,
  });

  return mem;
}

type JournalEntry = { idx: number; tag: string };

function applyMigrations(mem: IMemoryDb): void {
  // Use the drizzle journal as source of truth — readdir picks up orphan
  // squashed migrations that aren't part of the canonical sequence.
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  for (const entry of entries) {
    // Prefer a `.pgmem.sql` sister file when present — used to encode
    // pg-mem-compatible equivalents of migrations whose real SQL relies on
    // PG features pg-mem can't parse (e.g. `AT TIME ZONE`).
    const pgmemFile = `${entry.tag}.pgmem.sql`;
    const realFile = `${entry.tag}.sql`;
    let file = realFile;
    let sql: string;
    try {
      sql = readFileSync(join(MIGRATIONS_DIR, pgmemFile), "utf8");
      file = pgmemFile;
    } catch {
      sql = readFileSync(join(MIGRATIONS_DIR, realFile), "utf8");
    }

    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        mem.public.none(trimmed);
      } catch (err) {
        const head = trimmed.slice(0, 80).replace(/\n/g, " ");
        throw new Error(
          `pg-mem migration failed in ${file}: ${(err as Error).message}\n  near: ${head}`,
        );
      }
    }
  }
}

const memDb = buildMemoryDb();
applyMigrations(memDb);
const { Pool } = memDb.adapters.createPg();
const rawPool = new Pool();

/**
 * pg-mem's `createPg` adapter throws on `rowMode: "array"`, which drizzle's
 * node-postgres session uses for every SELECT. This wrapper transparently
 * strips `rowMode` from query configs and reshapes the returned rows from
 * objects (pg-mem's default) into positional arrays (what drizzle expects).
 */
type QueryArg = string | { text: string; values?: unknown[]; rowMode?: string; types?: unknown };
function wrapClientLike<T extends { query: (...args: unknown[]) => Promise<unknown> }>(client: T): T {
  const originalQuery = client.query.bind(client);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).query = async (arg: QueryArg, values?: unknown[]) => {
    if (typeof arg === "object" && arg !== null) {
      const wantsArrayRows = arg.rowMode === "array";
      // pg-mem does not support drizzle's `rowMode` or `types` (custom parsers).
      // Strip them before delegating, then reshape rows ourselves if needed.
      const { rowMode: _rowMode, types: _types, ...rest } = arg;
      const result = (await originalQuery(rest, values)) as {
        fields?: Array<{ name: string }>;
        rows: Array<Record<string, unknown>>;
        [k: string]: unknown;
      };
      if (!wantsArrayRows) return result;
      // pg-mem returns an empty `fields` array, so reconstruct the column order
      // from the first row's keys (V8 preserves insertion order, and pg-mem
      // emits keys in SELECT order). Synthesize a fields array for drizzle.
      const firstRow = result.rows[0];
      const columnNames = firstRow ? Object.keys(firstRow) : [];
      const fields = columnNames.map((name) => ({ name }));
      return {
        ...result,
        fields,
        rows: result.rows.map((row) => columnNames.map((c) => row[c])),
      };
    }
    return originalQuery(arg as never, values as never);
  };
  return client;
}

const pool = wrapClientLike(rawPool as never) as typeof rawPool;
const originalConnect = pool.connect.bind(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pool as any).connect = async (...args: unknown[]) => {
  const client = await (originalConnect as (...a: unknown[]) => Promise<unknown>)(...args);
  return wrapClientLike(client as never);
};

const testDb = drizzle(pool, { schema });

mock.module("@sip-and-speak/db", () => ({
  db: testDb,
  createDb: () => testDb,
}));

export { testDb, memDb };

/**
 * Snapshot the schema so each test can start from a clean slate without
 * re-running 18 migrations. pg-mem snapshots are O(1).
 */
const cleanSnapshot = memDb.backup();

export function resetDb(): void {
  cleanSnapshot.restore();
}

/**
 * Subscribe to every domain event name and collect emitted payloads.
 * Returns the live `events` array (appended to as events fire) and a
 * `stop()` to detach the listeners.
 */
const EVENT_NAMES = [
  "LanguageProfileUpdated",
  "InterestProfileUpdated",
  "ProfileCompleted",
  "MatchRequestSent",
  "MatchRequestAccepted",
  "MatchRequestDeclined",
  "MeetupProposed",
  "MeetupConfirmed",
  "MeetupCounterProposed",
  "MeetupDeclined",
  "MeetupCancelled",
  "MeetupWithdrawn",
  "MeetupRescheduleProposed",
  "MeetupRescheduled",
  "MeetupRescheduleDeclined",
  "AttendanceReported",
  "SipAndSpeakMomentCompleted",
  "MeetupNotAttended",
  "MessagingOptInPrompted",
  "MessagingAccepted",
  "MessagingDeclined",
  "ConversationOpened",
  "MessagingDeclineOutcome",
  "MessagingNudgeNeeded",
  "MessageSent",
  "StudentFlagged",
  "StudentWarned",
  "StudentSuspended",
  "SuspensionLifted",
  "StudentRemoved",
  "ProposalsCancelledByCascade",
  "StudentProfileCompleted",
  "StudentProfileUpdated",
] as const;

export type CapturedEvent = { name: string; payload: unknown };

export function captureEvents(): {
  events: CapturedEvent[];
  stop: () => void;
} {
  const events: CapturedEvent[] = [];
  const listeners: Array<[string, (p: unknown) => void]> = [];
  for (const name of EVENT_NAMES) {
    const listener = (payload: unknown) => events.push({ name, payload });
    listeners.push([name, listener]);
    domainEvents.on(name as never, listener as never);
  }
  return {
    events,
    stop: () => {
      for (const [name, listener] of listeners) {
        domainEvents.off(name as never, listener as never);
      }
    },
  };
}

/**
 * Build a tRPC context object for a synthetic user. Mirrors the shape produced
 * by `createContext` in production (auth + session). The caller passes this to
 * `appRouter.createCaller(buildSessionContext(...))`.
 */
export function buildSessionContext(userId: string, email = `${userId}@example.com`) {
  return {
    auth: null,
    session: {
      session: {
        id: `session-${userId}`,
        userId,
        token: `token-${userId}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: {
        id: userId,
        email,
        name: email,
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  } as never;
}
