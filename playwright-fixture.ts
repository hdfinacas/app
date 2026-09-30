// Fixture base dos testes E2E.
// Antes reexportava de `lovable-agent-playwright-config/fixture`, pacote que não
// está instalado — o que impedia a suíte inteira de rodar. Passa a usar o
// Playwright direto; estenda aqui se algum dia precisar de fixture própria.
export { test, expect } from "@playwright/test";
