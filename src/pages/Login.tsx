import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { hasPortalSession } from "@/lib/portalSession";
import { z } from "zod";
import defaultLogo from "@/assets/dh-horizontal.svg";
import { supabase } from "@/integrations/supabase/client";
import { setRememberMe, getRememberMe } from "@/integrations/supabase/remember";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Globe,
  Users,
  BarChart3,
  ShieldCheck,
  MonitorSmartphone,
} from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { withTimeout } from "@/lib/withTimeout";

// ---------- Validação ----------
const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail")
  .email("E-mail inválido")
  .max(255, "E-mail muito longo");

const passwordLoginSchema = z
  .string()
  .min(1, "Informe sua senha")
  .max(72, "Senha muito longa");

const AUTH_REQUEST_TIMEOUT_MS = 15_000;

// ---------- Tradução de erros do Supabase ----------
const friendlyAuthError = (err: any): string => {
  const msg = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  if (code.includes("invalid_credentials") || msg.includes("invalid login"))
    return "E-mail ou senha incorretos.";
  if (msg.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("user already"))
    return "Este e-mail já está cadastrado. Faça login.";
  if (msg.includes("rate limit") || err?.status === 429)
    return "Muitas tentativas. Aguarde alguns minutos.";
  if (msg.includes("weak password"))
    return "Senha fraca. Use letras e números.";
  if (msg.includes("network") || msg.includes("failed to fetch"))
    return "Sem conexão. Verifique sua internet.";
  return err?.message || "Não foi possível concluir. Tente novamente.";
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMeState] = useState<boolean>(() => getRememberMe());
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const navigate = useNavigate();
  // Estes três ficavam DEPOIS do `return` logo abaixo. Quando `hasPortalSession()`
  // mudava de valor entre dois renders — é o que acontece ao sair do portal do
  // cliente neste mesmo navegador — a quantidade de hooks mudava junto e o React
  // derrubava a tela de login inteira (erro #310).
  const { toast } = useToast();
  const { config } = useWhiteLabel();

  // Se este navegador possui sessão do portal do cliente, não permitir acesso
  // à tela de login do credor — devolve o cliente ao portal dele.
  const temSessaoDoPortal = hasPortalSession();

  const sanitizeNext = (raw: string | null): string | null => {
    if (!raw) return null;
    if (!raw.startsWith("/")) return null;
    if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
    if (raw.toLowerCase().startsWith("/login") || raw.toLowerCase().startsWith("/reset-password")) return null;
    return raw;
  };
  const nextPath = sanitizeNext(searchParams.get("next"));
  const logoSrc = config.companyLogo || defaultLogo;
  const brandTitle = config.loginTitle || config.companyName || "DH Financeira";
  const brandSubtitle = config.loginSubtitle || "GESTÃO FINANCEIRA SIMPLES E SEGURA";
  const footerText = config.footerText || `© ${new Date().getFullYear()} DH FINANCEIRA · TODOS OS DIREITOS RESERVADOS`;

  const validateField = (field: "email" | "password", value: string) => {
    try {
      if (field === "email") emailSchema.parse(value);
      if (field === "password") passwordLoginSchema.parse(value);
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [field]: err.errors[0]?.message }));
      }
    }
  };

  const validateAll = (): boolean => {
    const next: typeof errors = {};
    const eRes = emailSchema.safeParse(email);
    if (!eRes.success) next.email = eRes.error.errors[0]?.message;
    const pRes = passwordLoginSchema.safeParse(password);
    if (!pRes.success) next.password = pRes.error.errors[0]?.message;
    setErrors(next);
    setTouched({ email: true, password: true });
    return Object.keys(next).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validateAll()) return;
    setLoading(true);
    setRememberMe(rememberMe);
    let error: { message?: string; code?: string; status?: number } | null = null;
    try {
      ({ error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }), AUTH_REQUEST_TIMEOUT_MS));
    } catch (authError) {
      error = authError as typeof error;
    }
    if (error) {
      setLoading(false);
      const msg = friendlyAuthError(error);
      setFormError(msg);
      toast({ title: "Erro ao entrar", description: msg, variant: "destructive" });
      return;
    }

    // Contas são provisionadas pelo administrador; a rota protegida verifica
    // apenas a sessão e o estado da conta.
    setLoading(false);
    navigate(nextPath ?? "/dashboard", { replace: true });
  };

  // ---------- Estilos ----------
  const inputBase =
    "w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.04] border text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 transition-all duration-200";
  const inputOk = "border-white/[0.08] focus:ring-white/30 focus:border-white/30";
  const inputErr = "border-red-400/40 focus:ring-red-400/40 focus:border-red-400/60";
  const cls = (field: "email" | "password") =>
    `${inputBase} ${touched[field] && errors[field] ? inputErr : inputOk}`;

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? (
      <p className="mt-1.5 text-[11px] text-red-300/90 flex items-center gap-1.5 animate-fade-in">
        <AlertCircle size={12} className="shrink-0" />
        <span>{msg}</span>
      </p>
    ) : null;

  // O desvio para o portal do cliente acontece aqui embaixo, com todos os hooks
  // já chamados — o comportamento é o mesmo de antes, sem o risco de mudar a
  // quantidade de hooks entre um render e outro.
  if (temSessaoDoPortal) {
    return <Navigate to="/portal-cliente" replace />;
  }

  return (
    <div
      className="credinho-auth relative min-h-dvh flex flex-col overflow-x-hidden font-body bg-[#042A40] bg-cover bg-center bg-no-repeat px-5 py-6 sm:px-8 lg:px-12"
      style={{
        backgroundImage: "radial-gradient(ellipse at 78% 20%, rgba(0,182,239,.22), transparent 42%), linear-gradient(135deg, #042A40 0%, #063b58 55%, #006BCC 140%)",
      }}
    >
      <div className="credinho-auth-shade absolute inset-0 z-0" />

      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 md:top-8 md:left-8 z-20 flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium hidden sm:inline">Voltar para o site</span>
      </button>

      <div className="absolute right-8 top-7 z-20 hidden items-center gap-2 text-xs font-medium text-white/75 sm:flex">
        <Globe size={14} /> Português (BR) <span className="ml-2 text-white/45">⌄</span>
      </div>

      <aside className="credinho-auth-copy">
        <span className="credinho-kicker">ACESSO SEGURO</span>
        <h2 className="mt-4 font-display font-semibold text-white">Gestão clara.<br />Decisões <span className="text-[#00B6EF]">seguras.</span></h2>
        <p className="mt-5 max-w-sm text-sm leading-7 text-white/55">Organize sua carteira, acompanhe seus resultados e conquiste uma rotina mais tranquila.</p>
        <div className="mt-6 flex gap-6 text-xs text-[#00B6EF]"><span className="flex items-center gap-2"><ShieldCheck size={16} /> Confiança</span><span className="flex items-center gap-2"><BarChart3 size={16} /> Progresso</span></div>
      </aside>
      {/* Card */}
      <div className="relative z-10 w-full max-w-[500px] mx-auto animate-scale-in">
        <div className="rounded-[26px] overflow-hidden border border-white/15 bg-[#06334d]/90 shadow-[0_24px_80px_rgba(0,20,35,.4)] backdrop-blur-2xl">
          <div className="flex flex-col items-center px-6 pt-7 sm:pt-8">
            <img src={logoSrc} alt={brandTitle} className="h-auto w-56 max-w-full object-contain" />
            <p className="mt-2 text-[9px] tracking-[0.18em] text-white/45">{brandSubtitle}</p>
          </div>
            <div className="flex flex-col md:flex-row">
              {/* Form de Login */}
              <div className="flex-1 p-6 sm:p-8 md:p-10 bg-white/[0.025]">
                <div className="mb-7 border-b border-white/15">
                  <span className="relative inline-block pb-3 text-sm font-semibold text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#00B6EF]">Entrar</span>
                </div>
                <h2 className="font-display text-xl font-semibold text-white mb-1">Bem-vindo</h2>
                <p className="text-white/60 text-sm mb-6">Acesso criado e liberado pelo administrador.</p>

                {formError && (
                  <div
                    role="alert"
                    className="mb-4 p-3 rounded-xl border border-red-400/30 bg-red-500/10 text-red-100 text-xs flex items-start gap-2 animate-fade-in"
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="login-email" className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">
                      E-mail
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (touched.email) validateField("email", e.target.value);
                        }}
                        onBlur={() => {
                          setTouched((t) => ({ ...t, email: true }));
                          validateField("email", email);
                        }}
                        aria-invalid={!!(touched.email && errors.email)}
                        aria-describedby={errors.email ? "login-email-err" : undefined}
                        className={cls("email")}
                      />
                    </div>
                    <div id="login-email-err"><FieldError msg={touched.email ? errors.email : undefined} /></div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (touched.password) validateField("password", e.target.value);
                        }}
                        onBlur={() => {
                          setTouched((t) => ({ ...t, password: true }));
                          validateField("password", password);
                        }}
                        aria-invalid={!!(touched.password && errors.password)}
                        aria-describedby={errors.password ? "login-pwd-err" : undefined}
                        className={cls("password") + " pr-11"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div id="login-pwd-err"><FieldError msg={touched.password ? errors.password : undefined} /></div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <span className="relative inline-flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMeState(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="w-4 h-4 rounded-[5px] border border-white/20 bg-white/[0.04] peer-checked:bg-white/90 peer-checked:border-white/90 transition-all duration-200" />
                        <svg
                          viewBox="0 0 16 16"
                          className="absolute w-3 h-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 8.5l3.5 3.5L13 5" />
                        </svg>
                      </span>
                      <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                        Lembrar-me
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(nextPath ? `/reset-password?next=${encodeURIComponent(nextPath)}` : "/reset-password")
                      }
                      className="text-xs text-white/40 hover:text-white/80 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>


                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2"
                    style={{ background: "var(--gradient-button)", color: "hsl(var(--primary-foreground))" }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Entrando...
                      </>
                    ) : (
                      <>
                        Entrar no Sistema <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>


              </div>

            </div>

        </div>
      </div>

      <p className="relative z-10 text-white/20 text-[10px] mt-8 tracking-wider text-center px-4">
        {footerText}
      </p>
    </div>
  );
};

export default Login;
