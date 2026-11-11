import { expect, test } from "@playwright/test";
import { ArrelsPage } from "./ArrelsPage";

test.describe("Arrels single page", () => {
  let app: ArrelsPage;

  test.beforeEach(async ({ page }) => {
    app = new ArrelsPage(page);
    await app.goto();
  });

  test("switching barri updates the title, the summary and the numbers", async ({ page }) => {
    await expect(app.heading("Barri de mostra A")).toBeVisible();
    const before = await app.kpi(/visitants regionals/i).textContent();
    await app.choose("Barri", "Barri de mostra B");
    await expect(app.heading("Barri de mostra B")).toBeVisible();
    await expect(page.getByText(/Barri de mostra B va rebre/)).toBeVisible();
    await expect(app.kpi(/visitants regionals/i)).not.toHaveText(before ?? "");
  });

  test("period change updates the summary and the KPI windows", async ({ page }) => {
    await app.choose("Des de", "gener 2024");
    await app.choose("Fins a", "juny 2024");
    await expect(page.getByText(/^Entre gener de 2024 i juny de 2024/)).toBeVisible();
    await expect(app.kpi(/visitants regionals/i).getByTestId("coverage-badge"))
      .toHaveAccessibleName(/2024-01 – 2024-06/);
    await expect(app.kpi(/canvi vs any anterior/i)).toContainText("vs mateixos mesos de l'any anterior");
  });

  test("the change card is hidden when the previous year is not available", async () => {
    await app.choose("Des de", "gener 2023");
    await app.choose("Fins a", "desembre 2023");
    await expect(app.kpi(/canvi vs any anterior/i)).toHaveCount(0);
  });

  test("status dots show their coverage details in a tooltip", async ({ page }) => {
    const dot = app.kpi(/quota de cap de setmana/i).getByTestId("coverage-badge");
    await expect(dot).toHaveText("Parcialment <15");
    await dot.hover();
    await expect(page.getByRole("tooltip")).toContainText("% publicat");
    await expect(app.kpis).not.toContainText("Finestra"); // never the long line on screen
  });

  test("no KPI card is empty", async () => {
    const cards = app.kpis.getByRole("article");
    await expect(cards).toHaveCount(3);
    await expect(app.kpis).not.toContainText("Sense dada");
    await expect(app.kpis).not.toContainText("Pendent");
  });

  test("both accordions start collapsed and open", async ({ page }) => {
    for (const name of ["Veure les dades", "Mètode i limitacions"]) {
      const trigger = page.getByRole("button", { name });
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
    }
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("region", { name: "Mètode i limitacions" })).toContainText(/patrons, no causes/i);
  });

  test("ranking lists towns with share of the total", async ({ page }) => {
    const items = page.getByRole("list", { name: /municipis de residència/i }).getByRole("listitem");
    await expect(items.first()).toContainText("%");
  });

  test("controls work with the keyboard only", async ({ page }) => {
    await page.locator("body").press("Tab");
    await expect(app.select("Barri")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(app.select("Des de")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(app.select("Fins a")).toBeFocused();
  });

  test("no horizontal scroll", async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
