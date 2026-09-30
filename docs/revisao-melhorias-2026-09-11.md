Revisão de melhorias — CredMais App — 11/09/2026

A revisão aprofundou sessão, acesso e a caixa de conversas do WhatsApp. Foram corrigidos problemas no frontend e adicionados testes de regressão. As mudanças desta rodada estão no projeto local; não houve novo deploy nem alteração do banco de produção.

| Prioridade | Problema confirmado | Correção local |
| --- | --- | --- |
| Alta | A resposta do perfil podia chegar depois do logout ou da troca de conta e restaurar dados/permissões da conta anterior. | Requisições são identificadas e descartadas quando a conta muda, o provider desmonta ou uma consulta mais recente começa. |
| Alta | No primeiro login, o estado de carregamento podia permanecer falso antes da leitura do perfil. | A confirmação de perfil agora mantém a barreira de carregamento ativa. |
| Alta | Em falhas online, o cache podia restaurar permissão administrativa antiga, inclusive após uma resposta negativa da RPC. | Online, a permissão vem da resposta atual do banco. Falha de perfil apresenta recuperação; o cache de perfil fica restrito ao modo offline. |
| Alta | Cache positivo de acesso podia liberar uma assinatura vencida sem nova consulta online. | O acesso é revalidado online e a decisão é vinculada à conta e às condições atuais. Offline, o cache não prolonga uma data conhecida de expiração. |
| Média | getSession, INITIAL_SESSION e eventos repetidos podiam disparar consultas repetidas ao perfil. | A sessão inicial é conciliada com os eventos; eventos da mesma conta não duplicam a carga inicial. |
| Média | Uma falha na consulta redundante de perfil impedia a leitura da assinatura, mesmo quando ativa. | As duas consultas são iniciadas em paralelo e seus resultados são tratados separadamente, com limite de espera. |
| Média | Um link de checkout indisponível prendia o usuário no carregamento da verificação de acesso. | A tela de assinatura e o link “Ver planos” aparecem antes da consulta opcional do checkout. |
| Média | O atalho de etiqueta podia usar o texto anterior do campo ou não salvar nada com o campo vazio. | O clique passa a etiqueta escolhida diretamente e atualiza a lista após confirmação do servidor. |

Implementação: [AuthContext](../src/contexts/AuthContext.tsx), [ProtectedRoute](../src/components/ProtectedRoute.tsx), [WhatsAppInbox](../src/pages/WhatsAppInbox.tsx) e [withTimeout](../src/lib/withTimeout.ts). O helper de timeout aceita as consultas do Supabase e libera temporizadores ao concluir.

Melhorias ainda pendentes, identificadas pela leitura do código:

1. **Alta — editar e excluir contratos em uma transação do banco.** Em `src/pages/ClienteDetalhe.tsx`, `handleSaveContract` atualiza o contrato antes de validar se a nova quantidade excluiria números de parcelas já pagas. Ao regenerar o cronograma, exclui as parcelas pendentes antes de inserir as substitutas. Se a validação ou a inserção falhar, as operações anteriores já podem estar gravadas. `handleDeleteContract` também executa exclusões em sequência. Recomenda-se uma RPC transacional com verificação de proprietário, bloqueio das linhas, preservação de pagamentos parciais e testes de rollback. A criação já tem um exemplo de operação atômica em `src/lib/contractPersistence.ts`. Este risco foi identificado no código; nenhuma alteração financeira foi executada para reproduzi-lo em produção.
2. **Média — fazer “Lembrar-me” controlar a persistência.** `src/integrations/supabase/remember.ts` apenas grava `sj_remember_me`. O cliente em `src/integrations/supabase/client.ts` usa sempre `localStorage` e `persistSession: true`. Desmarcar a opção atualmente não muda o local da sessão. Recomenda-se armazenamento adaptável entre sessão da aba e persistência, com migração segura e testes de reabertura/logout.
3. **Média — incluir login com falhas simuladas no CI.** Os novos testes de componentes entram em `npm run test`. O job E2E atual em `.github/workflows/ci.yml` executa apenas `dinheiro.spec.ts` e `responsive-accessibility.spec.ts` contra o site publicado. Recomenda-se executar também `login-recovery.spec.ts` contra a build local antes da publicação.

Validação desta rodada:

- Oito cenários de sessão/acesso falharam com o código anterior e passaram após a correção.
- 23 testes direcionados novos: sessão, acesso, timeout e interação com etiquetas.
- `npm run test`: 275 testes aprovados em 47 arquivos.
- `npm run typecheck`: aprovado.
- `npm run lint` e lint direcionado dos arquivos adicionados/alterados: aprovados.
- `node scripts/checar-hooks.mjs`: aprovado.
- `npm run build`: aprovado; aviso de base Browserslist desatualizada.
- `e2e/login-recovery.spec.ts`: dois testes aprovados contra `http://127.0.0.1:4183`, servindo a build de produção local. Cobrem login até o dashboard e falha de perfil seguida de nova tentativa. Todas as chamadas Supabase e WebSockets são interceptadas, com conta e respostas simuladas.

A validação no navegador não equivale a testar uma conta real em produção, todas as telas autenticadas ou operações financeiras no banco. As Edge Functions não foram alteradas nesta rodada.
