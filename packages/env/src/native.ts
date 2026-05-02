import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    EXPO_PUBLIC_SERVER_URL: z.url(),
  },
  runtimeEnv: {
    EXPO_PUBLIC_SERVER_URL: process.env.EXPO_PUBLIC_SERVER_URL,
  },
  emptyStringAsUndefined: true,
  // RN sets global.window = global, so t3-env's isServer check returns false.
  // Silence proxy errors for non-prefixed prop access (Promise checks etc.)
  isServer: false,
  onInvalidAccess: () => undefined as never,
});
