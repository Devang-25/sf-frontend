import { getContact } from "@/lib/contacts/api";
import { toVCard, vcardFilename } from "@/lib/contacts/vcard";

/**
 * `GET /contacts/[id]/vcard` — the contact as a downloadable `.vcf`.
 *
 * A route handler rather than a client-side blob: this is a plain link that
 * works without JavaScript, and the browser handles the download natively
 * because the response carries a real `Content-Disposition`.
 *
 * The vCard is built here rather than by the API because it is a presentation
 * format, not a domain concern — the API stays JSON-only and this owns the
 * content negotiation.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Strict: `Number.parseInt` stops at the first non-digit, so "1abc" would
  // parse to 1 and quietly hand back a different contact's card.
  const raw = (await params).id;
  if (!/^[1-9]\d*$/.test(raw)) {
    return new Response("Not found", { status: 404 });
  }
  const id = Number(raw);

  const contact = await getContact(id);
  if (!contact) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(toVCard(contact), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${vcardFilename(contact)}"`,
      // The contact can change at any time, and the file is cheap to rebuild.
      "Cache-Control": "no-store",
    },
  });
}
