import { expect, test } from "@playwright/test";

// Minimal offline style: the map must load (worker + WebGL) without any external tiles.
const STYLE = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eeeeee" } }] };

test("residence map loads its worker and draws without falling back", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));
  // Playwright gives the most recently added route priority: block everything, then allow the style.
  await page.route("**/tiles.openfreemap.org/**", (r) => r.abort());
  await page.route("**/tiles.openfreemap.org/styles/**", (r) => r.fulfill({ json: STYLE }));

  await page.goto("/?view=detail");
  const map = page.getByRole("img", { name: /mapa dels municipis/i });
  await expect(map.locator("canvas")).toBeVisible();
  await expect(map.locator("canvas")).toHaveAttribute("tabindex", "-1");
  await page.waitForTimeout(1500); // give the worker time to fail if it is going to
  await expect(page.getByText(/mapa no disponible/i)).toHaveCount(0);
  await expect(page.getByTestId("barri-pin")).toContainText("Barri de mostra A"); // selected barri marked
  expect(errors.filter((e) => /worker/i.test(e))).toEqual([]);
});
