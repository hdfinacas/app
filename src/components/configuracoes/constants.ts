/** Paletas prontas oferecidas na aba Marca. */
export const COLOR_PRESETS = [
  { label: "Azul Steel", primary: "#4a86c8", accent: "#6ba3d6", emoji: "🔷" },
  { label: "Azul Royal", primary: "#2563eb", accent: "#3b82f6", emoji: "💎" },
  { label: "Esmeralda", primary: "#059669", accent: "#10b981", emoji: "💚" },
  { label: "Roxo", primary: "#7c3aed", accent: "#8b5cf6", emoji: "💜" },
  { label: "Âmbar", primary: "#d97706", accent: "#f59e0b", emoji: "🟡" },
  { label: "Vermelho", primary: "#dc2626", accent: "#ef4444", emoji: "❤️" },
];

/**
 * Mensagens de cobrança prontas, oferecidas na aba Mensagem Padrão.
 *
 * Os textos anteriores afirmavam que o nome seria "incluído nos órgãos de
 * proteção ao crédito" e que "medidas adicionais" seriam tomadas. Anunciar
 * consequência que não vai acontecer é cobrança por ameaça — o Código de Defesa
 * do Consumidor trata disso no art. 42 (nada de constranger ou ameaçar) e no
 * art. 71, que é matéria criminal.
 *
 * Os textos abaixo são firmes e informam consequência REAL: os juros de atraso,
 * que estão no contrato e o próprio sistema calcula. Se você de fato negativa,
 * pode voltar a citar — mas aí escreva no momento em que for verdade.
 */
export const BILLING_PRESETS = [
  {
    label: "Formal",
    text: "{empresa}: Sr(a) {nome}, identificamos um atraso de {dias} dia(s) em sua parcela. O valor atualizado é de {valor}, já com os juros previstos em contrato. Por favor, entre em contato para regularizar.",
  },
  {
    label: "Amigável",
    text: "Olá {nome}! 😊 Aqui é da {empresa}. Notamos que sua parcela de {valor} ainda não foi paga. Se ficou apertado esse mês, me chama que a gente vê uma condição juntos.",
  },
  {
    label: "Direto",
    text: "{nome}, sua parcela está em atraso há {dias} dia(s) e o valor atualizado é {valor} — os juros de atraso correm por dia, então quanto antes resolver, menos você paga. Pode pagar hoje pelo PIX: {pix}",
  },
];

/** Templates de mensagem prontos, oferecidos na aba Templates. */
export const TEMPLATE_PRESETS: { name: string; content: string; trigger_days: number | null }[] = [
  { name: "Lembrete Amigável", content: "Olá {nome}, tudo bem? 😊 Passando para lembrar que sua parcela de {valor} vence hoje. Qualquer dúvida, estamos à disposição!", trigger_days: 0 },
  { name: "Cobrança 1 Dia", content: "Olá {nome}, notamos que sua parcela de {valor} venceu ontem. Por favor, realize o pagamento o quanto antes para evitar juros adicionais. Obrigado!", trigger_days: 1 },
  { name: "Cobrança 3 Dias", content: "Prezado(a) {nome}, sua parcela está com {dias} dias de atraso e o valor atualizado é {valor}. Entre em contato para acertarmos.", trigger_days: 3 },
  { name: "Cobrança 7 Dias", content: "{nome}, já são {dias} dias de atraso e o valor atualizado chegou a {valor}. Os juros correm por dia — me chama hoje para a gente resolver.", trigger_days: 7 },
  { name: "Cobrança 15 Dias", content: "{nome}, sua parcela está há {dias} dias em aberto, hoje em {valor}. Quero entender o que aconteceu e encontrar uma saída antes que o valor cresça mais. Pode me responder?", trigger_days: 15 },
  { name: "Cobrança 30 Dias", content: "{nome}, são {dias} dias de atraso e o valor atualizado é {valor}. Preciso da sua resposta para definirmos como seguir — me chama hoje, mesmo que seja para propor um pagamento parcial.", trigger_days: 30 },
  { name: "Confirmação de Pagamento", content: "✅ {nome}, confirmamos o recebimento do pagamento de {valor}. Obrigado pela pontualidade! Qualquer dúvida, estamos à disposição.", trigger_days: null },
  { name: "Acordo / Negociação", content: "Olá {nome}, gostaríamos de oferecer uma condição especial para regularizar sua parcela de {valor} em atraso há {dias} dias. Entre em contato para negociarmos. 🤝", trigger_days: null },
];
