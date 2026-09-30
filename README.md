# CredMais App

SaaS multi-tenant para gestão de crédito, contratos, parcelas, cobranças,
investidores e comunicação com clientes.

## Tecnologias

- React 18, TypeScript e Vite
- Tailwind CSS, shadcn/ui e Radix UI
- Supabase Auth, PostgreSQL, RLS, Realtime, Storage e Edge Functions
- TanStack Query com persistência em IndexedDB
- Vitest e Playwright

## Desenvolvimento local

Requisitos: Node.js 20+ e npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Preencha no `.env` a URL e a chave pública (`anon`) do projeto Supabase. Nunca
coloque a chave `service_role` em variáveis `VITE_*`, pois elas são incorporadas
ao JavaScript entregue ao navegador.

O servidor local abre em `http://localhost:8080`.

## Verificação

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Para executar as verificações bloqueantes do CI em sequência:

```sh
npm run check
```

O lint opera com tolerância zero a avisos. O typecheck e o verificador dedicado
de hooks também são executados no CI.

Os testes E2E usam por padrão `https://www.credmaisapp.com.br`. Para testar a
instância local:

```sh
E2E_BASE_URL=http://localhost:8080 npm run test:e2e
```

No PowerShell:

```powershell
$env:E2E_BASE_URL="http://localhost:8080"; npm run test:e2e
```

## Estrutura

- `src/pages`: páginas e fluxos de navegação
- `src/components`: componentes compartilhados e módulos de interface
- `src/lib`: regras de negócio, cálculos e utilitários
- `src/integrations/supabase`: cliente e tipos gerados do banco
- `supabase/migrations`: evolução do schema, políticas RLS e RPCs
- `supabase/functions`: webhooks, automações e integrações de servidor
- `e2e`: testes de rotas, autenticação e garantias financeiras
- `docs`: procedimentos operacionais e reconciliação financeira

## Segurança e multi-tenancy

Os dados operacionais são isolados por `user_id` e políticas RLS. Funções com
`verify_jwt = false` devem validar internamente assinatura de webhook, token de
portal ou segredo de cron. Toda nova função pública deve receber também limite
de requisições e proteção contra repetição do mesmo evento.

## Caminho financeiro

Alterações em contratos, parcelas, pagamentos, estornos, multas ou distribuição
de investidores exigem testes de regressão. Consulte os scripts e relatórios em
`docs/` antes de corrigir saldos diretamente no banco.

## Deploy

O frontend é preparado para deploy na Vercel. O CI executa typecheck, validações
das Edge Functions, testes unitários, build, testes de segurança contra produção
e verificação de segredos versionados.
