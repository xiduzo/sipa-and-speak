/**
 * Cascade-on-delete guard (Task #426, Feature #417).
 *
 * The public /delete-account page claims that deleting an account removes all
 * associated member data. That claim is only true if every table referencing a
 * member (user.id) deletes on account deletion. This test introspects the Drizzle
 * schema and fails if a user.id foreign key neither cascades nor is explicitly
 * allowlisted as intentionally retained — so a new member-data table cannot
 * silently make the published disclosure false.
 *
 * See docs/account-data-deletion-audit.md for the authoritative breakdown.
 */
import { describe, it, expect } from "bun:test";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

import * as schema from "../schema";

/**
 * Foreign keys to user.id that intentionally do NOT cascade on account deletion.
 * Each is justified in docs/account-data-deletion-audit.md: the referenced data is
 * retained with the member's identity removed (set null). Adding an entry here is a
 * conscious decision — never a way to silence the guard.
 */
const INTENTIONAL_NON_CASCADE = new Set<string>([
  "student_comment.author_id", // comment about another student; author nulled, content kept
  "user_flag.moderator_id", // moderation audit trail; moderator identity nulled
  "meetup.reschedule_proposer_id", // soft pointer; row already cascade-deleted via proposer/receiver
]);

type UserReference = { key: string; onDelete: string | undefined };

function collectUserReferences(): UserReference[] {
  const refs: UserReference[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    for (const fk of config.foreignKeys) {
      const reference = fk.reference();
      const foreignTable = getTableConfig(reference.foreignTable).name;
      const foreignColumns = reference.foreignColumns.map((col) => col.name);
      if (foreignTable !== "user" || !foreignColumns.includes("id")) continue;
      const localColumns = reference.columns.map((col) => col.name).join(",");
      refs.push({ key: `${config.name}.${localColumns}`, onDelete: fk.onDelete });
    }
  }
  return refs;
}

describe("member-data cascade-on-delete guard (#426)", () => {
  it("actually finds member references (guards against a vacuous pass)", () => {
    expect(collectUserReferences().length).toBeGreaterThan(5);
  });

  it("every user.id foreign key cascades or is explicitly allowlisted", () => {
    const violations = collectUserReferences()
      .filter(
        (ref) =>
          ref.onDelete !== "cascade" && !INTENTIONAL_NON_CASCADE.has(ref.key),
      )
      .map((ref) => `${ref.key} → onDelete=${ref.onDelete ?? "(none)"}`);

    // A violation means a table holds member data without deleting it on account
    // deletion. Either add `onDelete: "cascade"`, or — if the data is intentionally
    // retained — add the column to INTENTIONAL_NON_CASCADE above and document it in
    // docs/account-data-deletion-audit.md.
    expect(violations).toEqual([]);
  });

  it("each allowlisted reference still exists and is set null", () => {
    const byKey = new Map(
      collectUserReferences().map((ref) => [ref.key, ref.onDelete]),
    );
    for (const key of INTENTIONAL_NON_CASCADE) {
      expect(byKey.get(key)).toBe("set null");
    }
  });
});
