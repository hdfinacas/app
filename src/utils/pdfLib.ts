/**
 * Carrega o jsPDF sob demanda.
 *
 * Motivo: `jspdf` + `jspdf-autotable` somam ~436 KB. Importados de forma
 * estática, entravam no chunk do Portal do Cliente — ou seja, o devedor baixava
 * quase meio megabyte, no celular, só para ver as parcelas dele. Agora a
 * biblioteca só é buscada quando alguém realmente pede um PDF.
 *
 * O módulo fica em cache pelo próprio bundler: o segundo PDF não baixa de novo.
 */
let cache: Promise<{ jsPDF: any; autoTable: any }> | null = null;

export function loadPdfLib() {
  if (!cache) {
    cache = Promise.all([import("jspdf"), import("jspdf-autotable")]).then(
      ([pdf, table]) => ({
        jsPDF: pdf.default ?? (pdf as any).jsPDF,
        autoTable: table.default ?? (table as any).autoTable,
      }),
    );
  }
  return cache;
}
