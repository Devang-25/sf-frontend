import {
  addressLine,
  groupAddressesByType,
  avatarHue,
  formatTimestamp,
  initials,
  jobLine,
} from "@/lib/contacts/format";
import type { Address } from "@/lib/contacts/types";
import { makeContact } from "../../mocks/handlers";

describe("initials", () => {
  it("takes the first letter of each name", () => {
    expect(initials({ first_name: "ada", last_name: "lovelace" })).toBe("AL");
  });
});

describe("avatarHue", () => {
  it("is stable for the same seed and within the hue range", () => {
    expect(avatarHue("ada@example.com")).toBe(avatarHue("ada@example.com"));
    expect(avatarHue("ada@example.com")).toBeGreaterThanOrEqual(0);
    expect(avatarHue("ada@example.com")).toBeLessThan(360);
  });

  it("separates different seeds", () => {
    expect(avatarHue("ada@example.com")).not.toBe(avatarHue("grace@example.com"));
  });
});

describe("formatTimestamp", () => {
  it("renders UTC regardless of the machine's zone", () => {
    expect(formatTimestamp("2026-08-19T17:04:53.743932Z")).toBe(
      "19 Aug 2026, 17:04 UTC",
    );
  });

  it("degrades to a dash on garbage input", () => {
    expect(formatTimestamp("not a date")).toBe("—");
  });
});

describe("jobLine", () => {
  it("joins the title and the company", () => {
    expect(jobLine(makeContact())).toBe("Mathematician at Analytical Engines");
  });

  it("falls back to whichever one is set", () => {
    expect(jobLine(makeContact({ company: null }))).toBe("Mathematician");
    expect(jobLine(makeContact({ job_title: null }))).toBe("Analytical Engines");
    expect(jobLine(makeContact({ job_title: null, company: null }))).toBeNull();
  });
});

describe("addressLine", () => {
  function makeAddress(overrides: Partial<Address> = {}): Address {
    return {
      id: 1,
      type: "Work",
      street: null,
      city: "San Francisco",
      state: "CA",
      postal_code: null,
      country: "USA",
      formatted: "",
      ...overrides,
    };
  }

  it("skips the parts that are not filled in", () => {
    expect(addressLine(makeAddress())).toBe("San Francisco, CA, USA");
  });

  it("pairs the state with the postal code", () => {
    expect(
      addressLine(makeAddress({ street: "1 Market St", postal_code: "94105" })),
    ).toBe("1 Market St, San Francisco, CA 94105, USA");
  });

  it("returns null when there is no address at all", () => {
    expect(
      addressLine(
        makeAddress({ city: null, state: null, country: null, postal_code: null }),
      ),
    ).toBeNull();
  });
});

describe("groupAddressesByType", () => {
  function at(id: number, type: Address["type"]): Address {
    return {
      id,
      type,
      street: `${id} Test St`,
      city: "London",
      state: null,
      postal_code: null,
      country: "UK",
      formatted: `${id} Test St, London, UK`,
    };
  }

  it("buckets addresses by type, in declared order", () => {
    const groups = groupAddressesByType([at(1, "Work"), at(2, "Home"), at(3, "Other")]);
    expect(groups.map((group) => group.type)).toEqual(["Home", "Work", "Other"]);
  });

  it("keeps several addresses of the same type together", () => {
    const groups = groupAddressesByType([at(1, "Work"), at(2, "Work")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].addresses.map((a) => a.id)).toEqual([1, 2]);
  });

  it("omits types the contact has no address for", () => {
    const groups = groupAddressesByType([at(1, "Home")]);
    expect(groups.map((group) => group.type)).toEqual(["Home"]);
  });

  it("returns nothing for a contact with no addresses", () => {
    expect(groupAddressesByType([])).toEqual([]);
  });
});
