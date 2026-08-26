import {
  AVATAR_MAX_EDGE,
  MAX_PHOTO_BYTES,
  decodedByteLength,
  isPhotoDataUrl,
  photoValidationError,
  scaledDimensions,
} from "@/lib/contacts/photo";

/** A 1x1 transparent PNG — the smallest genuinely valid value. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA" +
  "DUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** Build a data URL whose decoded payload is exactly `bytes` long. */
function dataUrlOfSize(bytes: number): string {
  return `data:image/jpeg;base64,${"A".repeat(Math.ceil(bytes / 3) * 4)}`;
}

describe("isPhotoDataUrl", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s", (mime) => {
    expect(isPhotoDataUrl(`data:${mime};base64,AAAA`)).toBe(true);
  });

  it("rejects svg, which can carry script", () => {
    expect(isPhotoDataUrl("data:image/svg+xml;base64,PHN2Zy8+")).toBe(false);
  });

  it("rejects a remote URL", () => {
    expect(isPhotoDataUrl("https://example.com/avatar.png")).toBe(false);
  });

  it("rejects a non-image data URL", () => {
    expect(isPhotoDataUrl("data:text/html;base64,PGgxPmhpPC9oMT4=")).toBe(false);
  });

  it("rejects characters outside the base64 alphabet", () => {
    expect(isPhotoDataUrl("data:image/png;base64,!!!!")).toBe(false);
  });
});

describe("decodedByteLength", () => {
  it("accounts for single and double padding", () => {
    // "AAAA" -> 3 bytes, "AAA=" -> 2 bytes, "AA==" -> 1 byte.
    expect(decodedByteLength("data:image/png;base64,AAAA")).toBe(3);
    expect(decodedByteLength("data:image/png;base64,AAA=")).toBe(2);
    expect(decodedByteLength("data:image/png;base64,AA==")).toBe(1);
  });

  it("measures the real 1x1 png as a handful of bytes, not its string length", () => {
    expect(decodedByteLength(PNG)).toBeLessThan(PNG.length);
    expect(decodedByteLength(PNG)).toBeGreaterThan(0);
  });

  it("returns 0 when there is no payload", () => {
    expect(decodedByteLength("data:image/png;base64,")).toBe(0);
  });
});

describe("photoValidationError", () => {
  it("treats null and empty as 'no photo', not as an error", () => {
    expect(photoValidationError(null)).toBeNull();
    expect(photoValidationError("")).toBeNull();
  });

  it("accepts a valid png", () => {
    expect(photoValidationError(PNG)).toBeNull();
  });

  it("rejects a disallowed type", () => {
    expect(photoValidationError("data:image/gif;base64,AAAA")).toMatch(
      /PNG, JPEG, or WebP/,
    );
  });

  it("rejects an image over the API's cap", () => {
    expect(photoValidationError(dataUrlOfSize(MAX_PHOTO_BYTES + 1024))).toMatch(
      /or smaller/,
    );
  });

  it("accepts an image just under the cap", () => {
    expect(photoValidationError(dataUrlOfSize(MAX_PHOTO_BYTES - 1024))).toBeNull();
  });
});

describe("scaledDimensions", () => {
  it("caps the longest edge and preserves the aspect ratio", () => {
    expect(scaledDimensions(2000, 1000)).toEqual({
      width: AVATAR_MAX_EDGE,
      height: AVATAR_MAX_EDGE / 2,
    });
    expect(scaledDimensions(1000, 2000)).toEqual({
      width: AVATAR_MAX_EDGE / 2,
      height: AVATAR_MAX_EDGE,
    });
  });

  it("never upscales a small image", () => {
    expect(scaledDimensions(64, 48)).toEqual({ width: 64, height: 48 });
  });

  it("leaves an image already at the cap alone", () => {
    expect(scaledDimensions(AVATAR_MAX_EDGE, AVATAR_MAX_EDGE)).toEqual({
      width: AVATAR_MAX_EDGE,
      height: AVATAR_MAX_EDGE,
    });
  });

  it("never rounds an extreme aspect ratio down to zero", () => {
    const { height } = scaledDimensions(4000, 1);
    expect(height).toBeGreaterThanOrEqual(1);
  });
});
