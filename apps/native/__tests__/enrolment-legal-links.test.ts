/**
 * Tests for task #456 — Open enrolment legal links in the device browser with
 * graceful failure.
 *
 * Covers:
 *   - Each link (Terms of Use, Community Code, Privacy Statement) opens its
 *     canonical sipandspeak.nl URL, passed unchanged.
 *   - A rejected openURL (offline page / no browser / no link handler) is
 *     handled without throwing, so sign-up is never blocked or crashed.
 */
import { Linking } from "react-native";

import { LEGAL_BASE_URL, openLegal } from "@/utils/open-legal";

jest.mock("react-native", () => ({
  Linking: { openURL: jest.fn() },
}));

const mockOpenURL = Linking.openURL as jest.Mock;

describe("openLegal", () => {
  beforeEach(() => {
    mockOpenURL.mockReset();
  });

  it("uses the canonical https sipandspeak.nl origin", () => {
    expect(LEGAL_BASE_URL).toBe("https://sipandspeak.nl");
  });

  it.each([
    ["/terms", "https://sipandspeak.nl/terms"],
    ["/community-code", "https://sipandspeak.nl/community-code"],
    ["/privacy", "https://sipandspeak.nl/privacy"],
  ])(
    "opens %s at the correct canonical sipandspeak.nl URL",
    async (path, expected) => {
      mockOpenURL.mockResolvedValue(true);

      await openLegal(path);

      expect(mockOpenURL).toHaveBeenCalledTimes(1);
      expect(mockOpenURL).toHaveBeenCalledWith(expected);
    },
  );

  it("does not throw when the open is rejected (offline / no browser / no link handler)", async () => {
    mockOpenURL.mockRejectedValue(new Error("No app can handle this URL"));

    await expect(openLegal("/terms")).resolves.toBeUndefined();
    // Still attempted at the canonical address even though it was rejected.
    expect(mockOpenURL).toHaveBeenCalledWith("https://sipandspeak.nl/terms");
  });

  it("does not throw when openURL throws synchronously", async () => {
    mockOpenURL.mockImplementation(() => {
      throw new Error("boom");
    });

    await expect(openLegal("/privacy")).resolves.toBeUndefined();
  });
});
