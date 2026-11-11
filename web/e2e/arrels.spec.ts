import { expect, test } from "@playwright/test";
import { ArrelsPage } from "./ArrelsPage";

test.describe("Arrels single page", () => {
  let app: ArrelsPage;

  test.beforeEach(async ({ page }) => {
    app = new ArrelsPage(page);
    await app.goto();
  });

  test("switching barri updates the name and the numbers", async () => {
    await expect(app.page.getByRole("heading", { name: "Barri de mostra A" })).toBeVisible();
    const before = await app.kpi(/visitants regionals/i).textContent();
    await app.barri.selectOption({ label: "Barri de mostra B" });
    await expect(app.page.getByRole("heading", { name: "Barri de mostra B" })).toBeVisible();
    await expect(app.kpi(/visitants regionals/i)).not.toHaveText(before ?? "");
  });

  test("month range changes the window shown on the badges", async () => {
    await app.from.selectOption("2024-01");
    await app.to.selectOption("2024-06");
    await expect(app.kpi(/visitants regionals/i)).toContainText("2024-01 – 2024-06");
    await expect(app.kpi(/quota de cap de setmana/i)).toContainText("2024-01 – 2024-06");
  });

  test("every KPI card carries a coverage badge", async () => {
    const cards = app.kpis.getByRole("article");
    await expect(cards).toHaveCount(6);
    for (const card of await cards.all()) {
      await expect(card.getByTestId("coverage-badge")).toBeVisible();
    }
    await expect(app.kpi(/lloguer/i)).toContainText("Sense dada");
  });

  test("limitations section is visible and says patterns, not causes", async () => {
    await app.method.scrollIntoViewIfNeeded();
    await expect(app.method).toBeVisible();
    await expect(app.method).toContainText(/patrons, no causes/i);
    await expect(app.method).toContainText("2024-02-11");
  });

  test("controls work with the keyboard only", async ({ page }) => {
    await page.locator("body").press("Tab");
    await expect(app.barri).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(app.from).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(app.to).toBeFocused();
  });

  test("no horizontal scroll on the page", async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
