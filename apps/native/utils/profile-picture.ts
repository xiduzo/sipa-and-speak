import * as ImagePicker from "expo-image-picker";

const MAX_SIZE_BYTES = 500 * 1024;

export function validateImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function validateImageSize(base64: string): boolean {
  // base64 encodes 3 bytes as 4 chars
  const bytes = (base64.length * 3) / 4;
  return bytes <= MAX_SIZE_BYTES;
}

export function buildDataUri(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export type PickResult =
  | { imageDataUri: string; error: null }
  | { imageDataUri: null; error: string }
  | { imageDataUri: null; error: null };

export async function pickAndEncodeProfilePicture(): Promise<PickResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    base64: true,
    quality: 0.8,
  });

  if (result.canceled) return { imageDataUri: null, error: null };

  const asset = result.assets[0];
  if (!asset?.base64) return { imageDataUri: null, error: "Could not encode image" };

  const mimeType = asset.mimeType ?? "image/jpeg";

  if (!validateImageMimeType(mimeType)) {
    return { imageDataUri: null, error: "Only image files are accepted" };
  }

  if (!validateImageSize(asset.base64)) {
    return { imageDataUri: null, error: "Image is too large (max 500 KB)" };
  }

  return { imageDataUri: buildDataUri(mimeType, asset.base64), error: null };
}
