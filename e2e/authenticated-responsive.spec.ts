import { expect, test } from "@playwright/test";

const auditEmail = process.env.E2E_AUDIT_EMAIL;

const normalUserRoutes = [
  "/dashboard", "/hoje", "/analises", "/clientes", "/clientes/novo",
  "/clientes/buscar", "/cobrancas", "/carteira", "/investidores", "/lucros",
  "/gastos", "/ferramentas", "/ferramentas/metas", "/ferramentas/simulador",
  "/ferramentas/tarefas", "/ferramentas/anotacoes", "/ferramentas/planilha",
  "/puxada-dados", "/sobre", "/perfil", "/relatorios", "/historico-financeiro",
  "/configuracoes", "/cobradores", "/qrcode", "/comunicacao",
  "/comunicacao/inbox", "/suporte", "/notificacoes", "/chat", "/tv",
];

const viewports = [
  { name: "mobile", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 900 },
];

test.describe("auditoria autenticada do usuário comum", () => {
  test.skip(!auditEmail, "Defina E2E_AUDIT_EMAIL para executar com uma conta técnica isolada.");

  test.beforeEach(async ({ page }) => {
    const local = auditEmail!.split("@")[0].replace(/\W/g, "").slice(-12);
    const password = `CredAudit!${local}9`;
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).fill(auditEmail!);
    await page.getByLabel(/senha/i).first().fill(password);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 15_000 });
    await expect(page.getByText(/não foi possível verificar seu acesso/i)).toHaveCount(0);
    await expect(page.getByText(/assine para continuar/i)).toHaveCount(0);
  });

  for (const viewport of viewports) {
    test(`${viewport.name}: todas as rotas internas normais permanecem utilizáveis`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      for (const route of normalUserRoutes) {
        const response = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(response?.status(), `${route} devolveu HTTP inválido`).toBeLessThan(400);
        await expect(page.locator("#root"), `${route} não renderizou`).not.toBeEmpty();
        await expect(page, `${route} saiu da área autenticada`).not.toHaveURL(/\/login(?:\?|$)/);
        await expect(page.getByText(/algo deu errado|erro inesperado/i), `${route} mostrou falha fatal`).toHaveCount(0);

        const overflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth,
        }));
        expect(Math.max(overflow.document, overflow.body), `${route} criou rolagem horizontal`).toBeLessThanOrEqual(1);
      }

      expect(pageErrors, "Erros JavaScript durante a matriz autenticada").toEqual([]);
    });
  }

  test("RBAC: usuário comum não acessa ferramentas administrativas", async ({ page }) => {
    for (const route of ["/admin", "/admin/bot-audit", "/auditoria", "/historico"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
    }
  });
});
