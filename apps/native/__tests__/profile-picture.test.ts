/**
 * Tests for task #278 — Base64 image encoding and validation for profile picture
 *
 * Scenario 1: Student picks a valid image
 * Scenario 2: Student picks an oversized image
 * Scenario 3: Student picks a non-image file
 * Scenario 4: Student cancels the image picker
 */

const mockLaunchImageLibraryAsync = jest.fn();

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: () => mockLaunchImageLibraryAsync(),
}));

import {
  validateImageMimeType,
  validateImageSize,
  buildDataUri,
  pickAndEncodeProfilePicture,
} from "@/utils/profile-picture";

const SMALL_BASE64 = "A".repeat(100); // ~75 bytes
const LARGE_BASE64 = "A".repeat(700_000); // ~525 KB, exceeds 500 KB limit

describe("validateImageMimeType", () => {
  it("accepts image/jpeg", () => {
    expect(validateImageMimeType("image/jpeg")).toBe(true);
  });

  it("accepts image/png", () => {
    expect(validateImageMimeType("image/png")).toBe(true);
  });

  it("rejects application/pdf", () => {
    expect(validateImageMimeType("application/pdf")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateImageMimeType("")).toBe(false);
  });
});

describe("validateImageSize", () => {
  it("accepts base64 string within 500 KB limit", () => {
    expect(validateImageSize(SMALL_BASE64)).toBe(true);
  });

  it("rejects base64 string exceeding 500 KB limit", () => {
    expect(validateImageSize(LARGE_BASE64)).toBe(false);
  });
});

describe("buildDataUri", () => {
  it("builds a valid data URI", () => {
    const uri = buildDataUri("image/jpeg", "abc123");
    expect(uri).toBe("data:image/jpeg;base64,abc123");
  });
});

describe("pickAndEncodeProfilePicture", () => {
  beforeEach(() => {
    mockLaunchImageLibraryAsync.mockReset();
  });

  it("Scenario 1: returns data URI for valid image under size limit", async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ base64: SMALL_BASE64, mimeType: "image/jpeg" }],
    });

    const result = await pickAndEncodeProfilePicture();

    expect(result.imageDataUri).toBe(`data:image/jpeg;base64,${SMALL_BASE64}`);
    expect(result.error).toBeNull();
  });

  it("Scenario 2: rejects oversized image with error", async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ base64: LARGE_BASE64, mimeType: "image/jpeg" }],
    });

    const result = await pickAndEncodeProfilePicture();

    expect(result.imageDataUri).toBeNull();
    expect(result.error).toBe("Image is too large (max 500 KB)");
  });

  it("Scenario 3: rejects non-image file with error", async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ base64: SMALL_BASE64, mimeType: "application/pdf" }],
    });

    const result = await pickAndEncodeProfilePicture();

    expect(result.imageDataUri).toBeNull();
    expect(result.error).toBe("Only image files are accepted");
  });

  it("Scenario 4: returns null with no error when picker is cancelled", async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: [],
    });

    const result = await pickAndEncodeProfilePicture();

    expect(result.imageDataUri).toBeNull();
    expect(result.error).toBeNull();
  });
});
