/**
 * Types mirroring the Contacts API OpenAPI 3.1 document (`GET /openapi.json`).
 * Field names stay snake_case so payloads map 1:1 onto the wire format.
 */

/** `AddressType` — what a given address is for. */
export const ADDRESS_TYPES = ["Home", "Work", "Other"] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

/** `AddressRead` — one stored address belonging to a contact. */
export interface Address {
  id: number;
  type: AddressType;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  /** Server-computed one-liner, skipping the parts that are not set. */
  formatted: string;
}

/**
 * `AddressWrite` — one address in a create or replace body.
 *
 * `id` identifies an existing address to update in place; omitting it creates a
 * new one, and any address left out of the list is deleted.
 */
export interface AddressInput {
  id: number | null;
  type: AddressType;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

/** `ContactRead` — a stored contact, as returned by every contact endpoint. */
export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  notes: string | null;
  /** Profile picture as a base64 `data:` URL, or `null` to fall back to initials. */
  photo: string | null;
  addresses: Address[];
  /** Server-computed convenience: the first address on one line, for list views. */
  primary_address: string | null;
  created_at: string;
  updated_at: string;
  full_name: string;
}

/** The scalar editable fields, i.e. everything on the contact bar its addresses. */
export type ContactScalarInput = Omit<
  Contact,
  | "id"
  | "created_at"
  | "updated_at"
  | "full_name"
  | "addresses"
  | "primary_address"
>;

/** Every editable field, i.e. `ContactCreate` / `ContactReplace`. */
export interface ContactInput extends ContactScalarInput {
  addresses: AddressInput[];
}

/** `ContactPage` — one page of contacts plus the totals needed to paginate. */
export interface ContactPage {
  items: Contact[];
  total: number;
  limit: number;
  offset: number;
}

/** `HealthResponse` — result of the liveness probe. */
export interface HealthResponse {
  status: string;
  database: string;
  contacts: number;
}

/** Sort fields the API's allow-list accepts. */
export const SORT_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "company",
  "created_at",
  "updated_at",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

/** Bounds the API enforces on `limit`. */
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 200;
export const DEFAULT_PER_PAGE = 25;
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Result of a server action, consumed by `useActionState` in the forms.
 * Lives here (not in the `"use server"` module) so client components can import
 * the type without pulling server code into the browser bundle.
 */
export type FormState = {
  status: "idle" | "error";
  /** Message shown above the form; used for API-level failures. */
  message?: string;
  /**
   * Per-field messages. Scalar fields are keyed by input name; address fields
   * use the submitted `addresses.<index>.<field>` key.
   */
  fieldErrors?: Record<string, string>;
  /** Echo of the submitted values so the form survives a failed round trip. */
  values?: Partial<Record<keyof ContactScalarInput, string>>;
  /** Echo of the submitted addresses, so added rows survive a failed round trip. */
  addressValues?: AddressFormValues[];
};

/** One address row as it comes out of the form, before validation. */
export interface AddressFormValues {
  id: string;
  type: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export const EMPTY_FORM_STATE: FormState = { status: "idle" };
