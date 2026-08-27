import {
  addressFieldName,
  addressListSchema,
  formDataToAddresses,
  isBlankAddress,
} from "@/lib/contacts/schema";
import { EMPTY_ADDRESS } from "@/lib/contacts/schema";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("formDataToAddresses", () => {
  it("reads a single row", () => {
    const rows = formDataToAddresses(
      form({
        "addresses.0.type": "Work",
        "addresses.0.street": "1 Market St",
        "addresses.0.city": "San Francisco",
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "Work",
      street: "1 Market St",
      city: "San Francisco",
      country: "",
    });
  });

  it("keeps rows in index order regardless of insertion order", () => {
    const rows = formDataToAddresses(
      form({
        "addresses.2.city": "Third",
        "addresses.0.city": "First",
        "addresses.1.city": "Second",
      }),
    );

    expect(rows.map((row) => row.city)).toEqual(["First", "Second", "Third"]);
  });

  it("sorts numerically, not lexicographically", () => {
    const rows = formDataToAddresses(
      form({ "addresses.10.city": "Ten", "addresses.2.city": "Two" }),
    );

    expect(rows.map((row) => row.city)).toEqual(["Two", "Ten"]);
  });

  it("handles a gap left by a removed row", () => {
    const rows = formDataToAddresses(
      form({ "addresses.0.city": "Kept", "addresses.2.city": "Also kept" }),
    );

    expect(rows.map((row) => row.city)).toEqual(["Kept", "Also kept"]);
  });

  it("carries the id of an existing address so it is updated, not recreated", () => {
    const rows = formDataToAddresses(
      form({ "addresses.0.id": "7", "addresses.0.city": "London" }),
    );

    expect(rows[0].id).toBe("7");
  });

  it("defaults a missing type to Home", () => {
    const rows = formDataToAddresses(form({ "addresses.0.city": "Paris" }));
    expect(rows[0].type).toBe("Home");
  });

  it("returns nothing when the form has no address rows", () => {
    expect(formDataToAddresses(form({ first_name: "Ada" }))).toEqual([]);
  });

  it("ignores keys that merely look like address rows", () => {
    expect(formDataToAddresses(form({ addresses: "1", "addresses.x.city": "No" }))).toEqual(
      [],
    );
  });
});

describe("isBlankAddress", () => {
  it("treats an untouched row as blank, even though it has a type", () => {
    expect(isBlankAddress({ ...EMPTY_ADDRESS })).toBe(true);
  });

  it("treats whitespace as blank", () => {
    expect(isBlankAddress({ ...EMPTY_ADDRESS, city: "   " })).toBe(true);
  });

  it("is not blank once any part is filled in", () => {
    expect(isBlankAddress({ ...EMPTY_ADDRESS, city: "London" })).toBe(false);
  });
});

describe("addressListSchema", () => {
  it("turns blank optional parts into null and keeps the id numeric", () => {
    const parsed = addressListSchema.parse([
      { id: "7", type: "Work", street: " 1 Market St ", city: "", state: "", postal_code: "", country: "USA" },
    ]);

    expect(parsed[0]).toEqual({
      id: 7,
      type: "Work",
      street: "1 Market St",
      city: null,
      state: null,
      postal_code: null,
      country: "USA",
    });
  });

  it("gives a new row a null id, so the API creates it", () => {
    const parsed = addressListSchema.parse([{ ...EMPTY_ADDRESS, city: "Paris" }]);
    expect(parsed[0].id).toBeNull();
  });

  it("rejects a type outside the allowed set", () => {
    const result = addressListSchema.safeParse([
      { ...EMPTY_ADDRESS, type: "Holiday", city: "Nice" },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects a value longer than the API allows", () => {
    const result = addressListSchema.safeParse([
      { ...EMPTY_ADDRESS, postal_code: "x".repeat(21) },
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts an empty list, which clears a contact's addresses", () => {
    expect(addressListSchema.parse([])).toEqual([]);
  });
});

describe("addressFieldName", () => {
  it("builds the name the parser expects", () => {
    expect(addressFieldName(2, "city")).toBe("addresses.2.city");
  });
});
