/**
 * Tests for task #462 — Publish the /privacy route and verify it is reachable.
 *
 * Covers Feature #437 AC1 reachability at the unit level (production
 * reachability itself is a manual Dokploy deploy check):
 *   - The page is registered at the "/privacy" path (createFileRoute("/privacy"))
 *     so it is generated into the route tree and served at sipandspeak.nl/privacy.
 *   - The deletion link resolves to /delete-account (Gherkin: "The deletion link
 *     resolves from the published page").
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Capture the path passed to createFileRoute so we can assert the route is
// registered at "/privacy" — the value that the router codegen reads to build
// routeTree.gen.ts.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (_options: unknown) => ({ path }),
}));

import { PrivacyPage, Route } from "@/routes/privacy";

describe("#462 — /privacy route registration & reachability", () => {
  it("registers the privacy statement at the /privacy path", () => {
    expect((Route as unknown as { path: string }).path).toBe("/privacy");
  });

  it("resolves the deletion link to the account-deletion page", () => {
    render(<PrivacyPage />);

    const link = screen.getByRole("link", { name: /delete your account/i });
    expect(link.getAttribute("href")).toBe("/delete-account");
  });
});
