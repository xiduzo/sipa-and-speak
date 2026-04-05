import { polarClient } from "@polar-sh/better-auth";
import { env } from "@sip-and-speak/env/web";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
  plugins: [emailOTPClient(), polarClient()],
});
