import type { Pool } from "pg";
import { env } from "@sip-and-speak/env/server";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export type Schema = typeof schema;
export type Db = NodePgDatabase<Schema>;

export function createDb(pool?: Pool): Db {
  return pool ? drizzle(pool, { schema }) : drizzle(env.DATABASE_URL, { schema });
}

export const db: Db = createDb();
