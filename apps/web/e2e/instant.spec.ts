import { instant } from "@next/playwright"
import { expect, test, type Page } from "@playwright/test"

/**
 * Instant navigation (docs/advanced-patterns.md §1): inside `instant()` a client navigation shows
 * only the shell and the prefetched UI. Needs a production build with the testing API, because
 * automatic prefetching does not run in `next dev`:
 *   EXPOSE_TESTING_API=1 pnpm --filter web build
 *   pnpm --filter web start -- -p 3100      (then BASE_URL=http://localhost:3100)
 *   pnpm --filter web test:e2e:instant
 * Spark prefetches every destination with its data (private caches), so a click shows the full page
 * with no skeleton; nothing is expected to wait. If one of these starts to show a skeleton, a
 * navigation became blocking (a regression), not a test to relax.
 * Each test starts from a full page load of the source page, because hidden routes stay mounted
 * (`<Activity>`) and a route visited earlier would be trivially instant.
 */
test.use({ timezoneId: "Asia/Ho_Chi_Minh" })

const PASSWORD = "secret123"
const email = `instant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
const GOAL = "Run a 5k"
const HABIT = "Jog"
const TASK = "Buy shoes"
let goalUrl = ""
let habitUrl = ""

const main = (page: Page) => page.locator("main:visible")
const h1 = (page: Page, name: string) =>
  main(page).getByRole("heading", { name, level: 1 })
/** The sidebar nav link to `href` (the desktop sidebar container, not the closed mobile sheet). */
const link = (page: Page, href: string) =>
  page.locator(`[data-slot="sidebar-container"] a[href="${href}"]`)

const skeletons = (page: Page) => main(page).locator('[data-slot="skeleton"]')

/** Waits until the visible page has no skeleton left (hidden routes stay mounted in `<Activity>`). */
async function settled(page: Page) {
  await page.waitForFunction(() => {
    const mains = [...document.querySelectorAll("main")].filter((m) =>
      m.checkVisibility()
    )
    return (
      mains.length === 1 &&
      mains[0]!.querySelectorAll('[data-slot="skeleton"]').length === 0
    )
  })
}

/** Full load of the source page, signed in, with every skeleton gone and prefetches issued. */
async function startAt(page: Page, path: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/dashboard$/)
  await page.goto(path)
  await settled(page)
  // Let the viewport prefetches of the visible links finish before the scope pauses navigations.
  await page.waitForLoadState("networkidle")
}

/** Records what the instant UI showed, for the report: skeletons and the visible text. */
async function probe(page: Page) {
  const skeletonCount = await skeletons(page).count()
  const text = (await main(page).innerText()).replace(/\s+/g, " ").slice(0, 300)
  test.info().annotations.push({
    type: "inside-instant",
    description: `skeletons=${skeletonCount} text="${text}"`,
  })
}

// Runs again in a restarted worker (after a failed test), hence a fresh user each time it runs.
test.beforeAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    timezoneId: "Asia/Ho_Chi_Minh",
  })
  const page = await context.newPage()
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Instant")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await page.waitForURL(/\/dashboard$/)
  await settled(page)

  await page.goto("/dashboard/goals")
  await settled(page)
  await page.getByRole("textbox", { name: "New goal" }).fill(GOAL)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await page.waitForURL(/\/dashboard\/goals\/[0-9a-f-]{36}$/)
  goalUrl = new URL(page.url()).pathname
  await settled(page)

  await main(page).getByRole("button", { name: "New habit" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("textbox", { name: "Name" }).fill(HABIT)
  await dialog.getByRole("button", { name: "Create habit" }).click()
  await page.waitForURL(/\/dashboard\/habits\/[0-9a-f-]{36}$/)
  habitUrl = new URL(page.url()).pathname
  await settled(page)

  await page.goto("/dashboard/tasks")
  await settled(page)
  await page.getByRole("textbox", { name: "New task" }).fill(TASK)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await expect(main(page).getByText(TASK, { exact: true })).toBeVisible()
  await context.close()
})

// Canary: proves the instant lock is engaged. A document load inside the scope serves only the
// static shell, so the goal (session data) is absent until the scope ends. If the build has no
// testing API, instant() does not lock anything and this test fails instead of passing vacuously.
test("canary: a locked document load shows the shell without the goal list", async ({
  page,
  baseURL,
}) => {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/dashboard$/)
  const goalLink = main(page).getByRole("link", { name: GOAL })

  await instant(
    page,
    async () => {
      await page.goto("/dashboard/goals")
      await expect(h1(page, "Goals")).toBeVisible()
      await expect(goalLink).toHaveCount(0)
      await expect(skeletons(page).first()).toBeVisible()
    },
    { baseURL }
  )

  // Releasing the lock sometimes (about 1 in 10 runs) leaves the locked shell on screen without
  // streaming the rest in; one reload then proves the content is served once the lock is gone.
  await expect(goalLink)
    .toBeVisible({ timeout: 5_000 })
    .catch(() => page.reload())
  await expect(goalLink).toBeVisible()
})

test("Today -> Goals", async ({ page }) => {
  await startAt(page, "/dashboard")
  const newGoal = main(page).getByRole("textbox", { name: "New goal" })
  const goalLink = main(page).getByRole("link", { name: GOAL })

  await instant(page, async () => {
    await link(page, "/dashboard/goals").click()
    await page.waitForURL((url) => url.pathname === "/dashboard/goals")
    await probe(page)
    await expect(h1(page, "Goals")).toBeVisible()
    await expect(newGoal).toBeVisible()
    await expect(goalLink).toBeVisible()
    await expect(skeletons(page)).toHaveCount(0)
  })
})

test("Goals -> goal detail", async ({ page }) => {
  await startAt(page, "/dashboard/goals")
  const title = h1(page, GOAL)
  const habit = main(page).getByRole("link", { name: HABIT })
  const checkpoints = main(page).getByRole("heading", {
    name: "Checkpoints",
    level: 2,
  })

  await instant(page, async () => {
    await main(page).getByRole("link", { name: GOAL }).click()
    await page.waitForURL((url) => url.pathname === goalUrl)
    await probe(page)
    await expect(title).toBeVisible()
    await expect(habit).toBeVisible()
    await expect(checkpoints).toBeVisible()
    await expect(skeletons(page)).toHaveCount(0)
  })
})

test("Habits -> habit detail", async ({ page }) => {
  await startAt(page, "/dashboard/habits")
  const title = h1(page, HABIT)
  const weeks = main(page).getByRole("heading", {
    name: "Last 52 weeks",
    level: 2,
  })

  await instant(page, async () => {
    await main(page).getByRole("link", { name: HABIT }).first().click()
    await page.waitForURL((url) => url.pathname === habitUrl)
    await probe(page)
    await expect(title).toBeVisible()
    await expect(weeks).toBeVisible()
    await expect(skeletons(page)).toHaveCount(0)
  })
})

test("Today -> Tasks", async ({ page }) => {
  await startAt(page, "/dashboard")
  const newTask = main(page).getByRole("textbox", { name: "New task" })
  const task = main(page)
    .getByText(TASK, { exact: true })
    .filter({ visible: true })

  await instant(page, async () => {
    await link(page, "/dashboard/tasks").click()
    await page.waitForURL((url) => url.pathname === "/dashboard/tasks")
    await probe(page)
    await expect(h1(page, "Tasks")).toBeVisible()
    await expect(newTask).toBeVisible()
    await expect(task).toBeVisible()
    await expect(skeletons(page)).toHaveCount(0)
  })
})

test("sidebar -> Weekly review", async ({ page }) => {
  await startAt(page, "/dashboard")
  const next = main(page).getByRole("button", { name: "Next", exact: true })

  await instant(page, async () => {
    await link(page, "/dashboard/review").click()
    await page.waitForURL((url) => url.pathname === "/dashboard/review")
    await probe(page)
    await expect(h1(page, "Weekly review")).toBeVisible()
    await expect(main(page).getByText("0 of 1 scheduled days")).toBeVisible()
    await expect(next).toBeVisible()
    await expect(skeletons(page)).toHaveCount(0)
  })
})

test("sidebar -> Account", async ({ page }) => {
  await startAt(page, "/dashboard")
  const emailTerm = main(page).locator("dt", { hasText: "Email" })

  await instant(page, async () => {
    await link(page, "/dashboard/settings/account").click()
    await page.waitForURL(
      (url) => url.pathname === "/dashboard/settings/account"
    )
    await probe(page)
    await expect(h1(page, "Account")).toBeVisible()
    await expect(emailTerm).toBeVisible()
    await expect(main(page)).toContainText(email)
    await expect(skeletons(page)).toHaveCount(0)
  })
})
