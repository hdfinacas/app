BEGIN;

-- ============================================================================
-- Sessão do portal do cliente: 48 horas -> 7 dias.
--
-- Contexto: a validade original era de 30 DIAS, o que é longo demais para um
-- token que viaja numa URL pelo WhatsApp e abre o dossiê financeiro completo do
-- devedor — encaminhar a mensagem entrega o acesso junto.
--
-- Reduzi para 48 horas, e errei a mão para o outro lado: o bot de cobrança envia
-- link com `?t=<token>`, e é normal a pessoa só abrir a mensagem depois do fim
-- de semana. Com 48h esse link morre antes de ser usado, e o cliente recebe
-- "sessão inválida" sem ter feito nada errado.
--
-- 7 dias equilibra: cobre o atraso normal de leitura de uma mensagem e continua
-- muito abaixo do mês original. O login por CPF + data de nascimento segue
-- disponível e sem prazo, então ninguém fica sem acesso de qualquer forma.
-- ============================================================================

ALTER TABLE public.portal_sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Estende as sessões vivas que ficaram com a janela curta, para ninguém ser
-- deslogado por causa do ajuste anterior.
UPDATE public.portal_sessions
   SET expires_at = now() + interval '7 days'
 WHERE expires_at > now()
   AND expires_at < now() + interval '7 days';

COMMIT;
