import { toVCard, vcardFilename, vcardTimestamp } from "@/lib/contacts/vcard";
import { makeContact } from "../../mocks/handlers";
import type { Address } from "@/lib/contacts/types";

function address(overrides: Partial<Address> = {}): Address {
  return {
    id: 1,
    type: "Work",
    street: "1 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: "94105",
    country: "USA",
    formatted: "",
    ...overrides,
  };
}

function lines(card: string): string[] {
  // Unfold first: a continuation is CRLF followed by a single space.
  return card.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
}

describe("toVCard", () => {
  it("produces a well-formed vCard 4.0 envelope", () => {
    const card = toVCard(makeContact());
    const l = lines(card);

    expect(l[0]).toBe("BEGIN:VCARD");
    expect(l[1]).toBe("VERSION:4.0");
    expect(l[l.length - 1]).toBe("END:VCARD");
    expect(card.endsWith("\r\n")).toBe(true);
  });

  it("uses CRLF line endings, as the spec requires", () => {
    expect(toVCard(makeContact())).toContain("\r\n");
    expect(toVCard(makeContact()).replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("writes the name as both FN and structured N", () => {
    const l = lines(toVCard(makeContact()));
    expect(l).toContain("FN:Ada Lovelace");
    expect(l).toContain("N:Lovelace;Ada;;;");
  });

  it("emits one ADR per address, each keeping its own type", () => {
    const contact = makeContact({
      addresses: [
        address({ id: 1, type: "Work" }),
        address({ id: 2, type: "Home", street: "12 Ockham Road", city: "London", state: null, postal_code: null, country: "UK" }),
      ],
    });

    const adr = lines(toVCard(contact)).filter((line) => line.startsWith("ADR"));

    expect(adr).toHaveLength(2);
    expect(adr[0]).toBe("ADR;TYPE=work:;;1 Market St;San Francisco;CA;94105;USA");
    expect(adr[1]).toBe("ADR;TYPE=home:;;12 Ockham Road;London;;;UK");
  });

  it("writes an Other address untyped, since vCard registers only work and home", () => {
    const contact = makeContact({ addresses: [address({ type: "Other" })] });
    const adr = lines(toVCard(contact)).filter((l) => l.startsWith("ADR"));

    expect(adr).toHaveLength(1);
    // Untyped, not TYPE=other — that is not a registered value (RFC 6350 §5.6).
    expect(adr[0]).toBe("ADR:;;1 Market St;San Francisco;CA;94105;USA");
    expect(adr[0]).not.toContain("TYPE=");
  });

  it("still emits an Other address rather than skipping it", () => {
    const contact = makeContact({
      addresses: [address({ id: 1, type: "Work" }), address({ id: 2, type: "Other" })],
    });
    expect(lines(toVCard(contact)).filter((l) => l.startsWith("ADR"))).toHaveLength(2);
  });

  it("writes REV in ISO 8601 basic format", () => {
    const card = toVCard(makeContact({ updated_at: "2026-08-27T00:12:14.123456Z" }));
    // Basic format: no dashes, no colons, no fractional seconds.
    expect(lines(card)).toContain("REV:20260827T001214Z");
  });

  it("omits ADR entirely for a contact with no addresses", () => {
    const contact = makeContact({ addresses: [] });
    expect(lines(toVCard(contact)).some((l) => l.startsWith("ADR"))).toBe(false);
  });

  it("escapes the structural characters in a text value", () => {
    const contact = makeContact({
      last_name: "Smith; Jr",
      notes: "Line one\nLine two, with a comma",
    });
    const l = lines(toVCard(contact));

    expect(l).toContain("N:Smith\\; Jr;Ada;;;");
    expect(l).toContain("NOTE:Line one\\nLine two\\, with a comma");
  });

  it("escapes a semicolon inside an address part so fields cannot shift", () => {
    const contact = makeContact({
      addresses: [address({ street: "Unit 3; Building B", city: null, state: null, postal_code: null, country: null })],
    });

    expect(lines(toVCard(contact))).toContain("ADR;TYPE=work:;;Unit 3\\; Building B;;;;");
  });

  it("embeds the photo as a data URI", () => {
    const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const card = toVCard(makeContact({ photo }));
    expect(card.replace(/\r\n /g, "")).toContain(`PHOTO:${photo}`);
  });

  it("omits PHOTO when the contact has none", () => {
    expect(lines(toVCard(makeContact({ photo: null })))).not.toContainEqual(
      expect.stringContaining("PHOTO"),
    );
  });

  it("folds long lines to 75 octets so strict parsers accept them", () => {
    const photo = `data:image/jpeg;base64,${"A".repeat(5000)}`;
    const card = toVCard(makeContact({ photo }));

    const encoder = new TextEncoder();
    for (const line of card.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("never splits a multi-byte character across a fold", () => {
    // Each of these is 3 UTF-8 octets, so a naive character-count fold would
    // straddle one.
    const contact = makeContact({ notes: "☃".repeat(200) });
    const card = toVCard(contact);

    expect(card.replace(/\r\n /g, "")).toContain(`NOTE:${"☃".repeat(200)}`);
    for (const line of card.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("round-trips: unfolding recovers every original value", () => {
    const contact = makeContact({
      addresses: [address(), address({ id: 2, type: "Home", street: "12 Ockham Road" })],
      photo: `data:image/png;base64,${"B".repeat(3000)}`,
    });

    const unfolded = lines(toVCard(contact));
    expect(unfolded.filter((l) => l.startsWith("ADR"))).toHaveLength(2);
    expect(unfolded.some((l) => l === `PHOTO:${contact.photo}`)).toBe(true);
  });
});

describe("vcardFilename", () => {
  it("slugifies the contact's name", () => {
    expect(vcardFilename({ full_name: "Ada Lovelace", id: 1 })).toBe("ada-lovelace.vcf");
  });

  it("collapses punctuation rather than emitting it in a filename", () => {
    expect(vcardFilename({ full_name: "O'Brien, Seán Jr.", id: 3 })).toBe("o-brien-se-n-jr.vcf");
  });

  it("falls back to the id when the name slugifies to nothing", () => {
    expect(vcardFilename({ full_name: "☃☃", id: 42 })).toBe("contact-42.vcf");
  });
});

describe("vcardTimestamp", () => {
  it("strips the separators toISOString adds", () => {
    expect(vcardTimestamp("2026-08-27T00:12:14.123Z")).toBe("20260827T001214Z");
  });

  it("normalises an offset to UTC", () => {
    expect(vcardTimestamp("2026-08-27T02:12:14+02:00")).toBe("20260827T001214Z");
  });

  it("returns an empty string for an unparseable timestamp", () => {
    expect(vcardTimestamp("not a date")).toBe("");
  });
});
