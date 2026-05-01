import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://2966b7d766a37267bf11e4cc56c51ad1@o4511316621131776.ingest.de.sentry.io/4511316623032400",
  tracesSampleRate: 0,
  debug: false,
});

export { Sentry };
