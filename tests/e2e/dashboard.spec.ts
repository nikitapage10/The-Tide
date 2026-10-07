import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import ids from "../../fixtures/ids.json";

const ID = ids.ids;
test.describe.configure({ mode: "serial" });

async function axe(page: Page) {
  // @axe-core/playwright is typed against a newer Playwright; the runtime API is compatible.
  const results = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}

test("home shows real summaries, demo labels and unresolved lore", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "The Tide" })).toBeVisible();
  await expect(page.getByText("Echoes through the void.").first()).toBeAttached();
  await expect(page.getByText("No session is scheduled.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Undertow, the Age of the Abyssal Veil and The Tide" })).toBeVisible();
  for (const name of ["World", "People", "Stories", "Studio", "Workshop"]) {
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
  await axe(page);
});

test("keyboard: skip link first, visible focus, search by Unicode-insensitive name", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  const outline = await skip.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await page.getByRole("link", { name: "Search the archive" }).click();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("teruanga");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /1 result/ })).toBeVisible();
  await page.getByRole("link", { name: "Teruānga" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Teruānga" })).toBeVisible();
  await expect(page.getByText("source material has not been supplied")).toBeVisible();
  await expect(page.getByRole("button", { name: /edit in space/i })).toHaveCount(0);
  await axe(page);
});

test("filters and two-way relationship navigation", async ({ page }) => {
  await page.goto("/people?tag=the+eight+peoples");
  await expect(page.getByRole("heading", { name: "8 entries matching filters" })).toBeVisible();
  await page.getByRole("link", { name: "Nyth’rok" }).click();
  await page.getByRole("link", { name: "Future Earth" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Future Earth" })).toBeVisible();
  const peoples = page.getByRole("definition").filter({ has: page.getByRole("link", { name: "Umbrasa" }) });
  await expect(peoples.getByRole("link")).toHaveCount(8);
  await page.goto("/world?canon=demo&status=all");
  await expect(page.getByRole("link", { name: "Demo place" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cataclysms", exact: true })).toHaveCount(0);
});

test("session live state, checklist and GM notes work and appear on Home", async ({ page }) => {
  await page.goto(`/stories/sessions/${ID.ss_1}`);
  await expect(page.getByText("Published from Space Pages · read-only")).toBeVisible();
  await page.getByLabel("Status").selectOption("scheduled");
  await page.getByLabel("Scheduled for").fill("2099-01-15");
  await page.getByRole("button", { name: "Save session state" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.getByLabel("New prep item").fill("E2E prep item");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const box = page.getByRole("checkbox", { name: "E2E prep item" });
  await expect(box).toBeVisible();
  await box.check();
  await expect(page.getByText("2 of 4 done")).toBeVisible();

  await page.getByLabel("Add a GM note").fill("E2E private note");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("E2E private note")).toBeVisible();
  await axe(page);

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Demo session 1" }).first()).toBeVisible();
  await expect(page.getByText("2099-01-15")).toBeVisible();
  await expect(page.getByText("Prep item completed: \"E2E prep item\"")).toBeVisible();
  await expect(page.getByText("E2E private note")).toHaveCount(0);
});

test("print job dialog: keyboard, validation, create and record attempts", async ({ page }) => {
  await page.goto("/workshop/prints");
  const open = page.getByRole("button", { name: "New print job" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "New print job" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();

  await open.click();
  await dialog.getByLabel("Title").fill("E2E dragon bust");
  await dialog.getByLabel("Requested quantity").fill("0");
  await dialog.getByRole("button", { name: "Create print job" }).click();
  await expect(dialog.getByText("Request at least 1")).toBeVisible();
  await expect(dialog.getByLabel("Requested quantity")).toHaveAttribute("aria-invalid", "true");
  await dialog.getByLabel("Requested quantity").fill("3");
  await dialog.getByRole("checkbox", { name: /Demo session 2/ }).check();
  await dialog.getByRole("button", { name: "Create print job" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E dragon bust" })).toBeVisible();

  await page.getByRole("radio", { name: /Failed/ }).check();
  await page.getByLabel("Pieces", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Record pieces" }).click();
  await expect(page.getByLabel("Progress", { exact: true }).getByText("1 failed")).toBeVisible();
  await expect(page.getByLabel("Attempt history").getByText("1 failed")).toBeVisible();
  await page.getByRole("radio", { name: "Succeeded" }).check();
  await page.getByLabel("Pieces", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Record pieces" }).click();
  await expect(page.getByText(/Only 3 pieces remain/)).toBeVisible();
  await expect(page.getByText("0 of 3 complete")).toBeVisible();
  await axe(page);
});

test("publishing: preview without change, explicit publish, rollback keeps live work", async ({ page }) => {
  await page.goto("/workshop/publishing");
  await page.getByRole("button", { name: "Insert example bundle (demo)" }).click();
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await expect(page.getByText("ready to publish")).toBeVisible();
  await page.goto(`/people/entry/${ID.d_faction}`);
  await expect(page.getByRole("heading", { level: 1, name: "Demo faction" })).toBeVisible();

  await page.goto("/workshop/publishing");
  await page.getByRole("button", { name: "Insert example bundle (demo)" }).click();
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await page.getByRole("button", { name: "Publish release" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm publish" }).click();
  await expect(page.getByText("Release published")).toBeVisible();
  await axe(page);
  await expect(page.getByLabel("Release history").getByText("Version 2", { exact: true })).toBeVisible();

  await page.goto(`/people/entry/${ID.d_faction}`);
  await expect(page.getByRole("heading", { level: 1, name: "Demo faction (renamed)" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(ID.d_faction));

  await page.goto("/workshop/publishing");
  await page.getByLabel("Release history").getByRole("listitem").filter({ hasText: "Version 1" }).getByRole("button", { name: "Roll back to this" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create rollback release" }).click();
  await expect(page.getByLabel("Release history").getByText("Version 3", { exact: true })).toBeVisible();

  await page.goto(`/people/entry/${ID.d_faction}`);
  await expect(page.getByRole("heading", { level: 1, name: "Demo faction" })).toBeVisible();
  await page.goto(`/stories/sessions/${ID.ss_1}`);
  await expect(page.getByRole("checkbox", { name: "E2E prep item" })).toBeChecked();
  await expect(page.getByLabel("Status")).toHaveValue("scheduled");
});

test("small screens: no horizontal scroll and a working menu", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  for (const url of ["/", `/stories/sessions/${ID.ss_1}`, "/workshop/prints", "/workshop/publishing", "/studio"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await page.getByText("Menu", { exact: true }).click();
  await page.getByRole("navigation", { name: "Primary (mobile)" }).getByRole("link", { name: "Studio", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The Studio" })).toBeVisible();
  await axe(page);
});

test("HTTP hygiene: no GET mutations, no caching, empty and unknown states", async ({ page, request }) => {
  const get = await request.get("/api/v1/publications/publish");
  expect(get.status()).toBe(405);
  const res = await request.get("/");
  expect(res.headers()["cache-control"]).toContain("no-store");
  const csrf = await request.post("/api/v1/gm-notes", { data: { subjectId: ID.ss_1, body: "x" }, headers: { origin: "https://evil.example" } });
  expect(csrf.status()).toBe(403);
  await page.goto("/world/entry/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "This record is not in the archive" })).toBeVisible();
  await page.goto("/search?q=zzzzqqq");
  await expect(page.getByText("No results for “zzzzqqq”.")).toBeVisible();
  await page.goto(`/studio/item/${ID.m_private}`);
  await expect(page.getByText("Private asset unavailable")).toBeVisible();
});
