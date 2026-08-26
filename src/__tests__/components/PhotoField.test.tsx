import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "@/components/contacts/ContactForm";
import { makeContact } from "../mocks/handlers";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA" +
  "DUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const NEW_PHOTO = "data:image/jpeg;base64,/9j/4AAQU2Vjb25k";

/**
 * `fileToAvatarDataUrl` needs a real canvas, which jsdom does not provide, so it
 * is mocked here. Each call is resolved by hand, which is what lets these tests
 * hold a conversion open and exercise the races around it.
 */
jest.mock("@/lib/contacts/photo", () => ({
  ...jest.requireActual("@/lib/contacts/photo"),
  fileToAvatarDataUrl: jest.fn(),
}));

import { fileToAvatarDataUrl } from "@/lib/contacts/photo";

const convert = fileToAvatarDataUrl as jest.MockedFunction<
  typeof fileToAvatarDataUrl
>;

function pngFile(name = "avatar.png") {
  return new File(["bytes"], name, { type: "image/png" });
}

function photoValue(): string {
  return (
    document.querySelector<HTMLInputElement>('input[name="photo"]')?.value ?? ""
  );
}

function renderForm(action = jest.fn(), contact?: ReturnType<typeof makeContact>) {
  render(
    <ContactForm
      action={action as never}
      contact={contact}
      submitLabel="Save changes"
      cancelHref="/contacts"
    />,
  );
  return action;
}

beforeEach(() => convert.mockReset());

describe("PhotoField", () => {
  it("carries an existing photo in the hidden input so a full PUT keeps it", () => {
    renderForm(jest.fn(), makeContact({ photo: PNG }));
    expect(photoValue()).toBe(PNG);
  });

  it("submits the encoded photo once a conversion finishes", async () => {
    convert.mockResolvedValue(NEW_PHOTO);
    renderForm();

    await userEvent.upload(screen.getByLabelText(/photo/i), pngFile());

    await waitFor(() => expect(photoValue()).toBe(NEW_PHOTO));
  });

  it("clears the photo when it is removed", async () => {
    renderForm(jest.fn(), makeContact({ photo: PNG }));

    await userEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(photoValue()).toBe("");
  });

  it("reports a conversion failure without changing the current photo", async () => {
    convert.mockRejectedValue(new Error("Choose a PNG, JPEG, or WebP image"));
    renderForm(jest.fn(), makeContact({ photo: PNG }));

    await userEvent.upload(screen.getByLabelText(/photo/i), pngFile());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Choose a PNG, JPEG, or WebP image/,
    );
    expect(photoValue()).toBe(PNG);
  });

  it("blocks submission while an image is still being encoded", async () => {
    let finish: (value: string) => void = () => {};
    convert.mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    const action = renderForm();

    await userEvent.upload(screen.getByLabelText(/photo/i), pngFile());

    // Mid-conversion the submit is held, so the stale value cannot be saved.
    const submit = screen.getByRole("button", { name: /preparing/i });
    expect(submit).toBeDisabled();
    expect(action).not.toHaveBeenCalled();

    finish(NEW_PHOTO);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled(),
    );
    expect(photoValue()).toBe(NEW_PHOTO);
  });

  it("does not let a conversion that resolves after Remove restore the photo", async () => {
    let finish: (value: string) => void = () => {};
    convert.mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    renderForm(jest.fn(), makeContact({ photo: PNG }));

    await userEvent.upload(screen.getByLabelText(/photo/i), pngFile());
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(photoValue()).toBe("");

    // The superseded conversion lands afterwards and must be discarded.
    finish(NEW_PHOTO);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled(),
    );
    expect(photoValue()).toBe("");
  });

  it("disables the file input while converting, so picks cannot overlap", async () => {
    convert.mockReturnValue(new Promise<string>(() => {}));
    renderForm();

    const input = screen.getByLabelText(/photo/i);
    await userEvent.upload(input, pngFile());

    expect(input).toBeDisabled();
  });
});
