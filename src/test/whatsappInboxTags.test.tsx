import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WhatsAppInbox from "@/pages/WhatsAppInbox";

const api = vi.hoisted(() => ({
  update: vi.fn(), user: { id: "owner", email: "owner@example.test" },
  conversation: { id: "conversation", user_id: "owner", contact_name: "Contato de teste", phone: "11999999999",
    last_message_at: "2026-09-10T12:00:00Z", unread_count: 0, tags: ["Existente"], bot_paused: false, blocked: false },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: api.user }) }));
vi.mock("@/components/VoiceRecorder", () => ({ default: () => null }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let patch: unknown;
    const chain = {
      select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, gte: () => chain,
      update: (value: unknown) => { patch = value; return chain; },
      then: (resolve: (value: unknown) => unknown) => {
        if (patch) api.update(table, patch);
        return Promise.resolve({ data: table === "whatsapp_conversations" && !patch ? [api.conversation] : [], error: null }).then(resolve);
      },
    };
    return chain;
  },
  channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
  removeChannel: vi.fn(),
} }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const openTags = async () => {
  render(<WhatsAppInbox />);
  fireEvent.click(await screen.findByText("Contato de teste"));
  fireEvent.click(screen.getByTitle("Tags"));
  await screen.findByPlaceholderText("Nova etiqueta");
};

it("adiciona a etiqueta sugerida mesmo com o campo vazio", async () => {
  await openTags();
  fireEvent.click(screen.getByRole("button", { name: "+ VIP" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith("whatsapp_conversations", { tags: ["Existente", "VIP"] }));
  expect(await screen.findAllByText("#VIP")).not.toHaveLength(0);
});
it("usa a sugestão escolhida em vez do texto anterior do campo", async () => {
  await openTags();
  fireEvent.change(screen.getByPlaceholderText("Nova etiqueta"), { target: { value: "Rascunho" } });
  fireEvent.click(screen.getByRole("button", { name: "+ Quitado" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith("whatsapp_conversations", { tags: ["Existente", "Quitado"] }));
  expect(api.update).not.toHaveBeenCalledWith("whatsapp_conversations", { tags: ["Existente", "Rascunho"] });
});
