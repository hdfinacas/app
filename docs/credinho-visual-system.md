# CredMais e Credinho — identidade visual

Atualização local de 11/09/2026. Todas as ilustrações em uso foram geradas individualmente com image_gen integrada. A imagem fornecida pelo usuário não é utilizada como asset nem como sprite. As novas cenas mantêm o personagem, com poses e temas próprios.

## Aplicações e arquivos

- `public/mascots/credinho-v2/`: 27 composições para hero desktop/mobile, login, páginas institucionais, cards, 12 banners do app/checkout, chat e carregamento.
- `public/brand/credmais-social-v2.png`: imagem exclusiva de compartilhamento, 1731 × 909, ligada às tags Open Graph e Twitter.
- `public/brand/credmais-logo.svg`: logo horizontal para fundos escuros; versão clara em `credmais-logo-light.svg` e PNG transparente em `credmais-logo.png`.
- `public/brand/credmais-symbol.svg`: símbolo C+ vetorial. O símbolo padrão do app está em `src/assets/credmais-mark.svg`.
- `public/favicon.svg`, `favicon.ico`, `favicon.png`, `favicon-16.png`, `favicon-32.png`: ícones para navegadores.
- `public/pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png`: ícones de instalação Android/iOS; versão maskable mantém o símbolo centralizado dentro da área segura.
- `scripts/export-credmais-brand.mjs`: exporta os vetores para PNG e empacota o ICO, de forma reproduzível via Chromium. Não altera ilustrações geradas.
- `docs/credinho-generation-prompts.json` e `docs/credmais-social-prompt.json`: prompts completos utilizados na ferramenta integrada.
- `src/components/brand/Credinho.tsx` e `src/credinho.css`: componentes, imagens contextuais, dimensões responsivas e animações com redução de movimento.

## Composição

As heroes usam imagens cobrindo a seção inteira e CTAs em HTML. A inicial tem uma composição vertical própria para celular. Login usa fundo completo exclusivo, com formulário sobre superfície escura. Cada página institucional tem sua própria cena. Banners de clientes, cobranças, hoje, administração, investidores, metas, análises, carteira, relatórios e IA usam arquivos distintos; dashboard e checkout também possuem cenas exclusivas.

No celular os banners colocam a cena na parte superior e o texto abaixo, preservando rosto e leitura. Cards mantêm a proporção natural. As mensagens do assistente usam seu avatar de headset; avatares de contatos e usuários continuam próprios. Carregamento usa a ilustração da ampulheta. As imagens fora da primeira área visível carregam sob demanda.

Logo e ícones são vetoriais, com símbolo C+ branco/dourado sobre preto. O wordmark tem versão para fundo claro. Marcas personalizadas continuam configuráveis e seus favicons substituem todas as variantes padrão do navegador.

## Verificação

- TypeScript, ESLint e build de produção.
- 25 testes unitários focados em autenticação, proteção de rotas, erros, central do bot e etiquetas do inbox.
- 9 E2E de navegação pública e recuperação de login contra servidor local.
- Inspeção em 390 e 1440 px: home, quatro páginas institucionais, login, checkout, portal, dashboard e clientes. APIs do app simuladas, sem transações reais.
- Galeria das novas cenas em `output/playwright/credinho-scenes-gallery.png`; capturas das páginas em `output/playwright/credinho-*.png`.

Publicado em 11/09/2026 no projeto Cloudflare Pages existente: https://dhfinanceira.sbs. Deployment de produção `868d53c6-3218-4aaa-9a43-0fb75a5617d0`. Configuração local ajustada de Workers para Pages; CSP permite o backend atual. Canonical e imagem social apontam para o endereço público ativo. Os arquivos antigos não referenciados foram preservados; não participam da identidade atual.
