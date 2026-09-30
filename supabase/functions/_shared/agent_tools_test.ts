import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { AGENT_TOOLS, calculateAgentOverdueCharge, executeTool } from "./agent_tools.ts";

const today = "2026-07-25";

function mkSupabase(overrides: Record<string, any> = {}) {
  return {
    rpc: (name: string, _args: any) => {
      if (overrides.rpc && overrides.rpc[name]) return overrides.rpc[name];
      return { data: [], error: null };
    },
    from: (_tbl: string) => ({
      select: () => ({
        eq: () => ({
          neq: () => ({
            order: () => ({
              limit: () => overrides.installments || { data: [], error: null },
              lt: () => ({ limit: () => overrides.installments || { data: [], error: null } }),
            }),
          }),
          maybeSingle: () => overrides.single || { data: null, error: null },
        }),
      }),
    }),
  } as any;
}

Deno.test("catálogo de tools está válido", () => {
  assertEquals(AGENT_TOOLS.length, 5);
  for (const t of AGENT_TOOLS) {
    assertEquals(typeof t.name, "string");
    assertEquals(typeof t.description, "string");
    assertEquals(typeof (t.input_schema as any).type, "string");
  }
});

Deno.test("buscar_cliente_por_cpf rejeita CPF inválido", async () => {
  const r = await executeTool(
    "buscar_cliente_por_cpf",
    { cpf: "123" },
    { supabase: mkSupabase(), siteUrl: "https://x", today },
  );
  assertEquals(r.ok, false);
});

Deno.test("buscar_cliente_por_cpf retorna cliente confirmado", async () => {
  const sup = mkSupabase({
    rpc: {
      search_clients_by_document: {
        data: [{ id: "abc", name: "João", status: "active" }],
        error: null,
      },
    },
  });
  const r = await executeTool(
    "buscar_cliente_por_cpf",
    { cpf: "12345678901" },
    { supabase: sup, siteUrl: "https://x", today },
  );
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals((r.data as any).client_id, "abc");
    assertEquals((r.data as any).name, "João");
  }
});

Deno.test("listar_parcelas_em_aberto usa os mesmos juros compostos da cobrança", async () => {
  const sup = mkSupabase({
    installments: {
      data: [
        {
          id: "p1",
          installment_number: 1,
          amount: 1000,
          paid_amount: 0,
          late_fee: 10.05,
          due_date: "2026-07-15", // 10 dias de atraso
          status: "pending",
          contracts: {
            status: "active",
            daily_interest_percent: 0.1,
            max_interest_cap_percent: null,
          },
        },
      ],
      error: null,
    },
  });
  const r = await executeTool(
    "listar_parcelas_em_aberto",
    { client_id: "cli-1" },
    { supabase: sup, siteUrl: "https://x", today },
  );
  assertEquals(r.ok, true);
  if (r.ok) {
    const p = (r.data as any).parcelas[0];
    assertEquals(p.dias_atraso, 10);
    assertEquals(p.multa, 0);
    assertEquals(p.juros_diarios, 10.05);
    assertEquals(p.taxa_diaria_percentual, 0.1);
    assertEquals(p.total_com_encargos, 1010.05);
  }
});

Deno.test("listar_parcelas_em_aberto aplica fallback e teto de juros", async () => {
  const sup = mkSupabase({
    installments: {
      data: [{
        id: "p2", installment_number: 2, amount: 100, paid_amount: 20,
        due_date: "2026-05-26", status: "overdue", late_fee: 50,
        contracts: { status: "overdue", daily_interest_percent: 0, max_interest_cap_percent: 50 },
      }],
      error: null,
    },
  });
  const r = await executeTool(
    "listar_parcelas_em_aberto",
    { client_id: "cli-1" },
    { supabase: sup, siteUrl: "https://x", today },
  );
  assertEquals(r.ok, true);
  if (r.ok) {
    const p = (r.data as any).parcelas[0];
    assertEquals(p.saldo_devedor, 80);
    assertEquals(p.juros_diarios, 50);
    assertEquals(p.taxa_diaria_percentual, 0);
    assertEquals(p.total_com_encargos, 130);
  }
});

Deno.test("cálculo compartilhado mantém PIX e listagem com o mesmo total", () => {
  const charge = calculateAgentOverdueCharge({
    amount: 100, paidAmount: 20, lateFee: 2.01, dueDate: "2026-07-23", today,
    dailyPercent: 1, capPercent: null,
  });
  assertEquals(charge.saldo, 80);
  assertEquals(charge.interest, 2.01);
  assertEquals(charge.total, 82.01);
});

Deno.test("gerar_link_pix inclui os mesmos encargos da parcela", async () => {
  const sup = mkSupabase({
    single: {
      data: {
        id: "p3", installment_number: 3, amount: 100, paid_amount: 20, late_fee: 2.01,
        due_date: "2026-07-23", status: "overdue", user_id: "owner",
        contracts: { status: "active", daily_interest_percent: 1, max_interest_cap_percent: null },
      },
      error: null,
    },
  });
  const r = await executeTool(
    "gerar_link_pix", { installment_id: "p3" },
    { supabase: sup, siteUrl: "https://x", today },
  );
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals((r.data as any).saldo_base, 80);
    assertEquals((r.data as any).juros_atraso, 2.01);
    assertEquals((r.data as any).valor, 82.01);
  }
});

Deno.test("listar_parcelas_em_aberto ignora contrato removido ou encerrado", async () => {
  for (const contracts of [null, { status: "completed", daily_interest_percent: 1 }]) {
    const sup = mkSupabase({ installments: { data: [{
      id: "fantasma", installment_number: 1, amount: 1000, paid_amount: 0,
      due_date: "2026-07-01", status: "overdue", contracts,
    }], error: null } });
    const r = await executeTool("listar_parcelas_em_aberto", { client_id: "cli-1" }, { supabase: sup, siteUrl: "https://x", today });
    assertEquals(r.ok, true);
    if (r.ok) assertEquals((r.data as any).parcelas.length, 0);
  }
});

Deno.test("escalar_para_humano sempre retorna handoff", async () => {
  const r = await executeTool(
    "escalar_para_humano",
    { motivo: "pediu_desconto", resumo: "Cliente pediu 30% off" },
    { supabase: mkSupabase(), siteUrl: "https://x", today },
  );
  assertEquals(r.ok, true);
  if (r.ok) assertEquals((r.data as any).handoff, true);
});

Deno.test("tool desconhecida retorna erro", async () => {
  const r = await executeTool(
    "nao_existe",
    {},
    { supabase: mkSupabase(), siteUrl: "https://x", today },
  );
  assertEquals(r.ok, false);
  if (!r.ok) assertStringIncludes(r.error, "tool_desconhecida");
});
