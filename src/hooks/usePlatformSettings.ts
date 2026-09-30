import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Configuração global da plataforma (linha única em `platform_settings`).
 * Vale para todos os assinantes e só o dono do app consegue escrever.
 *
 * Não confundir com `settings`, que é a configuração de CADA assinante.
 */
export interface PlatformSettings {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  allow_new_registrations: boolean;
  default_trial_days: number;
  global_announcement: string | null;
  checkout_url: string | null;
}

export const PLATFORM_SETTINGS_DEFAULTS: PlatformSettings = {
  maintenance_mode: false,
  maintenance_message: null,
  allow_new_registrations: true,
  default_trial_days: 3,
  global_announcement: null,
  checkout_url: null,
};

export const PLATFORM_SETTINGS_KEY = ["platform-settings"];

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("maintenance_mode, maintenance_message, allow_new_registrations, default_trial_days, global_announcement, checkout_url")
    .maybeSingle();

  // Falha de rede ou tabela ainda não migrada não pode derrubar o app: cai nos
  // padrões abertos (sem manutenção, cadastro liberado).
  if (error || !data) return PLATFORM_SETTINGS_DEFAULTS;
  return { ...PLATFORM_SETTINGS_DEFAULTS, ...data };
}

export function usePlatformSettings() {
  const { data, isLoading } = useQuery({
    queryKey: PLATFORM_SETTINGS_KEY,
    queryFn: fetchPlatformSettings,
    staleTime: 1000 * 60 * 5,
  });

  return { settings: data ?? PLATFORM_SETTINGS_DEFAULTS, isLoading };
}
