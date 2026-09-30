import { describe, it, expect } from "vitest";
import { renderTemplate, renderMessage, VARIAVEIS_SUPORTADAS } from "@/lib/messageTemplate";
import { TEMPLATE_PRESETS, BILLING_PRESETS } from "@/components/configuracoes/constants";

// Contexto: a tela de Templates mandava usar [Nome], [Valor], [Dias] e [Portal],
// mas o bot só substituía {chaves}. Qualquer um dos 8 templates prontos, se
// disparado pelo bot, chegaria ao cliente com "[Nome]" e "[Valor]" literais.
// Estes testes existem para as duas sintaxes nunca mais divergirem.

const vars = {
  nome: "Maria Silva",
  empresa: "Crédito Bom",
  valor: "R$ 1.234,56",
  parcela: "3/10",
  numero: "3",
  parcelas: "2",
  dias: "5",
  data: "10/08/2026",
  juros: "R$ 45,00",
  portal: "https://app.exemplo/portal?t=abc",
  pix: "chave@pix",
};

describe("as duas sintaxes funcionam", () => {
  it("substitui chaves", () => {
    expect(renderMessage("Olá {nome}, você deve {valor}", vars))
      .toBe("Olá Maria Silva, você deve R$ 1.234,56");
  });

  it("substitui colchetes — o formato que a tela de Templates ensina", () => {
    expect(renderMessage("Olá [Nome], você deve [Valor]", vars))
      .toBe("Olá Maria Silva, você deve R$ 1.234,56");
  });

  it("aceita as duas na mesma mensagem", () => {
    expect(renderMessage("{nome} tem [Dias] dias de atraso", vars))
      .toBe("Maria Silva tem 5 dias de atraso");
  });

  it("ignora caixa alta e baixa", () => {
    expect(renderMessage("[NOME] / {VALOR} / [nome]", vars))
      .toBe("Maria Silva / R$ 1.234,56 / Maria Silva");
  });

  it("aceita acento e espaço nos nomes longos", () => {
    expect(renderMessage("[Nome do Cliente] deve [Valor da Parcela]", vars))
      .toBe("Maria Silva deve R$ 1.234,56");
    expect(renderMessage("Parcela [Número]", vars)).toBe("Parcela 3");
  });
});

describe("os 8 templates prontos da tela renderizam de verdade", () => {
  // Se algum destes voltar a sair com colchete literal, o cliente recebe lixo.
  const prontos = [
    "Olá [Nome], tudo bem? 😊 Passando para lembrar que sua parcela de R$ [Valor] vence hoje.",
    "Olá [Nome], notamos que sua parcela de R$ [Valor] venceu ontem.",
    "Prezado(a) [Nome], sua parcela de R$ [Valor] está com [Dias] dias de atraso.",
    "⚠️ [Nome], sua parcela de R$ [Valor] está com [Dias] dias de atraso.",
    "🚨 [Nome], informamos que sua dívida de R$ [Valor] com [Dias] dias de atraso será encaminhada.",
    "[Nome], sua dívida de R$ [Valor] está com [Dias] dias de atraso.",
    "✅ [Nome], confirmamos o recebimento do pagamento de R$ [Valor].",
    "Olá [Nome], condição especial para sua parcela de R$ [Valor] em atraso há [Dias] dias. 🤝",
  ];

  it.each(prontos)("renderiza sem sobrar variável: %s", (tpl) => {
    const { texto, desconhecidas } = renderTemplate(tpl, vars);
    expect(desconhecidas).toEqual([]);
    expect(texto).not.toMatch(/\[[A-Za-zÀ-ú ]+\]/);
    expect(texto).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(texto).toContain("Maria Silva");
  });
});

describe("a mensagem padrão de cobrança também renderiza", () => {
  const presets = [
    "[Nome da Empresa]: Sr(a) [Nome do Cliente], identificamos um atraso. O valor pendente é de R$ [Valor da Parcela].",
    "Olá [Nome do Cliente]! 😊 Aqui é da [Nome da Empresa]. Sua parcela de R$ [Valor da Parcela] ainda não foi paga.",
    "⚠️ [Nome da Empresa] informa: [Nome do Cliente], sua parcela de R$ [Valor da Parcela] está em atraso.",
  ];

  it.each(presets)("sem variável sobrando: %s", (tpl) => {
    const { texto, desconhecidas } = renderTemplate(tpl, vars);
    expect(desconhecidas).toEqual([]);
    expect(texto).toContain("Maria Silva");
    expect(texto).toContain("Crédito Bom");
    // O nome da empresa vem do cadastro, não fixo em "CredMais App"
    expect(texto).not.toContain("CredMais App");
  });
});

describe("segurança do que chega ao cliente", () => {
  it("variável conhecida sem valor vira vazio, nunca o marcador cru", () => {
    const { texto } = renderTemplate("Pague {valor} via {pix}", { valor: "R$ 10" });
    expect(texto).toBe("Pague R$ 10 via ");
    expect(texto).not.toContain("{pix}");
  });

  it("variável inventada fica visível e é reportada, para o operador corrigir", () => {
    const { texto, desconhecidas } = renderTemplate("Oi [Fulano], veja {xpto}", vars);
    expect(desconhecidas).toEqual(["Fulano", "xpto"]);
    // Mantida no texto de propósito: some seria pior, a frase sairia mutilada
    expect(texto).toContain("[Fulano]");
  });

  it("não reporta a mesma variável duas vezes", () => {
    const { desconhecidas } = renderTemplate("[Foo] e [Foo] e [Foo]", vars);
    expect(desconhecidas).toEqual(["Foo"]);
  });

  it("texto sem variável passa intacto", () => {
    const t = "Bom dia! Passando para lembrar do pagamento.";
    expect(renderMessage(t, vars)).toBe(t);
  });

  it("template vazio não quebra", () => {
    expect(renderMessage("", vars)).toBe("");
    expect(renderMessage(null as any, vars)).toBe("");
  });

  it("colchete de texto normal não é confundido com variável", () => {
    const { texto, desconhecidas } = renderTemplate("Chave PIX: {pix} [ver no app]", vars);
    expect(desconhecidas).toEqual(["ver no app"]);
    expect(texto).toContain("chave@pix");
  });
});

describe("os textos prontos das telas de fato renderizam", () => {
  // Guarda contra o que aconteceu: a tela oferecia 8 templates prontos escritos
  // numa sintaxe que o bot não substituía. Se alguém editar constants.ts e usar
  // uma variável inexistente, este teste falha antes de chegar no cliente.
  it("nenhum template pronto tem variável desconhecida", () => {
    for (const p of TEMPLATE_PRESETS) {
      const { texto, desconhecidas } = renderTemplate(p.content, vars);
      expect(desconhecidas, `template "${p.name}" usa variável inexistente`).toEqual([]);
      expect(texto, `template "${p.name}" deixou marcador no texto`).not.toMatch(/\{[a-zA-Z]+\}|\[[A-Za-zÀ-ú ]+\]/);
    }
  });

  it("nenhuma mensagem pronta de cobrança tem variável desconhecida", () => {
    for (const p of BILLING_PRESETS) {
      const { texto, desconhecidas } = renderTemplate(p.text, vars);
      expect(desconhecidas, `mensagem "${p.label}" usa variável inexistente`).toEqual([]);
      expect(texto, `mensagem "${p.label}" não identifica o cliente`).toContain("Maria Silva");
      expect(texto, `mensagem "${p.label}" deixou marcador no texto`)
        .not.toMatch(/\{[a-zA-Z]+\}|\[[A-Za-zÀ-ú ]+\]/);
    }
  });
});

describe("os textos prontos não ameaçam o cliente", () => {
  // Quatro dos oito templates afirmavam que o nome seria "incluído nos órgãos de
  // proteção ao crédito" ou que "medidas adicionais" seriam tomadas. Anunciar
  // consequência que não vai acontecer é cobrança por ameaça (CDC art. 42 e 71).
  // Se um dia a negativação for real, o texto pode voltar — conscientemente, não
  // por vir junto num pacote de mensagens prontas.
  const AMEACAS = [
    /negativa[çc]/i,
    /prote[çc][ãa]o ao cr[ée]dito/i,
    /restri[çc][õo]es no seu cpf/i,
    /medidas adicionais/i,
    /maiores consequ[êe]ncias/i,
    /serasa|spc/i,
  ];

  it.each([...TEMPLATE_PRESETS.map((t) => [t.name, t.content]), ...BILLING_PRESETS.map((b) => [b.label, b.text])])(
    "%s não anuncia consequência que o sistema não executa",
    (_nome, texto) => {
      for (const padrao of AMEACAS) {
        expect(String(texto), `padrão ${padrao} encontrado`).not.toMatch(padrao);
      }
    },
  );
});

describe("catálogo mostrado na tela", () => {
  it("toda variável do catálogo é de fato substituível", () => {
    for (const v of VARIAVEIS_SUPORTADAS) {
      const { desconhecidas } = renderTemplate(`{${v.chave}}`, vars);
      expect(desconhecidas, `catálogo promete {${v.chave}} mas o renderizador não conhece`).toEqual([]);
    }
  });
});
