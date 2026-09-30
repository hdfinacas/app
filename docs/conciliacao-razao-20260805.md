# Conciliação do razão — levantamento de 05/08/2026

Levantamento feito depois de fechar os caminhos de pagamento que gravavam fora
do razão. **Nada aqui foi alterado automaticamente** — os números abaixo
precisam do seu conhecimento do que aconteceu em cada caso.

## O que já foi corrigido hoje

| Correção | Quantidade | Valor |
|---|---|---|
| Contratos quitados que seguiam como "ativo" | 36 | R$ 63.773,20 de capital saiu de "na rua" |
| Pagamentos recebidos e nunca lançados no caixa | 2 | R$ 1.060,00 (+ R$ 190,00 de lucro) |

A lista dos 36 está em `contratos-quitados-corrigidos-20260805.txt`, com ID,
cliente, valor e data do último pagamento — dá para desfazer um a um.

Os dois lançamentos foram ELIZABETE RODRIGUES MORINIGO (R$ 650, 04/08) e
FERNANDA LOPES DA COSTA (R$ 410, 09/06), com a data do pagamento que já estava
na parcela, exatamente como o sistema faria se tivesse passado pelo caminho
certo.

## O que sobrou, e por que não mexi

Somando tudo, o razão está **R$ 339,00** abaixo do total de parcelas marcadas
como pagas. Esse número pequeno esconde diferenças maiores nos dois sentidos:

| Situação | Contratos | Valor |
|---|---|---|
| Caixa a MENOS do que as parcelas pagas | 24 | R$ 11.844,00 |
| Caixa a MAIS do que as parcelas pagas | 10 | R$ 7.595,00 |

Não dá para resolver isso sozinho no código. "Caixa a mais" pode ser pagamento
que entrou e a parcela não foi baixada; "caixa a menos" pode ser parcela baixada
sem o dinheiro ter entrado, ou dinheiro lançado por fora. Inventar lançamento
para fechar a conta faria os livros mentirem de um jeito mais difícil de
perceber do que hoje.

Para ver a lista dos casos:

```sql
WITH pago AS (
  SELECT contract_id, sum(coalesce(paid_amount, amount)) AS v
    FROM contract_installments WHERE status = 'paid' GROUP BY 1
), caixa AS (
  SELECT contract_id, sum(amount) AS v
    FROM transactions WHERE type = 'payment' AND contract_id IS NOT NULL GROUP BY 1
)
SELECT cl.name AS cliente, c.status,
       round(p.v::numeric, 2)                        AS parcelas_pagas,
       round(coalesce(k.v, 0)::numeric, 2)           AS no_caixa,
       round((p.v - coalesce(k.v, 0))::numeric, 2)   AS diferenca
  FROM pago p
  JOIN contracts c  ON c.id = p.contract_id
  JOIN clients  cl  ON cl.id = c.client_id
  LEFT JOIN caixa k ON k.contract_id = p.contract_id
 WHERE abs(p.v - coalesce(k.v, 0)) > 0.01
 ORDER BY diferenca DESC;
```

## Daqui para frente isso não acontece mais

Todos os caminhos de baixa passam por RPC que grava parcela, lucro, caixa e
conclusão do contrato numa transação só:

- telas do app → `pay_installment`
- portal do cobrador → `collector_register_payment`
- bot do WhatsApp → `system_register_payment`
- estorno → `reverse_installment_payment`

Não existe mais escrita crua de `status = 'paid'` no código — a única gravação
direta em `contract_installments` que sobrou altera valor e vencimento, nada de
status.

Vale rodar `verificar-razao.sql` de vez em quando: toda linha com quantidade
maior que zero merece olhada.
