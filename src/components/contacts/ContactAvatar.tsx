import type { CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

type AvatarContact = Pick<
  Contact,
  "first_name" | "last_name" | "email" | "photo"
>;

/**
 * The contact's photo as a circular avatar, falling back to a tinted initials
 * bubble when there is no photo.
 *
 * Decorative either way: every place this renders shows the contact's name
 * beside it, so an alt text here would just be read out twice.
 */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: AvatarContact;
  size?: keyof typeof SIZES;
}) {
  if (contact.photo) {
    return (
      // A data: URL carries its own bytes: there is nothing for next/image to
      // fetch or optimise, and it cannot be matched by a remote pattern.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={contact.photo}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-full aspect-square object-cover ring-1 ring-hairline ${SIZES[size]}`}
      />
    );
  }

  const style = {
    "--avatar-hue": avatarHue(contact.email),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-semibold ${SIZES[size]}`}
    >
      {initials(contact)}
    </span>
  );
}
