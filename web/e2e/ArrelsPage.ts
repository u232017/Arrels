import type { Locator, Page } from "@playwright/test";

export class ArrelsPage {
  readonly page: Page;
  readonly barri: Locator;
  readonly from: Locator;
  readonly to: Locator;
  readonly barriName: Locator;
  readonly kpis: Locator;
  readonly method: Locator;

  constructor(page: Page) {
    this.page = page;
    this.barri = page.getByLabel("Barri");
    this.from = page.getByLabel("Des de");
    this.to = page.getByLabel("Fins a");
    this.barriName = page.getByRole("heading", { level: 2 }).first();
    this.kpis = page.getByRole("region", { name: "Indicadors" });
    this.method = page.getByRole("region", { name: "Mètode i limitacions" });
  }

  async goto() {
    // Keep tests hermetic: no external basemap tiles.
    await this.page.route("**/tiles.openfreemap.org/**", (r) => r.abort());
    await this.page.goto("/");
    await this.kpis.waitFor();
  }

  kpi(name: RegExp) {
    return this.page.getByRole("article", { name });
  }
}
