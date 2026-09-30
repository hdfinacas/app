import { describe, it, expect } from "vitest";

/**
 * Cópia fiel da regra de retenção do `auto-backup` (a função roda em Deno e não
 * é importável daqui). Se a regra mudar lá, mude aqui junto — é ela que decide
 * qual arquivo de backup é APAGADO, então errar custa dado.
 */
const DIAS_COMPLETOS = 30;

function deveManter(nomeArquivo: string, hoje: Date): boolean {
  const data = nomeArquivo.replace(/\.json$/i, "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return true;

  const d = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return true;

  const diasAtras = Math.floor((hoje.getTime() - d.getTime()) / 86400000);
  if (diasAtras < 0) return true;
  if (diasAtras <= DIAS_COMPLETOS) return true;
  return data.endsWith("-01");
}

const HOJE = new Date("2026-08-04T12:00:00Z");
const nome = (d: string) => `${d}.json`;

describe("retenção de backup — o que é preservado", () => {
  it("mantém o backup de hoje", () => {
    expect(deveManter(nome("2026-08-04"), HOJE)).toBe(true);
  });

  it("mantém todos os últimos 30 dias", () => {
    expect(deveManter(nome("2026-08-03"), HOJE)).toBe(true);
    expect(deveManter(nome("2026-07-20"), HOJE)).toBe(true);
    expect(deveManter(nome("2026-07-05"), HOJE)).toBe(true); // 30 dias atrás
  });

  it("mantém o dia 1º de meses antigos (backup mensal)", () => {
    expect(deveManter(nome("2026-07-01"), HOJE)).toBe(true);
    expect(deveManter(nome("2026-06-01"), HOJE)).toBe(true);
    expect(deveManter(nome("2026-04-01"), HOJE)).toBe(true);
  });

  it("nunca apaga data futura (relógio errado não deve causar perda)", () => {
    expect(deveManter(nome("2026-09-15"), HOJE)).toBe(true);
  });

  it("nunca apaga arquivo com nome fora do padrão", () => {
    expect(deveManter("qualquer-coisa.json", HOJE)).toBe(true);
    expect(deveManter("2026-13-45.json", HOJE)).toBe(true);
    expect(deveManter("", HOJE)).toBe(true);
  });
});

describe("retenção de backup — o que é descartado", () => {
  it("descarta dia comum com mais de 30 dias", () => {
    expect(deveManter(nome("2026-07-04"), HOJE)).toBe(false); // 31 dias
    expect(deveManter(nome("2026-06-15"), HOJE)).toBe(false);
    expect(deveManter(nome("2026-04-24"), HOJE)).toBe(false); // o mais antigo hoje
  });

  it("na virada dos 30 dias, mantém o limite e descarta o dia seguinte", () => {
    expect(deveManter(nome("2026-07-05"), HOJE)).toBe(true);  // exatamente 30
    expect(deveManter(nome("2026-07-04"), HOJE)).toBe(false); // 31
  });
});

describe("retenção de backup — efeito no acervo real", () => {
  it("reduz drasticamente sem perder a linha do tempo", () => {
    // Reproduz o acervo de hoje: um arquivo por dia, de 24/04 a 04/08.
    const arquivos: string[] = [];
    for (let d = new Date("2026-04-24T00:00:00Z"); d <= HOJE; d.setUTCDate(d.getUTCDate() + 1)) {
      arquivos.push(nome(d.toISOString().slice(0, 10)));
    }

    const mantidos = arquivos.filter((a) => deveManter(a, HOJE));

    // ~31 dias recentes + os dias 1º de maio, junho e julho
    expect(arquivos.length).toBeGreaterThan(100);
    expect(mantidos.length).toBeLessThan(40);

    // A linha do tempo antiga continua representada mês a mês
    expect(mantidos).toContain(nome("2026-05-01"));
    expect(mantidos).toContain(nome("2026-06-01"));
    expect(mantidos).toContain(nome("2026-07-01"));
    // E o backup de hoje nunca some
    expect(mantidos).toContain(nome("2026-08-04"));
  });
});
