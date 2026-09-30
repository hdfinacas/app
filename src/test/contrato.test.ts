import { describe, it, expect } from "vitest";
import {
  renderContractTemplate,
  variaveisDesconhecidas,
  DEFAULT_CONTRACT_TEMPLATE,
  CONTRACT_PLACEHOLDERS,
  type ContractPlaceholderData,
} from "@/utils/contractTemplate";
import { contratoDeExemplo } from "@/utils/contratoExemplo";

const base = (): ContractPlaceholderData => contratoDeExemplo({ nome: "Credora LTDA", cnpj: "11.111.111/0001-11" });

describe("modelo de contrato", () => {
  it("preenche todas as variáveis oferecidas ao assinante", () => {
    // Se a tela oferece uma variável, ela TEM que ser substituída. Uma variável
    // listada mas não implementada chegaria literal no contrato do cliente.
    const template = CONTRACT_PLACEHOLDERS.map((p) => `${p.key}: {{${p.key}}}`).join("\n");
    const saida = renderContractTemplate(template, base());
    expect(saida).not.toMatch(/\{\{/);
  });

  it("não deixa o modelo padrão sair com marcação visível", () => {
    const saida = renderContractTemplate(DEFAULT_CONTRACT_TEMPLATE, base());
    expect(saida).not.toMatch(/\{\{/);
  });

  it("cita o avalista quando existe", () => {
    const saida = renderContractTemplate(DEFAULT_CONTRACT_TEMPLATE, base());
    expect(saida).toContain("João Exemplo Avalista");
    expect(saida).toContain("AVALISTA");
  });

  it("some com a cláusula inteira quando não há avalista", () => {
    // Antes o contrato imprimia a cláusula com o nome em branco.
    const semAval = { ...base(), guarantorName: "", guarantorCpf: "", guarantorPhone: "", guaranteeType: null };
    const saida = renderContractTemplate(DEFAULT_CONTRACT_TEMPLATE, semAval);
    expect(saida).not.toContain("AVALISTA");
    expect(saida).not.toContain("Avalista)");
  });

  it("some com o desconto de antecipação quando é zero", () => {
    const semDesconto = { ...base(), earlyPaymentDiscountPercent: 0 };
    const saida = renderContractTemplate(DEFAULT_CONTRACT_TEMPLATE, semDesconto);
    expect(saida).not.toContain("PAGAMENTO ANTECIPADO");
  });

  it("traduz a forma de pagamento para o cliente ler", () => {
    const saida = renderContractTemplate("Pagamento: {{forma_pagamento}}", { ...base(), paymentMethod: "cash" });
    expect(saida).toBe("Pagamento: Dinheiro");
  });

  it("repete a linha de cada parcela", () => {
    const saida = renderContractTemplate(
      "{{#parcelas}}{{numero}}|{{valor}}|{{vencimento}}\n{{/parcelas}}",
      base(),
    );
    expect(saida.trim().split("\n")).toHaveLength(6);
    expect(saida).toContain("01|R$ 1.000,00");
  });

  it("aponta variável escrita errada em vez de deixar passar", () => {
    // Este é o caso que faria o cliente receber "{{nome_cliente}}" impresso.
    expect(variaveisDesconhecidas("Olá {{nome_cliente}}, tudo bem?")).toEqual(["nome_cliente"]);
    expect(variaveisDesconhecidas("Olá {{cliente_nome}}, tudo bem?")).toEqual([]);
  });

  it("não acusa as marcações de bloco como erro", () => {
    const texto = "{{#se_avalista}}{{avalista_nome}}{{/se_avalista}}{{#parcelas}}{{numero}}{{/parcelas}}";
    expect(variaveisDesconhecidas(texto)).toEqual([]);
  });

  it("deixa a variável desconhecida visível no texto final, e é por isso que avisamos", () => {
    const saida = renderContractTemplate("Olá {{nome_cliente}}", base());
    expect(saida).toBe("Olá {{nome_cliente}}");
  });
});
