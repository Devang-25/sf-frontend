import type { Address, Contact } from "./types";

/**
 * Render a contact as a vCard 4.0 document (RFC 6350).
 *
 * vCard already models what this app models — a person with several typed
 * postal addresses and a photo — so a contact maps onto it without inventing
 * anything: each address becomes its own `ADR` line carrying its own `TYPE`.
 *
 * Pure and synchronous, so the format is testable without a server.
 */

/**
 * RFC 6350 §5.6 registers only `work` and `home` as TYPE values for ADR, so
 * "Other" has no valid mapping. Rather than emit `TYPE=other` — which is not a
 * registered value and which strict parsers may reject — an Other address is
 * written untyped, which is exactly what it is. The distinction survives in our
 * own model; it simply is not expressible in vCard's vocabulary.
 */
const ADR_TYPE: Record<Address["type"], string | null> = {
  Home: "home",
  Work: "work",
  Other: null,
};

/**
 * Escape a text value: backslash, newline, comma and semicolon are structural
 * in vCard, so a contact called `Smith; Jr` must not split into two fields.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Escape the parts of a structured value, then join them with `;`. */
function structured(parts: (string | null)[]): string {
  return parts.map((part) => escapeText(part ?? "")).join(";");
}

const encoder = new TextEncoder();

/**
 * Fold a content line to 75 octets, per RFC 6350 §3.2.
 *
 * The limit is in *octets*, not characters, and a multi-byte character must not
 * be split across the fold — so this measures UTF-8 width as it goes. This is
 * not cosmetic: an unfolded `PHOTO` line runs to tens of thousands of characters
 * and strict parsers reject it.
 */
function foldLine(line: string): string {
  const segments: string[] = [];
  let current = "";
  let width = 0;
  // Continuation lines start with a space, which itself costs an octet.
  let limit = 75;

  for (const character of line) {
    const size = encoder.encode(character).length;
    if (width + size > limit) {
      segments.push(current);
      current = "";
      width = 0;
      limit = 74;
    }
    current += character;
    width += size;
  }
  segments.push(current);

  return segments.join("\r\n ");
}

/** `Ada Lovelace` → `ada-lovelace`, for the download filename. */
export function vcardFilename(contact: Pick<Contact, "full_name" | "id">): string {
  const slug = contact.full_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || `contact-${contact.id}`}.vcf`;
}

/**
 * vCard timestamps use ISO 8601 *basic* format — `20260827T001214Z`, not the
 * extended `2026-08-27T00:12:14Z` that `toISOString` produces (RFC 6350 §4.3.5).
 */
export function vcardTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
}


export function toVCard(contact: Contact): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:4.0"];

  lines.push(`FN:${escapeText(contact.full_name)}`);
  // N is Family;Given;Additional;Prefix;Suffix.
  lines.push(`N:${structured([contact.last_name, contact.first_name, "", "", ""])}`);

  if (contact.company || contact.job_title) {
    if (contact.company) lines.push(`ORG:${escapeText(contact.company)}`);
    if (contact.job_title) lines.push(`TITLE:${escapeText(contact.job_title)}`);
  }

  lines.push(`EMAIL;TYPE=internet:${escapeText(contact.email)}`);
  if (contact.phone) lines.push(`TEL;TYPE=voice:${escapeText(contact.phone)}`);

  // One ADR per address, each keeping its own type — this is the whole reason
  // vCard is a good fit for the contact model.
  // ADR is PO Box;Extended;Street;Locality;Region;Postal code;Country.
  for (const address of contact.addresses) {
    const value = structured([
      "",
      "",
      address.street,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ]);
    const type = ADR_TYPE[address.type];
    lines.push(type ? `ADR;TYPE=${type}:${value}` : `ADR:${value}`);
  }

  // vCard 4.0 takes a URI, and a data: URL is one — so the photo embeds as-is.
  if (contact.photo) lines.push(`PHOTO:${contact.photo}`);

  if (contact.notes) lines.push(`NOTE:${escapeText(contact.notes)}`);

  lines.push(`REV:${vcardTimestamp(contact.updated_at)}`);
  lines.push("END:VCARD");

  // vCard requires CRLF line endings, including a trailing one.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
