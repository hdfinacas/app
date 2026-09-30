-- The historical migrations start with tables that depend on these core
-- entities. This fresh-project baseline replaces objects that previously
-- existed outside the tracked migration history.
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_type text NOT NULL DEFAULT 'individual',
  status text NOT NULL DEFAULT 'active',
  cpf_cnpj text,
  email text,
  phone text,
  whatsapp text,
  address jsonb,
  avatar_url text,
  birth_date date,
  credit_score integer DEFAULT 100,
  documents jsonb,
  loan jsonb,
  cellphone_sale jsonb,
  bot_memory text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.collectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collectors ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Usuário',
  email text,
  avatar_url text,
  is_admin boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  is_chat_blocked boolean NOT NULL DEFAULT false,
  plan_tier text NOT NULL DEFAULT 'free',
  subscription_type text,
  subscription_expires_at timestamptz,
  trial_ends_at timestamptz,
  billing_message text,
  pix_key text,
  pix_key_type text,
  onboarding_completed_at timestamptz,
  loan_balance numeric NOT NULL DEFAULT 0,
  expense_balance numeric NOT NULL DEFAULT 0,
  profit_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
