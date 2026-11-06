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

test("home tells the story of the world; the workshop shows the bench and unresolved lore", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "The Tide" })).toBeVisible();
  await expect(page.getByText("Echoes through the void.").first()).toBeAttached();
  // The seven chapters of the story, each a heading; the world is Ilyr, never the working name.
  for (const chapter of ["Arrival", "Before", "The Veil", "Verdancy", "The Tide", "The Peoples", "Enter"]) {
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(`${chapter}$`) })).toBeAttached();
  }
  await expect(page.locator("body")).not.toContainText("Primus");
  for (const name of ["World", "People", "Stories", "Studio", "Workshop"]) {
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name, exact: true })).toBeVisible();
  }
  await axe(page);

  await page.goto("/workshop");
  await expect(page.getByText("No session is scheduled.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unresolved lore" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How long was the Age of the Veil?" })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
  await axe(page);
});

test("the Arrival can be heard: on the home story and on its Library page", async ({ page }) => {
  await page.goto("/");
  const listen = page.getByRole("button", { name: "Listen to the arrival, read aloud" });
  await listen.scrollIntoViewIfNeeded();
  await listen.click();
  const bar = page.getByRole("region", { name: "Narration" });
  await expect(bar).toBeVisible();
  // The line being spoken takes the chapter text's place, large, its word flaring.
  await page.evaluate(() => {
    document.querySelector("audio")!.currentTime = 24;
  });
  await expect(page.locator(".spoken-wrap[data-on] .spoken-line")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".spoken-now")).toHaveCount(1, { timeout: 10_000 });
  // The spoken line follows along.
  await expect(bar.locator(".narration-line")).toContainText(/\w{3,}/, { timeout: 15_000 });
  // The bar stays while the story scrolls on.
  await page.mouse.wheel(0, 2400);
  await expect(bar).toBeVisible();
  await axe(page);
  await bar.getByRole("button", { name: "Stop and close the narration" }).click();
  await expect(bar).toHaveCount(0);

  await page.goto("/stories");
  await page.getByRole("link", { name: /Arrival/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Arrival" })).toBeVisible();
  await page.getByRole("button", { name: "Listen to the arrival, read aloud" }).click();
  await expect(page.getByRole("region", { name: "Narration" })).toBeVisible();
  // The page reads along: words wrapped, and one lit as it is spoken.
  const text = page.locator("#story-text");
  await expect(text).toHaveAttribute("data-reading", "");
  await expect(text.locator(".rw").first()).toBeAttached();
  await page.evaluate(() => {
    const a = document.querySelector("audio")!;
    a.currentTime = 95;
  });
  await expect(text.locator(".rw-now")).toHaveCount(1, { timeout: 10_000 });
});

test("the C.E.O. desk: the Archive's agents and the Tide's own work orders", async ({ page, request }) => {
  await page.goto("/workshop");
  await page.getByText("More tools", {exact:true}).click();
  await page.getByRole("link", { name: /C\.E\.O\. desk/ }).first().click();
  await expect(page.getByRole("heading", { name: "In the Archive" })).toBeVisible();
  await expect(page.getByText("Loremaster", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^Settle: / }).first()).toBeVisible();
  await axe(page);
  const res = await request.get("/api/v1/workshop/work-orders");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.room).toBe("archive");
  expect(body.orders.length).toBeGreaterThan(0);
  expect(new Set(body.orders.map((o: { id: string }) => o.id)).size).toBe(body.orders.length);
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
  await expect(page.getByRole("heading", { name: /\d+ results?/ })).toBeVisible();
  await page.getByRole("link", { name: "Teruānga", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Teruānga" })).toBeVisible();
  // The folio, in the documents' own template, with its rail.
  await expect(page.getByRole("heading", { level: 2, name: "Anatomy" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Contents" }).first()).toBeAttached();
  await expect(page.getByRole("button", { name: /edit in space/i })).toHaveCount(0);
  await axe(page);
});

test("the Codex gathers nine peoples and searches their source text", async ({ page }) => {
  await page.goto("/people");
  await expect(page.getByRole("heading", {level:1,name:"The Codex"})).toBeVisible();
  await expect(page.getByText(/^9 entries/)).toBeVisible();
  await page.getByLabel("Search this collection").fill("Humans");
  await page.getByRole("button", {name:"Search",exact:true}).click();
  await page.getByRole("link", {name:/Humans/}).first().click();
  await expect(page.getByRole("heading", {level:1,name:"Humans"})).toBeVisible();
  await page.goto("/world");
  await expect(page).toHaveURL(/codex\?view=all/);
});

test("session live state, checklist and GM notes work and appear on the bench", async ({ page }) => {
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

  await page.goto("/workshop");
  await expect(page.getByRole("link", { name: "Demo session 1" }).first()).toBeVisible();
  await expect(page.getByText("2099-01-15")).toBeVisible();
  await page.getByText("Print activity and recent changes", {exact:true}).click();
  await expect(page.getByText("Prep item completed: \"E2E prep item\"")).toBeVisible();
  await expect(page.getByText("E2E private note")).toHaveCount(0);
});

test("each section is its own instrument, accessible, with the world named Ilyr", async ({ page }) => {
  const rooms: [string, string][] = [
    ["/world", "The Codex"],
    ["/people", "The Codex"],
    ["/stories", "The Library"],
    ["/studio", "The Studio"],
  ];
  for (const [url, title] of rooms) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Primus");
    // Let everything arrive (reveals fade up as they enter the view) before checking contrast.
    for (let y = 0; y < 8000; y += 700) await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(1600);
    await axe(page);
  }
  await page.goto("/codex?view=peoples");
  await expect(page.getByRole("link", {name:/Humans/}).first()).toBeVisible();
  await page.goto("/workshop/planning");
  await expect(page.getByRole("heading", {level:1})).toBeVisible();

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
  // Version 1 is the seed, 2 the lore from the GM's documents.
  await expect(page.getByLabel("Release history").getByText("Version 3", { exact: true })).toBeVisible();

  await page.goto(`/people/entry/${ID.d_faction}`);
  await expect(page.getByRole("heading", { level: 1, name: "Demo faction (renamed)" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(ID.d_faction));

  await page.goto("/workshop/publishing");
  await page.getByLabel("Release history").getByRole("listitem").filter({ hasText: "Version 1" }).getByRole("button", { name: "Roll back to this" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create rollback release" }).click();
  await expect(page.getByLabel("Release history").getByText("Version 4", { exact: true })).toBeVisible();

  await page.goto(`/people/entry/${ID.d_faction}`);
  await expect(page.getByRole("heading", { level: 1, name: "Demo faction" })).toBeVisible();
  await page.goto(`/stories/sessions/${ID.ss_1}`);
  await expect(page.getByRole("checkbox", { name: "E2E prep item" })).toBeChecked();
  await expect(page.getByLabel("Status")).toHaveValue("scheduled");
});

test("small screens: no horizontal scroll and a working menu", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  for (const url of ["/", "/world", "/people", "/stories", "/studio", "/workshop", `/people/entry/${ID.p_teruanga}`, `/stories/sessions/${ID.ss_1}`, "/workshop/prints", "/workshop/publishing"]) {
    await page.goto(url);
    if (url === "/world" || url === "/people") await page.waitForURL(/\/codex/);
    await page.waitForLoadState("networkidle");
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


test("private drafts retain revisions and development notes", async ({page}) => {
  await page.goto('/workshop/drafts/new');
  await page.getByLabel('Title', {exact:true}).fill('E2E proposed starting region');
  await page.getByLabel('Working text').fill('A private possibility for our opening.');
  await page.getByRole('button',{name:'Save private draft'}).click();
  await expect(page).toHaveURL(/workshop\/drafts\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByLabel('Working text')).toHaveValue('A private possibility for our opening.');
  await page.getByLabel('Working text').fill('A second private possibility.');
  await page.getByRole('button',{name:'Save private draft'}).click();
  await expect(page.getByLabel('Working text')).toHaveValue('A second private possibility.');
  await expect(page.getByText(/Revision 2/)).toBeVisible();
  await page.getByLabel('Add a development note').fill('We still need the local conflict.');
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await expect(page.getByText('We still need the local conflict.',{exact:true})).toBeVisible();
  await axe(page);
});
