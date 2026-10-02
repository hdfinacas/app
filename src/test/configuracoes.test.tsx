import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SECTIONS, SECTION_IDS } from "@/components/configuracoes/SectionRenderer";
import type { SettingsCtx, SettingsForm } from "@/components/configuracoes/types";
import { DEFAULT_MODULES } from "@/contexts/WhiteLabelContext";

// O módulo de configurações foi quebrado em 10 seções. Uma seção que quebra ao
// renderizar hoje só aparece quando o usuário clica na aba — e o app usa
// ErrorBoundary, então o erro vira tela em branco silenciosa. Este teste renderiza
// todas de uma vez para que a quebra apareça no CI, não no cliente.

const formVazio: SettingsForm = {
  company_name: "", company_cnpj: "", company_address: "", company_phone: "",
  company_logo_url: "", favicon_url: "",
  primary_color: "#4a86c8", accent_color: "#6ba3d6", theme_mode: "dark",
  sidebar_style: "default", login_title: "", login_subtitle: "",
  footer_text: "", border_radius: "16", font_family: "default",
  default_interest_rate: "10", default_late_fee: "0", default_daily_interest: "4",
  default_num_installments: "", default_payment_method: "pix", default_max_interest_cap: "",
  default_frequency: "monthly",
  n8n_webhook_url: "", push_notifications_enabled: false,
  pix_key: "", pix_key_type: "cpf",
  portal_title: "", portal_subtitle: "", portal_welcome_message: "",
  portal_primary_color: "", portal_logo_url: "", portal_contact_phone: "",
  portal_contact_email: "",
  custom_contract_template: "", modules_enabled: { ...DEFAULT_MODULES },
};

const ref = { current: null } as any;

const criarCtx = (form: SettingsForm): SettingsCtx => ({
  form,
  setForm: vi.fn(),
  inputCls: "input",
  settings: {},
  logoInputRef: ref, faviconInputRef: ref, portalLogoInputRef: ref,
  onUploadLogo: vi.fn(), onUploadFavicon: vi.fn(), onUploadPortalLogo: vi.fn(),
  uploadingLogo: false, uploadingFavicon: false, uploadingPortalLogo: false,
  notify: vi.fn(),
});

const renderizar = (id: string, ctx: SettingsCtx) => {
  const Section = (SECTIONS as any)[id];
  return render(
    <MemoryRouter>
      <Section ctx={ctx} />
    </MemoryRouter>,
  );
};

describe("módulo de configurações — todas as seções", () => {
  it("expõe as 10 abas esperadas", () => {
    expect(SECTION_IDS).toHaveLength(10);
  });

  it.each(SECTION_IDS)("a seção '%s' renderiza com dados vazios", (id) => {
    expect(() => renderizar(id, criarCtx(formVazio))).not.toThrow();
    cleanup();
  });

  it.each(SECTION_IDS)("a seção '%s' renderiza com dados preenchidos", (id) => {
    const preenchido: SettingsForm = {
      ...formVazio,
      company_name: "Empresa Teste",
      company_logo_url: "https://exemplo/logo.png",
      favicon_url: "https://exemplo/favicon.png",
      portal_logo_url: "https://exemplo/portal.png",
      pix_key: "chave@pix",
      custom_contract_template: "Contrato {{cliente_nome}}",
    };
    expect(() => renderizar(id, criarCtx(preenchido))).not.toThrow();
    cleanup();
  });
});

describe("campos salvos precisam ter onde ser editados", () => {
  // Regressão do bug que derrubou o cadastro de novos clientes: `hubla_checkout_url`
  // era gravado sem existir campo na tela, então o formulário lia "" e salvava nulo
  // por cima do link real — e ninguém percebia.
  //
  // A checagem é no código-fonte das seções, não no DOM: o nome do campo do estado
  // nunca aparece no HTML renderizado, só na expressão `form.<campo>`.
  it("todo campo do formulário é referenciado por alguma seção", () => {
    const dir = path.join(process.cwd(), "src/components/configuracoes/sections");
    const fonte = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
      .join("\n");

    // Campos sem input próprio, por decisão de projeto — cada um com o motivo.
    const semCampoProprio: Record<string, string> = {
      default_late_fee: "multa fixa desativada: mostrada travada em 0",
      sidebar_style: "fixado em 'default', sem seletor na interface",
      theme_mode: "tema escuro fixado pela identidade visual da marca",
    };

    const ausentes = (Object.keys(formVazio) as string[]).filter((campo) => {
      if (campo in semCampoProprio) return false;
      // `form.campo` cobre o caso normal; `key: "campo"` cobre os toggles que a
      // seção monta a partir de uma lista e acessa por `form[opt.key]`.
      return !fonte.includes(`form.${campo}`) && !fonte.includes(`"${campo}" as const`);
    });

    expect(ausentes, `campos salvos sem lugar para editar: ${ausentes.join(", ")}`).toHaveLength(0);
  });
});
