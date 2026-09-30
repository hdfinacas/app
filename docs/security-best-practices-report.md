# Auditoria de segurança — 18/08/2026

## Resumo executivo

A revisão encontrou duas falhas corrigíveis no código: um guard de webhook que aceitava requisições quando o segredo não existia e renderização manual de HTML nas respostas do agente. Ambas foram corrigidas e cobertas por testes. `npm audit --omit=dev --audit-level=high` não encontrou vulnerabilidades nas dependências de produção.

A verificação estrutural do banco remoto continua pendente porque `supabase db lint --linked` retornou HTTP 403 para a conta vinculada. As migrations locais têm políticas RLS e endurecimentos recentes, mas isso não comprova o estado efetivamente aplicado no projeto remoto.

## Achados

### SEC-001 — Alto — webhook aceitava configuração ausente (corrigido)

- Evidência: `supabase/functions/_shared/guard.ts:37-45` e uso em `supabase/functions/whatsapp-webhook/index.ts:443`.
- Risco anterior: se `EVOLUTION_WEBHOOK_SECRET` estivesse ausente, qualquer origem poderia alcançar o processamento do webhook.
- Correção: o guard agora falha fechado e usa comparação em tempo constante quando existe segredo.
- Teste: `supabase/functions/_shared/guard_test.ts` cobre configuração ausente, segredo correto e segredo incorreto.
- Pendência operacional: confirmar o segredo no Supabase e publicar novamente `whatsapp-webhook`.

### SEC-002 — Médio — renderização dinâmica de HTML na conversa da IA (corrigido)

- Evidência anterior: `src/pages/AgenteIA.tsx` construía HTML a partir do conteúdo da mensagem.
- Correção: `src/components/agent/SafeMessageContent.tsx:20` usa elementos React e mantém tags recebidas como texto.
- Teste: `src/test/safeMessageContent.test.tsx` confirma que uma tag `img` maliciosa não cria elemento HTML e que a formatação permitida continua funcionando.

### SEC-003 — Médio — CSP ainda está apenas em observação

- Evidência: `public/_headers:7` usa `Content-Security-Policy-Report-Only`, `unsafe-inline` e `unsafe-eval`.
- Impacto: a política registra incompatibilidades, mas ainda não bloqueia scripts fora da política; as duas diretivas permissivas reduzem a proteção contra XSS.
- Recomendação: coletar violações em produção, remover `unsafe-eval`, migrar scripts/estilos para nonce ou hash e só então tornar a política obrigatória. A ativação direta sem telemetria pode quebrar SDKs de pagamento.

### SEC-004 — Médio — estado remoto de RLS não verificável com a credencial atual

- Evidência: `supabase db lint --linked` retornou `LegacyDbConfigLoginRoleStatusError` (HTTP 403).
- Impacto: não é possível assegurar por inspeção que todas as policies e migrations locais estejam presentes no banco remoto.
- Recomendação: conceder à conta de automação acesso de leitura da configuração do banco ou executar o lint com uma conta autorizada; depois comparar migrations locais/remotas e testar isolamento entre dois tenants.

### SEC-005 — Baixo — token do cobrador persistido em localStorage

- Evidência: `src/pages/CobradorExterno.tsx:154` recupera o token persistido.
- Impacto: qualquer XSS executado na mesma origem pode ler o token. A correção de SEC-002 reduz uma fonte concreta, mas não elimina a classe de risco.
- Recomendação: preferir sessão com cookie `HttpOnly`, `Secure` e `SameSite`, emitida por backend. Até essa migração, manter expiração curta, revogação e logout que remova a credencial.

### SEC-006 — Baixo — chave pública duplicada em migrations históricas

- Evidência: migrations como `supabase/migrations/20260403153906_501b4033-1c93-4908-9585-fab78c4a384b.sql:8` contêm o JWT da função `anon`.
- Impacto: a chave `anon` é pública por desenho e não equivale à service-role, porém a duplicação dificulta rotação e auditoria.
- Recomendação: jobs novos devem obter configuração por secret/vault; migrations históricas não devem ser reescritas após aplicadas.

### SEC-007 — Alto — upload do cobrador não validava carteira atribuída (corrigido)

- Evidência: `supabase/functions/portal-upload-comprovante/index.ts` usava service-role e verificava apenas se parcela e token pertenciam à mesma empresa.
- Risco anterior: um cobrador com token válido e conhecimento do UUID poderia anexar comprovante a uma parcela de outro cobrador da mesma empresa.
- Correção: o endpoint agora exige token ativo, cobrador ativo e registro correspondente em `collector_assignments`; a extensão também é derivada do MIME permitido, não do nome enviado.
- Pendência operacional: publicar `portal-upload-comprovante` quando a conta Supabase tiver permissão de deploy.

### SEC-008 — Médio — URL de retorno do checkout confiava no header Origin (corrigido)

- Evidência: `supabase/functions/mercadopago-create-preference/index.ts` interpolava diretamente `req.headers.get("origin")` nas URLs de retorno.
- Risco anterior: uma chamada feita com Origin arbitrário criava preferência de pagamento que redirecionava o comprador para domínio não confiável.
- Correção: `supabase/functions/_shared/trusted_origin.ts` aceita apenas origens configuradas e recua para `https://credmaisapp.com.br`.
- Teste: `supabase/functions/_shared/trusted_origin_test.ts` cobre origem permitida, phishing, protocolo executável e URL com credenciais enganosas.
- Pendência operacional: publicar `mercadopago-create-preference` quando a conta Supabase tiver permissão de deploy.

### SEC-009 — Médio — testes Deno não bloqueavam regressões no CI (corrigido)

- Evidência anterior: o CI verificava os tipos das Edge Functions, mas não executava os arquivos `*_test.ts`.
- Efeito observado: ao ativar a suíte completa, um fixture desatualizado no cálculo de multa e juros falhou; os testes de guardrail do bot também não eram uma barreira de publicação.
- Correção: `npm run check` e `.github/workflows/ci.yml` agora executam os 96 testes Deno. Os 12 cron jobs foram padronizados no guard compartilhado, com comportamento fechado e comparação em tempo constante.

## Próximas validações prioritárias

1. Publicar as funções corrigidas e testar webhook válido, inválido, upload fora da carteira e retorno do checkout.
2. Liberar inspeção somente leitura do banco remoto e executar lint/RLS entre tenants distintos.
3. Instrumentar relatórios de violação CSP antes de ativar bloqueio.
4. Migrar portais externos para sessão de backend em cookie HttpOnly.
