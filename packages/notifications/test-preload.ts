process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-at-least-32-characters-long-here";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.POLAR_ACCESS_TOKEN ??= "test-token";
process.env.POLAR_SUCCESS_URL ??= "http://localhost:3000/success";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.NODE_ENV ??= "test";
