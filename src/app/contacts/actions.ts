"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, ApiUnreachableError } from "@/lib/apiClient";
import {
  apiErrorMessage,
  createContact,
  deleteContact,
  replaceContact,
  toFieldErrors,
} from "@/lib/contacts/api";
import {
  addressListSchema,
  contactInputSchema,
  formDataToAddresses,
  formDataToValues,
  isBlankAddress,
  zodFieldErrors,
} from "@/lib/contacts/schema";
import type { Contact, FormState } from "@/lib/contacts/types";

/** Mutations for the contacts UI. Every one of these runs only on the server. */

function invalidate(contactId?: number) {
  revalidatePath("/contacts");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
}

const UNREACHABLE =
  "Could not reach the Contacts API. Check that the backend is running.";

/**
 * Create (when `contactId` is null) or fully replace a contact.
 *
 * Bind the id at the call site — `saveContactAction.bind(null, contact.id)` —
 * so the form itself never carries a mutable record id.
 */
export async function saveContactAction(
  contactId: number | null,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formDataToValues(formData);
  // Rows the user left completely blank are dropped rather than saved as empty
  // addresses; an untouched "add another" row should not create a record.
  const addressValues = formDataToAddresses(formData).filter(
    (address) => !isBlankAddress(address),
  );

  const parsed = contactInputSchema.safeParse(values);
  const parsedAddresses = addressListSchema.safeParse(addressValues);

  if (!parsed.success || !parsedAddresses.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        ...(parsed.success ? {} : zodFieldErrors(parsed.error)),
        // Re-key array issues onto the submitted input names.
        ...(parsedAddresses.success
          ? {}
          : Object.fromEntries(
              Object.entries(zodFieldErrors(parsedAddresses.error)).map(
                ([key, message]) => [`addresses.${key}`, message],
              ),
            )),
      },
      values,
      addressValues,
    };
  }

  let saved: Contact;
  try {
    const input = { ...parsed.data, addresses: parsedAddresses.data };
    saved =
      contactId === null
        ? await createContact(input)
        : await replaceContact(contactId, input);
  } catch (error) {
    if (error instanceof ApiUnreachableError) {
      return { status: "error", message: UNREACHABLE, values, addressValues };
    }
    if (error instanceof ApiError) {
      if (error.status === 409) {
        return {
          status: "error",
          message: "That email address is already taken.",
          fieldErrors: {
            email: apiErrorMessage(error, "This email is already in use."),
          },
          values,
          addressValues,
        };
      }
      if (error.status === 422) {
        return {
          status: "error",
          message: apiErrorMessage(error, "The API rejected these values."),
          fieldErrors: toFieldErrors(error),
          values,
          addressValues,
        };
      }
      return {
        status: "error",
        message: apiErrorMessage(error, "The contact could not be saved."),
        values,
        addressValues,
      };
    }
    throw error;
  }

  invalidate(saved.id);
  // Outside the try/catch: redirect() signals by throwing.
  redirect(`/contacts/${saved.id}`);
}

export interface DeleteResult {
  error?: string;
}

/**
 * Delete a contact. Pass `redirectToList` from the detail page, where staying
 * put would leave the user on a 404.
 */
export async function deleteContactAction(
  contactId: number,
  redirectToList = false,
): Promise<DeleteResult> {
  try {
    await deleteContact(contactId);
  } catch (error) {
    if (error instanceof ApiUnreachableError) return { error: UNREACHABLE };
    if (error instanceof ApiError) {
      return {
        error:
          error.status === 404
            ? "That contact has already been deleted."
            : apiErrorMessage(error, "The contact could not be deleted."),
      };
    }
    throw error;
  }

  invalidate(contactId);
  if (redirectToList) redirect("/contacts");
  return {};
}
