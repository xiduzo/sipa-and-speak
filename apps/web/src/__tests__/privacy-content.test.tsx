/**
 * Tests for task #459 — Write the Privacy Statement core content.
 *
 * Covers Feature #437 AC1, AC2, AC4 (the processor / international-transfer
 * section is covered separately by privacy-processors.test.tsx, task #458/#460):
 *   - Controller identity: a named natural person in NL with a working contact,
 *     never a blank controller field
 *   - Data collected (email, name, profile) and the legal basis
 *     (performance of a contract, GDPR Art. 6(1)(b))
 *   - Retention with a link to account deletion (/delete-account)
 *   - GDPR rights including the right to complain to the Autoriteit Persoonsgegevens
 *   - A visible "last updated" date
 */
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => null,
}));

import { PrivacyPage } from "@/routes/privacy";

describe("#459 — privacy statement core content", () => {
  it("uses a single top-level heading for the statement", () => {
    render(<PrivacyPage />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/privacy statement/i);
  });

  it("names a natural-person controller in the Netherlands and never leaves it blank", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/who is responsible/i)).toBeInTheDocument();
    const controller = screen.getByText(
      /the controller of your personal data is/i,
    );
    // The controller field is an invariant: it must carry an identifier and
    // state the natural person is based in the Netherlands.
    expect(controller).toHaveTextContent(/V\.J\.O\.C\./);
    expect(controller).toHaveTextContent(
      /natural\s+person based in the Netherlands/i,
    );
  });

  it("offers a working contact for data questions and rights requests", () => {
    render(<PrivacyPage />);

    const links = screen.getAllByRole("link", {
      name: /hello@sipandspeak\.nl/i,
    });
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "mailto:hello@sipandspeak.nl");
    }
  });

  it("lists the data collected — email, name and profile", () => {
    render(<PrivacyPage />);

    // Target the capitalised <strong> labels in the "What we collect" list,
    // which are distinct from prose mentions elsewhere on the page.
    expect(screen.getByText("Email address")).toBeInTheDocument();
    expect(screen.getByText("Name / display name")).toBeInTheDocument();
    expect(screen.getByText("Profile details")).toBeInTheDocument();
  });

  it("states the legal basis is performance of a contract (GDPR Art. 6(1)(b))", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/performance of a contract/i)).toBeInTheDocument();
    expect(screen.getByText(/Article 6\(1\)\(b\)/i)).toBeInTheDocument();
  });

  it("explains retention and links to delete the account", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(/we keep your data for as long as your account exists/i),
    ).toBeInTheDocument();

    const deleteLink = within(screen.getByRole("main")).getByRole("link", {
      name: /delete your account/i,
    });
    expect(deleteLink).toHaveAttribute("href", "/delete-account");
  });

  it("lists the GDPR rights and the right to complain to the Autoriteit Persoonsgegevens", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(
        /right to access, correct, delete, restrict,\s+or object/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/data\s+portability/i)).toBeInTheDocument();

    const apLink = screen.getByRole("link", {
      name: /autoriteit persoonsgegevens/i,
    });
    expect(apLink).toHaveAttribute(
      "href",
      "https://autoriteitpersoonsgegevens.nl",
    );
  });

  it("shows a visible 'last updated' date", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/last updated 25 June 2026/i)).toBeInTheDocument();
  });
});
