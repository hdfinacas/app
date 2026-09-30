/** Remove informações exclusivas da operação antes de exibir ou enviar ao cliente. */
export const sanitizeClientContractText = (text: string) =>
  String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/\b(lucro(?:\s+(?:previsto|estimado|esperado|interno))?|margem\s+interna)\b/i.test(line))
    .map((line) => line.replace(/\s*\[cash_disbursed:[^\]]+\]/gi, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
