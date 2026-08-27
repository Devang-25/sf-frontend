import { z } from "zod";
import { MAX_PHOTO_BYTES, photoValidationError } from "./photo";
import {
  ADDRESS_TYPES,
  type AddressFormValues,
  type AddressInput,
  type ContactScalarInput,
} from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  address: optionalText(300, "Address"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  // Already a data URL by the time it reaches here — the form control encodes it.
  // Checked anyway so a hand-crafted POST fails here rather than at the API.
  photo: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null)
    .superRefine((value, ctx) => {
      const error = photoValidationError(value);
      if (error) ctx.addIssue({ code: "custom", message: error });
    }),
}) satisfies z.ZodType<ContactScalarInput, unknown>;

export type ContactFormValues = z.input<typeof contactInputSchema>;

/** Collapse a ZodError into one message per field, keyed by input name. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    // Address issues arrive as ["addresses", 0, "city"]; flatten them to the
    // submitted input name so the form can attach the message to the right row.
    const key = issue.path.join(".");
    if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface ContactFieldSpec {
  name: keyof ContactScalarInput;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "image";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Photo",
    description:
      "Optional. Shown as a circular avatar; contacts without one keep their initials.",
    fields: [
      {
        name: "photo",
        label: "Photo",
        type: "image",
        // Base64 inflates by ~4/3, so this is the data URL length that corresponds
        // to the API's cap on the decoded image.
        maxLength: Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 64,
        wide: true,
      },
    ],
  },
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** Pull the contact fields out of a submitted form, as raw strings. */
export function formDataToValues(
  formData: FormData,
): Record<keyof ContactScalarInput, string> {
  return Object.fromEntries(
    CONTACT_FIELDS.map((field) => [
      field.name,
      String(formData.get(field.name) ?? ""),
    ]),
  ) as Record<keyof ContactScalarInput, string>;
}

/* ------------------------------------------------------------------ */
/* Addresses                                                           */
/* ------------------------------------------------------------------ */

export interface AddressFieldSpec {
  name: keyof Omit<AddressFormValues, "id" | "type">;
  label: string;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  wide?: boolean;
}

export const ADDRESS_FIELDS: AddressFieldSpec[] = [
  {
    name: "street",
    label: "Street address",
    maxLength: 300,
    placeholder: "1 Market St, Suite 400",
    autoComplete: "street-address",
    wide: true,
  },
  { name: "city", label: "City", maxLength: 120, placeholder: "San Francisco", autoComplete: "address-level2" },
  { name: "state", label: "State / region", maxLength: 120, placeholder: "CA", autoComplete: "address-level1" },
  { name: "postal_code", label: "Postal code", maxLength: 20, placeholder: "94105", autoComplete: "postal-code" },
  { name: "country", label: "Country", maxLength: 120, placeholder: "USA", autoComplete: "country-name" },
];

export const EMPTY_ADDRESS: AddressFormValues = {
  id: "",
  type: "Home",
  street: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

/** The input name for one field of one address row. */
export function addressFieldName(index: number, field: string): string {
  return `addresses.${index}.${field}`;
}

const ADDRESS_ROW_KEY = /^addresses\.(\d+)\./;

/**
 * Pull the address rows out of a submitted form.
 *
 * Rows are discovered from the submitted keys rather than a hidden count, so a
 * row removed in the browser simply stops appearing. Indexes are sorted
 * numerically to preserve the order the user saw.
 */
export function formDataToAddresses(formData: FormData): AddressFormValues[] {
  const indexes = new Set<number>();
  for (const key of formData.keys()) {
    const match = ADDRESS_ROW_KEY.exec(key);
    if (match) indexes.add(Number(match[1]));
  }

  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => {
      const read = (field: string) =>
        String(formData.get(addressFieldName(index, field)) ?? "");
      return {
        id: read("id"),
        type: read("type") || "Home",
        street: read("street"),
        city: read("city"),
        state: read("state"),
        postal_code: read("postal_code"),
        country: read("country"),
      };
    });
}

/** True when the user left a row completely blank, so it should not be saved. */
export function isBlankAddress(values: AddressFormValues): boolean {
  return ADDRESS_FIELDS.every((field) => !values[field.name].trim());
}

export const addressInputSchema = z.object({
  // A row for an existing address carries its id so the API updates in place
  // rather than deleting and recreating it.
  id: z
    .string()
    .trim()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || Number.isInteger(value), "Invalid address")
    .nullable()
    .default(null),
  type: z.enum(ADDRESS_TYPES),
  street: optionalText(300, "Street address"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
}) satisfies z.ZodType<AddressInput, unknown>;

export const addressListSchema = z.array(addressInputSchema);
