// ============================================================================
// Renderizador único das mensagens de cobrança.
//
// POR QUE EXISTE: havia três caminhos de mensagem, cada um substituindo um
// conjunto diferente de variáveis, em duas sintaxes diferentes:
//
//   • auto-collection (bot)  → só entendia {chaves}
//   • Cobranças (manual)     → entendia as duas, mas fixava "CredMais App"
//                              como nome da empresa, ignorando o white-label
//   • Cobrador externo       → só trocava [Nome do Cliente]
//
// Enquanto isso, a tela de Templates instruía o operador a usar [Nome], [Valor],
// [Dias] e [Portal] — colchetes que o bot NÃO substituía. Ou seja: qualquer um
// dos 8 templates prontos, se usado pelo bot, chegaria ao cliente com o texto
// "[Nome]" e "[Valor]" literais. Também não havia substituição nenhuma na
// mensagem de encerramento do bot.
//
// Este módulo é puro (sem imports) de propósito: roda igual no Deno das edge
// functions e no navegador, para as duas pontas nunca mais divergirem.
// ============================================================================

export interface TemplateVars {
  /** Nome do cliente. */
  nome?: string;
  /** Nome da empresa do credor (white-label). */
  empresa?: string;
  /** Valor a pagar, já formatado. Ex.: "R$ 1.234,56". */
  valor?: string;
  /** Identificação da parcela. Ex.: "3/10". */
  parcela?: string;
  /** Quantidade de parcelas envolvidas. */
  parcelas?: string;
  /** Dias de atraso (ou até vencer, quando for lembrete). */
  dias?: string;
  /** Data de vencimento, formatada. */
  data?: string;
  /** Link do portal do cliente. */
  portal?: string;
  /** Chave PIX do credor. */
  pix?: string;
  /** Número da parcela. */
  numero?: string;
  /** Juros de atraso acumulados, formatados. */
  juros?: string;
}

/** Nome canônico de cada variável, a partir de tudo que já foi prometido nas telas. */
const ALIASES: Record<string, keyof TemplateVars> = {
  nome: "nome",
  "nome do cliente": "nome",
  cliente: "nome",

  empresa: "empresa",
  "nome da empresa": "empresa",

  valor: "valor",
  "valor da parcela": "valor",
  total: "valor",
  "total atualizado": "valor",

  parcela: "parcela",
  parcelas: "parcelas",

  dias: "dias",
  "dias de atraso": "dias",

  data: "data",
  vencimento: "data",
  "data de vencimento": "data",

  portal: "portal",
  link: "portal",
  "link do portal": "portal",

  pix: "pix",
  "chave pix": "pix",

  numero: "numero",

  juros: "juros",
  multa: "juros",
  "juros de atraso": "juros",
};

/** minúsculas, sem acento, espaços colapsados — para casar "Número" com "numero". */
function normalizar(chave: string): string {
  return chave
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Pega {chave} e [Chave], em qualquer caixa e com ou sem acento. */
const PADRAO = /\{([^{}]{1,40})\}|\[([^[\]]{1,40})\]/g;

export interface RenderResult {
  texto: string;
  /**
   * Variáveis escritas no template que não existem. Ficam intactas no texto (é
   * melhor o operador ver "[Foo]" e corrigir do que a frase sair mutilada), e a
   * tela usa esta lista para avisar na hora da edição.
   */
  desconhecidas: string[];
}

/** Substitui as variáveis e informa o que não foi reconhecido. */
export function renderTemplate(template: string, vars: TemplateVars): RenderResult {
  const desconhecidas: string[] = [];
  if (!template) return { texto: "", desconhecidas };

  const texto = template.replace(PADRAO, (original, comChaves, comColchetes) => {
    const bruta = comChaves ?? comColchetes ?? "";
    const canonica = ALIASES[normalizar(bruta)];

    if (!canonica) {
      if (!desconhecidas.includes(bruta)) desconhecidas.push(bruta);
      return original;
    }

    const valor = vars[canonica];
    // Variável conhecida mas sem valor no contexto vira string vazia: o cliente
    // não pode receber "{valor}" cru numa cobrança.
    return valor == null ? "" : String(valor);
  });

  return { texto, desconhecidas };
}

/** Só o texto, para quem não se importa com o diagnóstico. */
export function renderMessage(template: string, vars: TemplateVars): string {
  return renderTemplate(template, vars).texto;
}

/** Lista para exibir na tela, com exemplo. Fonte única do que é suportado. */
export const VARIAVEIS_SUPORTADAS: { chave: keyof TemplateVars; descricao: string }[] = [
  { chave: "nome", descricao: "Nome do cliente" },
  { chave: "empresa", descricao: "Nome da sua empresa" },
  { chave: "valor", descricao: "Valor a pagar, já com juros" },
  { chave: "parcela", descricao: "Parcela, no formato 3/10" },
  { chave: "numero", descricao: "Número da parcela" },
  { chave: "parcelas", descricao: "Quantidade de parcelas em aberto" },
  { chave: "dias", descricao: "Dias de atraso (ou dias até vencer)" },
  { chave: "data", descricao: "Data de vencimento" },
  { chave: "juros", descricao: "Juros de atraso acumulados" },
  { chave: "portal", descricao: "Link do portal do cliente" },
  { chave: "pix", descricao: "Sua chave PIX" },
];
