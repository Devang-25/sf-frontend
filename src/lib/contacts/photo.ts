/**
 * Contact photo helpers, shared by the form control and its validation.
 *
 * The API stores a photo as a base64 `data:` URL (see the backend's
 * `validate_photo_data_url`), so the browser does the encoding. Everything here
 * except `fileToAvatarDataUrl` is pure, so the rules can be tested without a DOM.
 */

/** Kept in step with the API's allow-list. SVG is excluded — it can carry script. */
export const PHOTO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/**
 * The API's cap on the *decoded* image, mirrored here to fail before a round trip.
 * Sized for an avatar: a 512px JPEG lands around 40 KB, so this is ample headroom
 * while keeping a full page of contacts a sane response size.
 */
export const MAX_PHOTO_BYTES = 262_144;

/** Longest edge we downscale to before encoding. An avatar is never shown larger. */
export const AVATAR_MAX_EDGE = 512;

/** Refuse absurd files before spending time decoding them. */
export const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;

const PHOTO_DATA_URL =
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isPhotoDataUrl(value: string): boolean {
  return PHOTO_DATA_URL.test(value);
}

/**
 * Size of the image the data URL encodes. Base64 carries 3 bytes per 4
 * characters, less whatever the `=` padding stands in for.
 */
export function decodedByteLength(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** The single reason a photo value is invalid, or `null` when it is fine. */
export function photoValidationError(value: string | null): string | null {
  if (value === null || value === "") return null;
  if (!isPhotoDataUrl(value)) {
    return "Photo must be a PNG, JPEG, or WebP image";
  }
  if (decodedByteLength(value) > MAX_PHOTO_BYTES) {
    return `Photo must be ${MAX_PHOTO_BYTES / 1024} KB or smaller`;
  }
  return null;
}

/** Longest-edge-capped dimensions, preserving aspect ratio. Never upscales. */
export function scaledDimensions(
  width: number,
  height: number,
  maxEdge: number = AVATAR_MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) {
    return { width, height };
  }
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Read an image file and return a downscaled JPEG data URL.
 *
 * Downscaling in the browser is what keeps inline storage cheap: a phone photo
 * arrives at several MB and leaves at a few tens of KB, comfortably under the
 * API's cap. Re-encoding to JPEG also drops any EXIF the original carried.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!PHOTO_MIME_TYPES.includes(file.type as (typeof PHOTO_MIME_TYPES)[number])) {
    throw new Error("Choose a PNG, JPEG, or WebP image");
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    throw new Error(
      `That image is too large — pick one under ${MAX_SOURCE_FILE_BYTES / 1024 / 1024} MB`,
    );
  }

  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process that image");
    context.drawImage(bitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const error = photoValidationError(dataUrl);
    if (error) throw new Error(error);
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
