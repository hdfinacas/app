/**
 * Falha se existir alguma violação de `react-hooks/rules-of-hooks`.
 *
 * Esta regra não é estilo: quando ela reclama, alguma tela quebra de verdade.
 * Um hook chamado depois de um `return` antecipado faz a quantidade de hooks
 * mudar entre dois renders, e o React derruba o componente inteiro com o erro
 * #310 — o usuário vê "Algo deu errado".
 *
 * Foi exatamente o que aconteceu com o `usePlan()` no Dashboard: a tela inicial
 * de todo mundo quebrava assim que os dados terminavam de carregar. O lint
 * completo já apontava, mas junto com mais de mil avisos de estilo (`any`,
 * blocos vazios), então ninguém rodava. Aqui só esta regra é verificada.
 */
import { ESLint } from "eslint";

const eslint = new ESLint();
const resultados = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);

const violacoes = resultados.flatMap((arquivo) =>
  (arquivo.messages || [])
    .filter((m) => m.ruleId === "react-hooks/rules-of-hooks")
    .map((m) => `${arquivo.filePath}:${m.line}:${m.column}\n    ${m.message}`),
);

if (violacoes.length) {
  console.error(`\n${violacoes.length} violação(ões) da regra de hooks — isto quebra tela:\n`);
  console.error(violacoes.join("\n\n"));
  console.error("");
  process.exit(1);
}

console.log("Regra de hooks do React: nenhuma violação.");
