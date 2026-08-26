"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import {
  PHOTO_MIME_TYPES,
  fileToAvatarDataUrl,
} from "@/lib/contacts/photo";

/**
 * Photo picker for the contact form.
 *
 * The value the form actually submits lives in a hidden input, so the photo
 * travels with every save exactly like any other field. That matters because the
 * edit form is a full `PUT`: a photo the form did not resend would be cleared.
 */
export default function PhotoField({
  id,
  name,
  defaultValue,
  error,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  error?: string;
}) {
  const [photo, setPhoto] = useState(defaultValue ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const message = localError ?? error;
  const errorId = `${id}-error`;

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be chosen again after a removal.
    event.target.value = "";
    if (!file) return;

    setLocalError(null);
    startTransition(async () => {
      try {
        setPhoto(await fileToAvatarDataUrl(file));
      } catch (cause) {
        setLocalError(
          cause instanceof Error ? cause.message : "Could not read that image",
        );
      }
    });
  }

  return (
    <div>
      <input type="hidden" name={name} value={photo} />

      <div className="flex items-center gap-4">
        {photo ? (
          // A data: URL carries its own bytes: there is nothing for next/image to
          // fetch or optimise, and it cannot be matched by a remote pattern.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt="Selected contact photo"
            className="h-20 w-20 rounded-full aspect-square object-cover ring-1 ring-hairline"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/60"
          >
            <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
          </span>
        )}

        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor={id}
              className={`${buttonClasses("secondary", "sm")} cursor-pointer`}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {photo ? "Change photo" : "Choose photo"}
            </label>

            {photo ? (
              <button
                type="button"
                onClick={() => {
                  setPhoto("");
                  setLocalError(null);
                  fileInput.current?.focus();
                }}
                className={buttonClasses("ghost", "sm")}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Remove
              </button>
            ) : null}
          </div>

          <p className="text-[12px] text-muted-foreground">
            PNG, JPEG, or WebP. Resized to 512px before upload.
          </p>
        </div>
      </div>

      <input
        ref={fileInput}
        id={id}
        type="file"
        accept={PHOTO_MIME_TYPES.join(",")}
        onChange={onPick}
        disabled={pending}
        className="sr-only"
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
      />

      {message ? (
        <p id={errorId} role="alert" className="mt-2 text-[13px] text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
