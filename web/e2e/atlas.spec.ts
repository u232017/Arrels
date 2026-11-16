import { expect, test } from "@playwright/test";

test("keeps the price layer and neighborhood panel in sync with the month", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Mobilitat simulada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "La Vila de Gràcia", exact: true })).toHaveAttribute("aria-pressed", "true");
  const panel = page.getByRole("complementary", { name: "Fitxa de barri" });
  await expect(panel.getByRole("heading", { name: "La Vila de Gràcia", exact: true })).toBeVisible();

  const search = page.getByRole("combobox", { name: "Cerca un barri" });
  await search.fill("sant antoni");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(panel.getByRole("heading", { name: "Sant Antoni" })).toBeVisible();

  const sale = page.getByRole("button", { name: "Compravenda €/m²", exact: true });
  await sale.click();
  await expect(sale).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("heading", { name: "Compravenda per m²" })).toBeVisible();
  const map = page.getByRole("group", { name: /Mapa dels 73/ });
  await expect(map.getByRole("button", { name: "Sant Antoni", exact: true })).not.toHaveAttribute("fill", /url/);

  const slider = page.getByRole("slider", { name: "Mes del mapa" });
  await slider.press("End");
  await expect(slider).toHaveAttribute("aria-valuetext", "agost 2025");
  await expect(map.getByRole("button", { name: "Sant Antoni", exact: true })).not.toHaveAttribute("fill", /atlas-unavailable/);

  await sale.click();
  await slider.press("Home");
  await expect(panel.getByText("Període de referència")).toBeVisible();
  await expect(panel.getByRole("region", { name: "Procedència dels visitants" })).toBeVisible();
  await page.getByRole("button", { name: "Procedències", exact: true }).click();
  await expect(page.getByText("Gruix = quota de visitants")).toHaveCount(0);
  await page.getByRole("button", { name: "Reprodueix la cronologia" }).click();
  await expect(slider).not.toHaveAttribute("aria-valuetext", "gener 2023");
  await page.getByRole("button", { name: "Pausa la cronologia" }).click();
});

test("shows Marina prices with their source area and starts variation in February 2023", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Cerca un barri" });
  await search.fill("la marina del prat vermell");
  await search.press("Enter");
  const panel = page.getByRole("complementary", { name: "Fitxa de barri" });
  await expect(panel.getByRole("heading", { name: "La Marina del Prat Vermell", exact: true })).toBeVisible();
  const marina = page.getByRole("group", { name: /Mapa dels 73/ }).getByRole("button", { name: "La Marina del Prat Vermell", exact: true });

  await page.getByRole("button", { name: "Lloguer €/m²", exact: true }).click();
  const rentKpi = panel.getByRole("article").filter({ hasText: "Lloguer / m²" });
  await expect(rentKpi.getByText("17,98 €", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Àmbit de la font.*Zona Franca/)).toBeVisible();
  await expect(marina).toHaveAttribute("fill", /atlas-expanded/);
  await page.getByRole("button", { name: "Compravenda €/m²", exact: true }).click();
  await expect(panel.getByRole("article").filter({ hasText: "Compravenda / m²" })
    .getByText("6.637 €", { exact: true })).toBeVisible();
  await expect(marina).not.toHaveAttribute("fill", /atlas-expanded/);

  const slider = page.getByRole("slider", { name: "Mes del mapa" });
  await page.getByRole("button", { name: "Lloguer €/m²", exact: true }).click();
  await slider.press("Home");
  await expect(rentKpi.getByText("2023 T1 · Sense dada")).toBeVisible();
  const priceSeries = panel.getByRole("region", { name: "Lloguer per m²" });
  await priceSeries.getByText("Veure valors", { exact: true }).click();
  await expect(priceSeries.getByRole("definition").filter({ hasText: "Sense dada publicada" }).first()).toBeVisible();
  await expect(marina).toHaveAttribute("fill", /atlas-unavailable/);
  await page.getByRole("button", { name: "Canvi de visitants", exact: true }).click();
  await expect(panel.getByText("Període de referència", { exact: true })).toBeVisible();
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", "febrer 2023");
  await expect(panel.getByRole("article").filter({ hasText: "Canvi de visitants" })).toContainText(/[%]/);
  await expect(marina).not.toHaveAttribute("fill", /atlas-unavailable/);
});

test("opens housing resources, district context and the affordability comparator", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Habitatge i ajuts", exact: true }).click();
  await expect(page.getByRole("link", { name: /Habitatge protegit/ })).toHaveAttribute("href", /consorcihabitatge\.barcelona/);
  await page.getByRole("button", { name: "Compara lloguers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Barri Match" })).toBeVisible();
  await page.getByLabel("Pressupost mensual (€)").fill("1");
  await expect(page.getByText(/Cap barri amb un preu/)).toBeVisible();
  await page.getByRole("button", { name: "Metodologia", exact: true }).click();
  await expect(page.getByRole("rowheader", { name: "Gràcia" })).toBeVisible();
});

test("shows monthly trip origins and keeps residential origins annual", async ({ page }) => {
  await page.goto("/");
  const source = page.getByRole("combobox", { name: "Tipus de procedència" });
  const slider = page.getByRole("slider", { name: "Mes del mapa" });
  const arrows = page.locator(".atlas-flows path[marker-end]");

  await source.selectOption("trips");
  const trips = page.getByRole("region", { name: "Barris d’origen dels viatges" });
  await expect(trips.getByText("Telefónica · març 2025")).toBeVisible();
  const tripTotal = trips.getByText(/viatges publicats des d’altres barris/);
  await expect(tripTotal).toBeVisible();
  const marchTrips = await tripTotal.innerText();
  await expect(arrows).toHaveCount(5);
  await slider.press("ArrowLeft");
  await expect(trips.getByText("Telefónica · febrer 2025")).toBeVisible();
  await expect(tripTotal).not.toHaveText(marchTrips);

  await source.selectOption("moves");
  const moves = page.getByRole("region", { name: "Barris d’origen dels canvis de domicili" });
  await expect(moves.getByText("Padró · 2025")).toBeVisible();
  const moveTotal = moves.getByText(/canvis publicats des d’altres barris/);
  await expect(moveTotal).toContainText("orígens censurats (<5)");
  const annualMoves = await moveTotal.innerText();
  await expect(arrows).toHaveCount(5);
  await slider.press("ArrowRight");
  await expect(moveTotal).toHaveText(annualMoves);
  await slider.press("Home");
  await expect(moves.getByText("Padró · 2023")).toBeVisible();
  await expect(moveTotal).not.toHaveText(annualMoves);

  await source.selectOption("municipalities");
  await expect(page.getByRole("region", { name: "Procedència dels visitants" })).toBeVisible();
});
