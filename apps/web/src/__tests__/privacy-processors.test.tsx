/**
 * Tests for task #458 — Audit and confirm every external service that processes member data.
 *
 * This locks the processor audit (docs/legal/sub-processor-audit.md) against content
 * drift: the Privacy Statement must keep naming every confirmed processor and state the
 * transfer safeguard. Underpins Feature #437 AC3 (the statement names every processor).
 *
 * Covers:
 *   - The email processor (Resend) is named and its data (email) disclosed
 *   - The push chain (Expo, Apple, Google) is named
 *   - The hosting location (own server, Netherlands) is stated
 *   - The international-transfer safeguard (SCCs, GDPR Art. 46) is stated
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => null,
}));

import { PrivacyPage } from "@/routes/privacy";

describe("#458 — privacy statement names every confirmed processor", () => {
  it("names Resend as the sign-in email processor and discloses it receives the email address", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/Resend/)).toBeInTheDocument();
    expect(
      screen.getByText(/one-time sign-in codes and\s+account emails/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/receive your email address/i)).toBeInTheDocument();
  });

  it("names the push chain — Expo, with Apple and Google push services", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/Expo/)).toBeInTheDocument();
    expect(
      screen.getByText(/Apple and Google push services/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/push notifications/i)).toBeInTheDocument();
  });

  it("states member data is hosted on an own server in the Netherlands", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(/our own server in the Netherlands/i),
    ).toBeInTheDocument();
  });

  it("states the transfer safeguard for data leaving the EEA (SCCs, GDPR Art. 46)", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(/transferred outside the European Economic Area/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Standard Contractual Clauses/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Article 46/i)).toBeInTheDocument();
  });
});
