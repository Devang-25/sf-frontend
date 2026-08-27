"use client";

import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import {
  ADDRESS_FIELDS,
  EMPTY_ADDRESS,
  addressFieldName,
} from "@/lib/contacts/schema";
import { ADDRESS_TYPES, type AddressFormValues } from "@/lib/contacts/types";

const CONTROL =
  "w-full rounded-md border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:bg-input";

/**
 * The repeatable address section of the contact form.
 *
 * Each row submits `addresses.<index>.<field>`, including a hidden `id` for rows
 * that already exist. The API updates those in place and deletes anything absent
 * from the list, so removing a row here removes the address on save.
 *
 * Rows carry a stable `key` of their own rather than using the array index, so
 * removing one does not make React reuse the wrong row's DOM state.
 */
export default function AddressFields({
  defaultValues,
  fieldErrors,
}: {
  defaultValues: AddressFormValues[];
  fieldErrors?: Record<string, string>;
}) {
  const [rows, setRows] = useState(() =>
    defaultValues.map((values, index) => ({ key: `saved-${index}`, values })),
  );
  const [nextKey, setNextKey] = useState(0);

  function addRow() {
    setRows((current) => [
      ...current,
      { key: `new-${nextKey}`, values: { ...EMPTY_ADDRESS } },
    ]);
    setNextKey((value) => value + 1);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-[13px] text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          No addresses yet.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <fieldset
          key={row.key}
          className="rounded-lg border border-border bg-card/40 p-4"
        >
          <legend className="sr-only">Address {index + 1}</legend>

          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <label
                htmlFor={`address-${index}-type`}
                className="mb-1.5 block text-[13px] font-medium text-foreground"
              >
                Type
              </label>
              <select
                id={`address-${index}-type`}
                name={addressFieldName(index, "type")}
                defaultValue={row.values.type}
                className={`${CONTROL} border-border focus:border-primary`}
              >
                {ADDRESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => removeRow(row.key)}
              aria-label={`Remove address ${index + 1}`}
              className={buttonClasses("ghost", "sm")}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Remove
            </button>
          </div>

          {/* Existing addresses carry their id so the API updates them in place
              rather than deleting and recreating the row. */}
          {row.values.id ? (
            <input
              type="hidden"
              name={addressFieldName(index, "id")}
              value={row.values.id}
            />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {ADDRESS_FIELDS.map((field) => {
              const name = addressFieldName(index, field.name);
              const error = fieldErrors?.[name];
              const id = `address-${index}-${field.name}`;

              return (
                <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
                  <label
                    htmlFor={id}
                    className="mb-1.5 block text-[13px] font-medium text-foreground"
                  >
                    {field.label}
                  </label>
                  <input
                    id={id}
                    name={name}
                    type="text"
                    defaultValue={row.values[field.name]}
                    maxLength={field.maxLength}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`${CONTROL} ${
                      error
                        ? "border-destructive focus:border-destructive"
                        : "border-border focus:border-primary"
                    }`}
                  />
                  {error ? (
                    <p
                      id={`${id}-error`}
                      role="alert"
                      className="mt-1.5 text-[13px] text-destructive"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <button type="button" onClick={addRow} className={buttonClasses("secondary", "sm")}>
        <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Add address
      </button>
    </div>
  );
}
