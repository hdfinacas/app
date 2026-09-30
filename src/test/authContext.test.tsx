import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { saveOfflineSession } from "@/lib/offlineSession";

const api = vi.hoisted(() => ({
  getSession: vi.fn(), single: vi.fn(), rpc: vi.fn(), signOut: vi.fn(),
  listener: null as null | ((event: string, session: Session | null) => void),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: api.getSession, signOut: api.signOut,
    onAuthStateChange: (listener: typeof api.listener) => {
      api.listener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    },
  },
  from: () => ({ select: () => ({ eq: () => ({ single: api.single }) }) }),
  rpc: api.rpc,
} }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const session = (id: string) => ({ user: { id, email: `${id}@example.test` } }) as Session;
const profileResult = (id: string) => ({ data: { id, subscription_type: "lifetime" }, error: null });
const open = async () => {
  const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  return hook;
};
const emit = async (value: Session | null, event = "SIGNED_IN") => {
  await act(async () => {
    api.listener!(event, value);
    await vi.advanceTimersByTimeAsync(0);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  api.getSession.mockResolvedValue({ data: { session: null }, error: null });
  api.single.mockResolvedValue(profileResult("a"));
  api.rpc.mockResolvedValue({ data: false, error: null });
  api.signOut.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("sessão e perfil", () => {
  it("aguarda o perfil no primeiro login antes de liberar as rotas", async () => {
    const pending = deferred<ReturnType<typeof profileResult>>();
    api.single.mockReturnValue(pending.promise);
    const { result } = await open();
    expect(result.current.loading).toBe(false);
    await emit(session("a"));
    expect(result.current.loading).toBe(true);
    await act(async () => { pending.resolve(profileResult("a")); });
    expect(result.current.loading).toBe(false);
    expect(result.current.profile?.id).toBe("a");
  });

  it("descarta o perfil que termina depois do logout", async () => {
    const pending = deferred<ReturnType<typeof profileResult>>();
    api.single.mockReturnValue(pending.promise);
    api.rpc.mockResolvedValue({ data: true, error: null });
    const { result } = await open();
    await emit(session("a"));
    await emit(null, "SIGNED_OUT");
    await act(async () => { pending.resolve(profileResult("a")); });
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.isPlatformAdmin).toBe(false);
  });

  it("não substitui o perfil da nova conta por uma resposta da conta anterior", async () => {
    const old = deferred<ReturnType<typeof profileResult>>();
    api.single.mockReturnValueOnce(old.promise).mockResolvedValue(profileResult("b"));
    const { result } = await open();
    await emit(session("a"));
    await emit(session("b"));
    await act(async () => { old.resolve(profileResult("a")); });
    expect(result.current.user?.id).toBe("b");
    expect(result.current.profile?.id).toBe("b");
  });

  it("não duplica a consulta de perfil entre getSession e INITIAL_SESSION", async () => {
    api.getSession.mockResolvedValue({ data: { session: session("a") }, error: null });
    await open();
    await emit(session("a"), "INITIAL_SESSION");
    await emit(session("a"), "TOKEN_REFRESHED");
    expect(api.single).toHaveBeenCalledTimes(1);
    expect(api.rpc).toHaveBeenCalledTimes(1);
  });

  it("não reutiliza permissão administrativa em cache quando o banco a revoga", async () => {
    saveOfflineSession("a", { id: "a", subscription_type: "lifetime" }, true);
    api.single.mockResolvedValue({ data: null, error: { message: "Falha de rede" } });
    const { result } = await open();
    await emit(session("a"));
    expect(result.current.isPlatformAdmin).toBe(false);
    expect(result.current.profile).toBeNull();
  });

  it("não restaura uma sessão antiga que chega depois de SIGNED_IN", async () => {
    const bootstrap = deferred<{ data: { session: Session | null }; error: null }>();
    api.getSession.mockReturnValue(bootstrap.promise);
    const { result } = await open();
    await emit(session("a"));
    await act(async () => { bootstrap.resolve({ data: { session: null }, error: null }); });
    expect(result.current.user?.id).toBe("a");
    expect(result.current.profile?.id).toBe("a");
  });

  it("oferece recuperação quando a sessão não responde e tenta novamente", async () => {
    api.getSession.mockReturnValueOnce(new Promise(() => {}));
    const { result } = await open();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(result.current.loading).toBe(false);
    expect(result.current.authError).toContain("sessão");
    act(() => { result.current.retryAuth(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.authError).toBeNull();
    expect(api.getSession).toHaveBeenCalledTimes(2);
  });

  it("permite tentar carregar o perfil novamente após um timeout", async () => {
    api.single.mockReturnValueOnce(new Promise(() => {}));
    const { result } = await open();
    await emit(session("a"));
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(result.current.loading).toBe(false);
    expect(result.current.authError).toContain("perfil");
    await act(async () => { result.current.retryAuth(); });
    expect(result.current.authError).toBeNull();
    expect(result.current.profile?.id).toBe("a");
  });

  it("mantém acesso offline ao perfil da própria conta sem esperar rede", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    saveOfflineSession("a", { id: "a", subscription_type: "lifetime" }, false);
    const { result } = await open();
    await emit(session("a"));
    expect(result.current.profile?.id).toBe("a");
    expect(result.current.loading).toBe(false);
    expect(api.single).not.toHaveBeenCalled();
  });

  it("não promove usuário a administrador quando a RPC falha online", async () => {
    saveOfflineSession("a", { id: "a", subscription_type: "lifetime" }, true);
    api.rpc.mockRejectedValue(new Error("RPC indisponível"));
    const { result } = await open();
    await emit(session("a"));
    expect(result.current.profile?.id).toBe("a");
    expect(result.current.isPlatformAdmin).toBe(false);
  });

  it("descarta consulta pendente após desmontar o provider", async () => {
    const pending = deferred<ReturnType<typeof profileResult>>();
    api.single.mockReturnValue(pending.promise);
    const hook = await open();
    await emit(session("a"));
    hook.unmount();
    await act(async () => { pending.resolve(profileResult("a")); });
    expect(localStorage.getItem("credmais-offline-session:a")).toBeNull();
  });
});
