import { expect, test } from "@playwright/test"

test.describe("Smoke test & Static asset verification", () => {
  test("root / cleanly redirects to /sign-in and renders auth form without 500 error", async ({
    page,
  }) => {
    const failedRequests: string[] = []
    page.on("requestfailed", (req) => {
      failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`)
    })

    const response = await page.goto("/")
    expect(response?.status()).toBe(200)

    // Should have redirected to /sign-in
    expect(page.url()).toContain("/sign-in")

    // Check title
    await expect(page).toHaveTitle(/Sign in/i)

    // Check auth inputs
    const emailInput = page.getByPlaceholder(/you@example\.com|email/i).first()
    await expect(emailInput).toBeVisible()

    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible()

    const submitBtn = page.getByRole("button", { name: /sign in/i })
    await expect(submitBtn).toBeVisible()

    // Verify no fonts failed to load
    const fontFailures = failedRequests.filter((r) => r.includes(".woff2") || r.includes("font"))
    expect(fontFailures).toHaveLength(0)
  })

  test("sign-up page renders cleanly without errors", async ({ page }) => {
    const response = await page.goto("/sign-up")
    expect(response?.status()).toBe(200)

    await expect(page).toHaveTitle(/Sign up/i)

    const emailInput = page.getByPlaceholder(/you@example\.com|email/i).first()
    await expect(emailInput).toBeVisible()

    const submitBtn = page.getByRole("button", { name: /create account|sign up/i })
    await expect(submitBtn).toBeVisible()
  })

  test("sign in with admin@gmail.com and 123456 succeeds", async ({ page }) => {
    await page.goto("/sign-in")
    await page.locator('input[type="email"], input[name="email"]').fill("admin@gmail.com")
    await page.locator('input[type="password"]').fill("123456")
    await page.getByRole("button", { name: /sign in/i }).click()

    await page.waitForURL("**/dashboard**", { timeout: 10000 })
    expect(page.url()).toContain("/dashboard")
  })
})
