import { describe, expect, it } from "vitest";
import { formatPhoneBR, getPreferredPhone, resolveClientPhones } from "@/lib/phone";

describe("formatPhoneBR", () => {
  it("formata celular nacional", () => {
    expect(formatPhoneBR("11987654321")).toBe("(11) 98765-4321");
  });

  it("remove o código 55 antes de formatar", () => {
    expect(formatPhoneBR("+55 11 98765-4321")).toBe("(11) 98765-4321");
  });

  it("formata telefone fixo", () => {
    expect(formatPhoneBR("1132654321")).toBe("(11) 3265-4321");
  });

  it("preserva valores incompletos sem inventar dígitos", () => {
    expect(formatPhoneBR("12345")).toBe("12345");
  });
});

describe("contato telefônico do cliente", () => {
  it("usa WhatsApp quando o campo telefone está vazio", () => {
    expect(getPreferredPhone({ phone: null, whatsapp: "(11) 99999-0000" }))
      .toBe("(11) 99999-0000");
  });

  it("usa telefone quando não há WhatsApp", () => {
    expect(getPreferredPhone({ phone: "(11) 3333-0000", whatsapp: null }))
      .toBe("(11) 3333-0000");
  });

  it("replica o único número informado nos dois campos", () => {
    expect(resolveClientPhones("", "(11) 99999-0000")).toEqual({
      phone: "(11) 99999-0000",
      whatsapp: "(11) 99999-0000",
    });
    expect(resolveClientPhones("(11) 3333-0000", "")).toEqual({
      phone: "(11) 3333-0000",
      whatsapp: "(11) 3333-0000",
    });
  });

  it("preserva números diferentes quando ambos são informados", () => {
    expect(resolveClientPhones("(11) 3333-0000", "(11) 99999-0000")).toEqual({
      phone: "(11) 3333-0000",
      whatsapp: "(11) 99999-0000",
    });
  });
});
