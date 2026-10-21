import { expect, test, type Page } from "@playwright/test"

/**
 * Stack parity (docs/providers.md §5): the same flows must pass on `AUTH_PROVIDER=better-auth` and
 * `AUTH_PROVIDER=supabase`. Each run signs up fresh users, so it needs no seed data.
 * Run against a dev server: `pnpm --filter web exec playwright test e2e/parity.spec.ts`.
 */
test.describe.configure({ mode: "serial" })
test.use({ timezoneId: "Asia/Ho_Chi_Minh" })

const PASSWORD = "secret123"
const stamp = Date.now()
const userA = `parity-a-${stamp}@example.test`
const userB = `parity-b-${stamp}@example.test`
let goalUrl = ""

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

const main = (page: Page) => page.locator("main:visible")

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Parity")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await page.waitForURL(/\/dashboard$/)
  await settled(page)
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("textbox", { name: "Password" }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

const treats = async (page: Page) =>
  Number((await page.locator("body").innerText()).match(/(\d+) treats?/i)?.[1])

test("sign up lands on Today; wrong password keeps the email; sign in again", async ({
  page,
}) => {
  await signUp(page, userA)
  await expect(
    main(page).getByRole("heading", { name: "Today", level: 1 })
  ).toBeVisible()

  await page.context().clearCookies()
  await signIn(page, userA, "wrong-password")
  await expect(page.getByRole("alert").first()).toContainText(/invalid/i)
  await expect(page.getByLabel("Email")).toHaveValue(userA)

  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/dashboard$/)
})

test("goal, habit from the goal page, full / minimum / undo survive a reload", async ({
  page,
}) => {
  await signIn(page, userA)
  await page.waitForURL(/\/dashboard$/)

  await page.goto("/dashboard/goals")
  await settled(page)
  await page.getByRole("textbox", { name: "New goal" }).fill("Run a 5k")
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await page.waitForURL(/\/dashboard\/goals\/[0-9a-f-]{36}$/)
  goalUrl = new URL(page.url()).pathname
  await settled(page)

  await main(page).getByRole("button", { name: "New habit" }).click()
  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("combobox", { name: /which goal/i })
  ).toHaveValue(/.+/)
  await dialog.getByRole("textbox", { name: "Name" }).fill("Jog")
  await dialog
    .getByRole("textbox", { name: "Minimum version" })
    .fill("Shoes on")
  for (const day of ["Sun", "Sat"]) {
    const button = dialog.getByRole("button", { name: day, exact: true })
    if ((await button.getAttribute("aria-pressed")) !== "true")
      await button.click()
  }
  await dialog.getByRole("button", { name: "Create habit" }).click()
  await expect(dialog).toBeHidden()

  await page.goto("/dashboard")
  await settled(page)
  const box = main(page).getByRole("checkbox", { name: "Check in: Jog" })
  const minimum = main(page).getByRole("button", {
    name: "Minimum",
    exact: true,
  })

  await box.click()
  await expect(box).toHaveAttribute("aria-checked", "true")
  await expect.poll(() => treats(page)).toBe(1)
  await page.reload()
  await settled(page)
  await expect(box).toHaveAttribute("aria-checked", "true")

  await box.click()
  await expect(box).toHaveAttribute("aria-checked", "false")
  await expect.poll(() => treats(page)).toBe(0)

  await minimum.click()
  await expect(minimum).toHaveAttribute("aria-pressed", "true")
  await page.reload()
  await settled(page)
  await expect(minimum).toHaveAttribute("aria-pressed", "true")
  await expect(box).toHaveAttribute("aria-checked", "mixed")
})

test("#slug task, done, logged to its goal; pet +1", async ({ page }) => {
  await signIn(page, userA)
  await page.waitForURL(/\/dashboard$/)
  await settled(page)
  const before = await treats(page)

  await page
    .getByRole("textbox", { name: "New task" })
    .fill("Buy shoes #run-a-5k")
  await page.getByRole("button", { name: "Add", exact: true }).click()
  const done = main(page).getByRole("checkbox", { name: "Done: Buy shoes" })
  await expect(done).toBeVisible()
  await expect(main(page).getByText("Run a 5k").last()).toBeVisible()

  await done.click()
  await main(page).getByRole("button", { name: "Yes, log it" }).click()
  await expect.poll(() => treats(page)).toBe(before + 1)

  await page.goto(goalUrl)
  await settled(page)
  await expect(main(page)).toContainText("Buy shoes")
})

test("weekly review pauses a habit from next week and queues focus tasks", async ({
  page,
}) => {
  await signIn(page, userA)
  await page.waitForURL(/\/dashboard$/)
  await page.goto("/dashboard/tasks?tab=later")
  await settled(page)
  for (const title of ["Plan route", "Stretch"]) {
    await page.getByRole("textbox", { name: "New task" }).fill(title)
    await page.getByRole("button", { name: "Add", exact: true }).click()
    await expect(main(page).getByText(title)).toBeVisible()
  }

  await page.goto("/dashboard/review")
  await settled(page)
  await main(page).getByRole("button", { name: "Next" }).click()
  await main(page).getByRole("button", { name: "Pause: Jog" }).click()
  await main(page).getByRole("button", { name: "Next" }).click()
  await main(page).getByRole("checkbox", { name: "Focus: Plan route" }).click()
  await main(page).getByRole("checkbox", { name: "Focus: Stretch" }).click()
  await main(page).getByRole("button", { name: "Finish review" }).click()
  await expect(main(page)).toContainText("Review saved.")
  await expect(main(page)).toContainText(
    "2 focus tasks for next week, 1 habit paused from next week."
  )
})

test("preferences: browser timezone list, week start and pet name persist", async ({
  page,
}) => {
  await signIn(page, userA)
  await page.waitForURL(/\/dashboard$/)
  await page.goto("/dashboard/settings/preferences")
  await settled(page)
  const timezone = page.getByRole("combobox", { name: "Timezone" })
  const weekStart = page.getByRole("combobox", { name: "Week starts on" })

  await timezone.click()
  await page
    .getByRole("option", { name: /^Europe\/Ki(e|y)v/ })
    .first()
    .click()
  await weekStart.click()
  await page.getByRole("option", { name: "Monday" }).click()
  await page.getByLabel("Pet name").fill("Tama")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Settings saved.")).toBeVisible()

  await page.reload()
  await settled(page)
  await expect(timezone).toContainText(/Europe\/Ki(e|y)v/)
  await expect(weekStart).toContainText("Monday")
  await expect(page.getByLabel("Pet name")).toHaveValue("Tama")
})

test("changing the timezone moves Today at once (token claims refreshed)", async ({
  page,
}) => {
  await signIn(page, userA)
  await page.waitForURL(/\/dashboard$/)
  // UTC+14 and UTC-11: always on different calendar days.
  for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
    await page.goto("/dashboard/settings/preferences")
    await settled(page)
    await page.getByRole("combobox", { name: "Timezone" }).click()
    await page.getByRole("option", { name: new RegExp(`^${zone}`) }).click()
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Settings saved.")).toBeVisible()

    await page.goto("/dashboard")
    await settled(page)
    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date())
    await expect(main(page)).toContainText(label)
  }
})

test("another user cannot see the first user's data", async ({ page }) => {
  await signUp(page, userB)
  await expect(main(page)).not.toContainText("Run a 5k")
  await page.goto(goalUrl)
  // RLS (Supabase) or the API's ownership check (FastAPI) hides it: the dashboard's not-found page.
  await expect(main(page).getByText("Nothing here")).toBeVisible()
  await page.goto("/dashboard/tasks?tab=later")
  await settled(page)
  await expect(main(page)).not.toContainText("Plan route")
})

test("signing out ends the session", async ({ page }) => {
  await signIn(page, userB)
  await page.waitForURL(/\/dashboard$/)
  await page.goto("/dashboard/settings/account")
  await settled(page)
  await page
    .getByRole("button", { name: /parity/i })
    .last()
    .click()
  await page.getByRole("menuitem", { name: /sign out/i }).click()
  await page.waitForURL(/\/sign-in/)
  await page.goto("/dashboard")
  await page.waitForURL(/\/sign-in/)
})
