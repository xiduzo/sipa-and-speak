/**
 * Tests for task #419 — Public /delete-account route with deletion instructions
 *
 * Covers:
 *   - Page renders without authentication and shows the in-app deletion steps
 *   - Page discloses the full cascade of deleted data (profile, matches, chats, meet-ups)
 *   - Page states deletion is immediate and irreversible with no recovery
 *   - Page notes data retention
 */
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => null,
}));

import { DeleteAccountPage } from "@/routes/delete-account";

describe("#419 — public /delete-account instructions page", () => {
  it("renders without authentication and shows the in-app deletion steps", () => {
    render(<DeleteAccountPage />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/delete your sip & speak account/i);

    expect(screen.getByText(/go to your Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Tap Delete account/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirm when prompted/i)).toBeInTheDocument();
  });

  it("discloses that all associated data is deleted and lists it", () => {
    render(<DeleteAccountPage />);

    expect(
      screen.getByText(/permanently deletes all associated data/i),
    ).toBeInTheDocument();

    const deletedData = within(screen.getByTestId("deleted-data"));
    expect(deletedData.getByText("Your profile")).toBeInTheDocument();
    expect(deletedData.getByText("Your matches")).toBeInTheDocument();
    expect(deletedData.getByText("Your chats")).toBeInTheDocument();
    expect(deletedData.getByText("Your meet-ups")).toBeInTheDocument();
  });

  it("states deletion is immediate and irreversible with no recovery", () => {
    render(<DeleteAccountPage />);

    expect(screen.getByText(/immediate and irreversible/i)).toBeInTheDocument();
    expect(screen.getByText(/no recovery/i)).toBeInTheDocument();
  });

  it("states retained moderation records keep their history with identity removed", () => {
    render(<DeleteAccountPage />);

    expect(
      screen.getByText(/kept for the safety of the\s+community/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/your identity is removed/i)).toBeInTheDocument();
    // The provisional placeholder must be gone once the audit is reflected.
    expect(
      screen.queryByText(/retention note is provisional/i),
    ).not.toBeInTheDocument();
  });
});

describe("#423 — email fallback for members who cannot access the app", () => {
  it("offers an email path to request deletion", () => {
    render(<DeleteAccountPage />);

    const link = screen.getByRole("link", {
      name: /hello@sipandspeak\.nl/i,
    });
    expect(link).toHaveAttribute("href", "mailto:hello@sipandspeak.nl");
  });

  it("states the member must email from the address linked to their account", () => {
    render(<DeleteAccountPage />);

    expect(
      screen.getByText(/from the address linked to your account/i),
    ).toBeInTheDocument();
  });

  it("states the 30-day fulfillment window", () => {
    render(<DeleteAccountPage />);

    expect(screen.getByText(/within 30 days of a verified/i)).toBeInTheDocument();
  });
});
