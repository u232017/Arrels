import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Pick `option` in the labelled Radix Select called `label`. */
export async function choose(label: string, option: string | RegExp) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  const list = await screen.findByRole("listbox");
  await userEvent.click(within(list).getByRole("option", { name: option }));
}
