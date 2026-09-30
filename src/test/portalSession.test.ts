import { beforeEach, describe, expect, it } from "vitest";
import { clearPortalSession, hasPortalSession } from "@/lib/portalSession";

const KEY = "portal-cliente-session";

describe("sessão isolada do portal", () => {
  beforeEach(() => sessionStorage.clear());

  it("reconhece o token temporário salvo pelo PortalCliente", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ token: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(hasPortalSession()).toBe(true);
  });

  it("não trata CPF legado ou conteúdo malformado como sessão", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ cpf: "12345678901" }));
    expect(hasPortalSession()).toBe(false);
    sessionStorage.setItem(KEY, JSON.stringify({ token: "token-invalido" }));
    expect(hasPortalSession()).toBe(false);
    sessionStorage.setItem(KEY, "{");
    expect(hasPortalSession()).toBe(false);
  });

  it("remove a sessão do portal", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ token: "550e8400-e29b-41d4-a716-446655440000" }));
    clearPortalSession();
    expect(hasPortalSession()).toBe(false);
  });
});
