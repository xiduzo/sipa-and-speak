/**
 * Tests for the public landing page (/).
 *
 * Covers the customer-facing marketing page and, importantly, that the legal
 * pages remain reachable from the footer (Privacy, Terms, Community Code,
 * Delete account) — the trust links a potential member needs before signing up.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Capture the path passed to createFileRoute so we can assert the landing page
// is registered at the site root.
const { createFileRouteMock } = vi.hoisted(() => ({
  createFileRouteMock: vi.fn((_path: string) => () => null),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: createFileRouteMock,
}));

import { HomePage } from "@/routes/index";

describe("landing page — registration & hero", () => {
  it("registers a file route at the site root", () => {
    expect(createFileRouteMock).toHaveBeenCalledWith("/");
  });

  it("leads with the product promise", () => {
    render(<HomePage />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/find a language buddy/i);

    expect(
      screen.getByText(/speaks the language you’re\s*learning/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/eindhoven/i).length).toBeGreaterThan(0);
  });

  it("offers a clear way to get started", () => {
    render(<HomePage />);

    const ctas = screen.getAllByRole("link", { name: /request an invite/i });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", expect.stringContaining("mailto:hello@sipandspeak.nl"));
    }
  });
});

describe("landing page — footer legal links", () => {
  it("links to every legal page from the footer", () => {
    render(<HomePage />);

    const legal = within(screen.getByRole("navigation", { name: /legal/i }));

    expect(
      legal.getByRole("link", { name: /privacy statement/i }),
    ).toHaveAttribute("href", "/privacy");
    expect(legal.getByRole("link", { name: /terms of use/i })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(
      legal.getByRole("link", { name: /community code/i }),
    ).toHaveAttribute("href", "/community-code");
    expect(
      legal.getByRole("link", { name: /delete your account/i }),
    ).toHaveAttribute("href", "/delete-account");
  });

  it("places the product in Eindhoven", () => {
    render(<HomePage />);
    expect(
      screen.getAllByText(/made in eindhoven, the netherlands/i).length,
    ).toBeGreaterThan(0);
  });
});
