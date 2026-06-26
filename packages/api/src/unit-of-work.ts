import type { EventEmitter } from "events";
import { db, type Db } from "@sip-and-speak/db";
import { domainEvents } from "./domain-events";

/**
 * A domain event captured during a unit of work. Buffered while the
 * transaction is open and emitted only after it commits, so listeners never
 * observe state that was rolled back.
 */
export interface BufferedEvent {
  name: string;
  payload: Record<string, unknown>;
}

/** The Drizzle transaction handle, derived from the db's own `transaction` type. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Run `work` inside a single DB transaction, then emit its domain events only
 * after the transaction commits.
 *
 * This is the one seam where the persist-then-emit ritual lives. Before it,
 * every mutation wrote with the ambient `db` (autocommit) and then called
 * `emit()` by hand — so a crash between the write and the emit left state
 * persisted with its event lost, and a mutation that wrote twice was not
 * atomic. Callers now hand back their rows plus the events to fire; the seam
 * guarantees:
 *
 *   - all writes in `work` commit or roll back together (atomicity), and
 *   - a rolled-back transaction emits nothing (state and events never diverge).
 *
 * It is also the single place a durable outbox or per-listener isolation would
 * later slot in, without touching any caller.
 */
export async function commitAndEmit<T>(
  work: (tx: Tx) => Promise<{ result: T; events: BufferedEvent[] }>,
): Promise<T> {
  const { result, events } = await db.transaction(async (tx) => work(tx));

  // Emit only after the commit. We route through the base EventEmitter to dodge
  // the typed-emitter's per-event generic — payloads are already fully built.
  const emitter = domainEvents as unknown as EventEmitter;
  for (const e of events) {
    emitter.emit(e.name, e.payload);
  }

  return result;
}
