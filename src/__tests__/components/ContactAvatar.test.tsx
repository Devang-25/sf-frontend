import React from "react";
import { render } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA" +
  "DUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("ContactAvatar", () => {
  it("falls back to initials when the contact has no photo", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: null })} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AL");
  });

  it("renders the photo as a circular, cropped image when there is one", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PNG })} />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", PNG);
    // The LinkedIn-style avatar: a circle that crops rather than distorts.
    expect(img).toHaveClass("rounded-full", "aspect-square", "object-cover");
  });

  it("shows the photo instead of the initials, never both", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PNG })} />,
    );

    expect(container.textContent).toBe("");
  });

  it("stays decorative, since the contact's name is always rendered beside it", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PNG })} />,
    );

    expect(container.querySelector("img")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("applies the requested size to both the photo and the initials", () => {
    const withPhoto = render(
      <ContactAvatar contact={makeContact({ photo: PNG })} size="lg" />,
    );
    expect(withPhoto.container.querySelector("img")).toHaveClass("h-14", "w-14");

    const withInitials = render(
      <ContactAvatar contact={makeContact({ photo: null })} size="lg" />,
    );
    expect(withInitials.container.querySelector("span")).toHaveClass(
      "h-14",
      "w-14",
    );
  });
});
