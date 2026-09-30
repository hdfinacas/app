// ============================================================================
// O que é "em aberto" e o que é "em atraso" — definição única do sistema.
//
// POR QUE EXISTE: o código tratava atraso como `status === "pending"`. Só que o
// `auto-late-fees` roda às 03:00 e marca toda parcela vencida como "overdue" —
// a partir daí ela sumia de qualquer filtro escrito assim. O erro apareceu em 22
// pontos do front e em 5 edge functions, sempre subestimando a inadimplência.
//
// Efeitos reais medidos em 2026-08-05:
//   • painel mostrava 9 parcelas em atraso onde havia 276;
//   • a cobrança automática ignorava 265 parcelas (R$ 74.459);
//   • o score de crédito considerava "em dia" 52 clientes que estavam devendo.
//
// Regra: atraso NÃO se define por um status específico, e sim por
// "não foi paga nem cancelada E o vencimento já passou".
//
// Módulo puro (sem imports) de propósito: roda igual no Deno das edge functions
// e no navegador, para as duas pontas não voltarem a divergir.
// ============================================================================

export interface ParcelaStatus {
  status?: string | null;
  due_date?: string | null;
}

/** Encerrada: paga ou cancelada. Não entra em nenhuma conta de pendência. */
export function isEncerrada(i: ParcelaStatus): boolean {
  return i?.status === "paid" || i?.status === "cancelled";
}

/**
 * Em aberto: qualquer coisa que não foi paga nem cancelada.
 * Status desconhecido conta como em aberto de propósito — sumir em silêncio foi
 * exatamente o que aconteceu com "overdue".
 */
export function isEmAberto(i: ParcelaStatus): boolean {
  return !isEncerrada(i);
}

/** Só a data, sem hora: o horário do vencimento não pode mudar o resultado. */
function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function diaDoVencimento(iso: string): number {
  return inicioDoDia(new Date(iso));
}

/** Em atraso: em aberto E vencida antes de hoje. */
export function isEmAtraso(i: ParcelaStatus, agora: Date = new Date()): boolean {
  if (!isEmAberto(i) || !i?.due_date) return false;
  return diaDoVencimento(i.due_date) < inicioDoDia(agora);
}

/** Vence hoje: em aberto E com vencimento no dia de hoje. */
export function venceHoje(i: ParcelaStatus, agora: Date = new Date()): boolean {
  if (!isEmAberto(i) || !i?.due_date) return false;
  return diaDoVencimento(i.due_date) === inicioDoDia(agora);
}

/** Dias inteiros de atraso. Zero quando ainda não venceu. */
export function diasEmAtraso(i: ParcelaStatus, agora: Date = new Date()): number {
  if (!isEmAtraso(i, agora)) return 0;
  return Math.floor((inicioDoDia(agora) - diaDoVencimento(i.due_date!)) / 86400000);
}
