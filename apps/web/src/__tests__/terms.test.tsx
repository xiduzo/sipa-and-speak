/**
 * Tests for task #454 — Finalise the Terms of Use content
 *
 * Covers the Feature #438 acceptance criteria / Gherkin scenarios:
 *   - Member reads who provides the service and how to make contact
 *   - Member reads their account responsibilities, acceptable use (Community
 *     Code), and content ownership
 *   - Member reads the "as is" disclaimer, Dutch governing law, change policy,
 *     and last-updated date
 *   - Provider identity is a populated real name, never a blank or company
 *     placeholder (matches the Privacy Statement controller)
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => null,
}));

import { TermsPage } from "@/routes/terms";

describe("#454 — Terms of Use content", () => {
  it("names the provider and offers a way to make contact", () => {
    render(<TermsPage />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/terms of use/i);

    // Provider identity is shown and matches the Privacy Statement controller.
    expect(screen.getByText(/V\.J\.O\.C\./)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /hello@sipandspeak\.nl/i });
    expect(link).toHaveAttribute("href", "mailto:hello@sipandspeak.nl");
  });

  it("does not leave a blank or company placeholder for the provider", () => {
    render(<TermsPage />);

    expect(screen.queryByText(/\[Your full name\]/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[company\]/i)).not.toBeInTheDocument();
  });

  it("states account responsibilities, acceptable use, and content ownership", () => {
    render(<TermsPage />);

    expect(
      screen.getByText(/responsible for activity under your account/i),
    ).toBeInTheDocument();

    const communityLink = screen.getByRole("link", { name: /community code/i });
    expect(communityLink).toHaveAttribute("href", "/community-code");

    expect(
      screen.getByText(/keep ownership of the content you create/i),
    ).toBeInTheDocument();
  });

  it("includes an as-is disclaimer, Dutch governing law, change policy, and last-updated date", () => {
    render(<TermsPage />);

    expect(screen.getByText(/without warranties/i)).toBeInTheDocument();
    expect(
      screen.getByText(/cannot be limited under\s+Dutch law/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/governed by Dutch law/i)).toBeInTheDocument();
    expect(screen.getByText(/we may update these terms/i)).toBeInTheDocument();
    expect(screen.getByText(/Last updated/i)).toBeInTheDocument();
  });

  it("links to the Privacy Statement", () => {
    render(<TermsPage />);

    const privacyLink = screen.getByRole("link", {
      name: /privacy statement/i,
    });
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });
});
