import { test, expect } from "@playwright/test";

test.describe("Public routes", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
  });

  test("plans page is public", async ({ page }) => {
    const res = await page.goto("/planos");
    expect(res?.status()).toBeLessThan(400);
  });

  test("reset-password page is public", async ({ page }) => {
    const res = await page.goto("/reset-password");
    expect(res?.status()).toBeLessThan(400);
  });

  test("client portal is public", async ({ page }) => {
    const res = await page.goto("/portal-cliente");
    expect(res?.status()).toBeLessThan(400);
  });

  test("landing opens the full login app without a dead route", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /entrar na plataforma/i }).click();
    await page.waitForURL(/\/login$/);
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar no sistema/i })).toBeVisible();
  });

  test("mission page directs users to the admin-provisioned login", async ({ page }) => {
    await page.goto("/missao");
    const accessLinks = page.getByRole("link", { name: /acessar a plataforma/i });
    await expect(accessLinks).toHaveCount(2);
    await expect(accessLinks.nth(0)).toHaveAttribute("href", "/login");
    await expect(accessLinks.nth(1)).toHaveAttribute("href", "/login");
  });

  test("login and password recovery display the brand only in the logo", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("img", { name: /DH Financeira/i })).toHaveCount(1);
    await expect(page.getByText("DH FINANCEIRA", { exact: true })).toHaveCount(0);

    await page.goto("/reset-password");
    await expect(page.getByRole("img", { name: /DH Financeira/i })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /DH Financeira/i })).toHaveCount(0);
  });

  test("public portal aliases and investor portal do not require app login", async ({ page }) => {
    for (const route of ["/portal", "/portal/token-invalido", "/investidor/token-invalido"]) {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);
      expect(page.url()).not.toContain("/login");
    }
  });

  test("checkout result pages render without claiming an unverified payment", async ({ page }) => {
    for (const route of ["/checkout/sucesso", "/checkout/pendente", "/checkout/erro"]) {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("body")).not.toContainText("Pagamento aprovado");
    }
  });
});
