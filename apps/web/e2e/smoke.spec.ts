import { expect, test } from "@playwright/test"

test.describe("End-to-End Smoke & Full Dashboard Route Verification", () => {
  test("root / cleanly redirects to /sign-in and renders auth form without errors", async ({
    page,
  }) => {
    const failedRequests: string[] = []
    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    page.on("requestfailed", (req) => {
      failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`)
    })
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
    })
    page.on("pageerror", (err) => {
      pageErrors.push(err.message)
    })

    const response = await page.goto("/")
    expect(response?.status()).toBe(200)
    expect(page.url()).toContain("/sign-in")
    await expect(page).toHaveTitle(/Sign in/i)

    const emailInput = page.getByPlaceholder(/you@example\.com|email/i).first()
    await expect(emailInput).toBeVisible()

    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible()

    const submitBtn = page.getByRole("button", { name: /sign in/i })
    await expect(submitBtn).toBeVisible()

    const fontFailures = failedRequests.filter((r) => r.includes(".woff2") || r.includes("font"))
    expect(fontFailures).toEqual([])
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test("sign-up page renders cleanly without console or page errors", async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
    })
    page.on("pageerror", (err) => {
      pageErrors.push(err.message)
    })

    const response = await page.goto("/sign-up")
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Sign up/i)

    const emailInput = page.getByPlaceholder(/you@example\.com|email/i).first()
    await expect(emailInput).toBeVisible()

    const submitBtn = page.getByRole("button", { name: /create account|sign up/i })
    await expect(submitBtn).toBeVisible()

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test("sign in with admin@gmail.com and navigate across all dashboard routes with zero console/prerender errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(`[${page.url()}] ${msg.text()}`)
      }
    })
    page.on("pageerror", (err) => {
      pageErrors.push(`[${page.url()}] ${err.message}`)
    })

    await page.goto("/sign-in")
    await page.locator('input[type="email"], input[name="email"]').fill("admin@gmail.com")
    await page.locator('input[type="password"]').fill("123456")
    await page.getByRole("button", { name: /sign in/i }).click()

    await page.waitForURL("**/dashboard**", { timeout: 15000 })
    expect(page.url()).toContain("/dashboard")
    await expect(page.getByRole("heading", { name: /today/i }).first()).toBeVisible({
      timeout: 10000,
    })

    // Test client-side navigation via sidebar links (exercises Partial Prefetching + RSC streaming)
    const sidebarLinks = [
      { linkText: /^goals$/i, path: "/dashboard/goals", heading: /goals/i },
      { linkText: /^habits$/i, path: "/dashboard/habits", heading: /habits/i },
      { linkText: /^tasks$/i, path: "/dashboard/tasks", heading: /tasks/i },
      { linkText: /weekly review/i, path: "/dashboard/review", heading: /review/i },
      { linkText: /^guide$/i, path: "/dashboard/guide", heading: /how spark works/i },
      { linkText: /^account$/i, path: "/dashboard/settings/account", heading: /account/i },
      { linkText: /^members$/i, path: "/dashboard/settings/members", heading: /members/i },
      { linkText: /^today$/i, path: "/dashboard", heading: /today/i },
    ]

    for (const item of sidebarLinks) {
      await page.getByRole("link", { name: item.linkText }).first().click()
      await page.waitForURL(`**${item.path}**`, { timeout: 10000 })
      await expect(page.getByRole("heading", { name: item.heading }).first()).toBeVisible({
        timeout: 10000,
      })
      await expect(page.locator("text=Something went wrong")).toHaveCount(0)
    }

    // Test creating a Goal and loading dynamic route /dashboard/goals/[goalId]
    await page.getByRole("link", { name: /^goals$/i }).first().click()
    await page.waitForURL("**/dashboard/goals", { timeout: 10000 })
    const goalInput = page.getByLabel("New goal")
    await expect(goalInput).toBeVisible()
    await goalInput.fill("Read 12 books")
    await page.getByRole("button", { name: /^add$/i }).click()
    await page.waitForURL(/\/dashboard\/goals\/[0-9a-f-]+/i, { timeout: 10000 })
    await expect(page.getByRole("heading", { name: "Read 12 books" })).toBeVisible({
      timeout: 10000,
    })

    // Test adding a checkpoint on Goal detail page
    const cpInput = page.getByLabel("New checkpoint")
    await expect(cpInput).toBeVisible()
    await cpInput.fill("Finish book 1")
    await page.getByRole("button", { name: /^add$/i }).click()
    await expect(page.getByLabel("Done: Finish book 1")).toBeVisible({ timeout: 10000 })

    // Test creating a Habit from Goal detail page and loading dynamic route /dashboard/habits/[habitId]
    await page.getByRole("button", { name: /new habit/i }).click()
    await page.getByLabel("Name").fill("Read 10 pages")
    await page.getByRole("button", { name: /create habit/i }).click()
    await page.waitForURL(/\/dashboard\/habits\/[0-9a-f-]+/i, { timeout: 10000 })
    await expect(page.getByRole("heading", { name: "Read 10 pages" })).toBeVisible({
      timeout: 10000,
    })

    // Test adding a Task on /dashboard/tasks
    await page.getByRole("link", { name: /^tasks$/i }).first().click()
    await page.waitForURL("**/dashboard/tasks**", { timeout: 10000 })
    const taskInput = page.getByLabel("New task")
    await expect(taskInput).toBeVisible()
    await taskInput.fill("Buy bookmark")
    await page.getByRole("button", { name: /^add$/i }).click()
    await expect(page.getByText("Buy bookmark", { exact: true }).first()).toBeVisible({
      timeout: 10000,
    })

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
