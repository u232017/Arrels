import type { Locator, Page } from "@playwright/test";

export class ArrelsPage {
  readonly page: Page;
  readonly kpis: Locator;

  constructor(page: Page) {
    this.page = page;
    this.kpis = page.getByRole("region", { name: "Indicadors" });
  }

  async goto() {
    // Keep tests hermetic: no external basemap tiles.
    await this.page.route("**/tiles.openfreemap.org/**", (r) => r.abort());
    await this.page.goto("/");
    await this.kpis.waitFor();
  }

  select(label: string) {
    return this.page.getByRole("combobox", { name: label });
  }

  /** Pick an option in a labelled Radix Select. */
  async choose(label: string, option: string) {
    await this.select(label).click();
    await this.page.getByRole("option", { name: option, exact: true }).click();
  }

  heading(name: string) {
    return this.page.getByRole("heading", { level: 2, name, exact: true });
  }

  kpi(name: RegExp) {
    return this.page.getByRole("article", { name });
  }
}
