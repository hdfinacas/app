import { useRef, useState, type MouseEvent } from "react";
import { Download, Trash2, AlertTriangle, Loader2, ShieldAlert, Upload, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const DangerZone = ({ mode = "delete" }: { mode?: "delete" | "backup" }) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restorePath, setRestorePath] = useState("");
  const [restoreReport, setRestoreReport] = useState<Record<string, { no_backup: number }> | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente para exportar os dados.");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-user-data`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const a = document.createElement("a");
      const downloadUrl = URL.createObjectURL(blob);
      a.href = downloadUrl;
      a.download = `meus-dados-${Date.now()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(downloadUrl);
      toast({ title: "Download iniciado", description: "Seu arquivo JSON com todos os dados foi gerado." });
    } catch (e: any) {
      toast({ title: "Falha ao exportar", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally { setExporting(false); }
  };

  const handleRestoreFile = async (file?: File) => {
    if (!file || !user) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite para um backup é 50 MB.", variant: "destructive" });
      return;
    }
    setRestoreBusy(true);
    let path = "";
    try {
      path = `${user.id}/imports/${crypto.randomUUID()}.json`;
      const { error: uploadError } = await supabase.storage.from("backups").upload(path, file, {
        contentType: "application/json",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.functions.invoke("restore-user-data", { body: { path } });
      if (error || data?.error) throw new Error(data?.detail || data?.error || error?.message || "Não foi possível conferir o backup.");
      if (data?.mode !== "preview" || !data?.report) throw new Error("A resposta de conferência do backup é inválida.");
      setRestorePath(path);
      setRestoreReport(data.report);
      setRestoreOpen(true);
    } catch (error: any) {
      if (path) await supabase.storage.from("backups").remove([path]).catch(() => undefined);
      toast({ title: "Não foi possível receber o backup", description: error?.message || "Confira se o arquivo JSON é válido.", variant: "destructive" });
    } finally {
      setRestoreBusy(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  const handleRestoreConfirm = async (event?: MouseEvent) => {
    event?.preventDefault();
    if (!restorePath) return;
    setRestoreBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("restore-user-data", {
        body: { path: restorePath, confirmar: "RESTAURAR" },
      });
      if (error || data?.error) throw new Error(data?.detail || data?.error || error?.message || "Falha ao restaurar o backup.");
      setRestoreOpen(false);
      setRestorePath("");
      setRestoreReport(null);
      toast({ title: "Backup restaurado", description: "Os registros foram associados à sua conta. Atualizando os dados da tela…" });
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error: any) {
      toast({ title: "Falha ao restaurar", description: error?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setRestoreBusy(false);
    }
  };

  const closeRestorePreview = async (open: boolean) => {
    setRestoreOpen(open);
    if (!open && restorePath) {
      await supabase.storage.from("backups").remove([restorePath]);
      setRestorePath("");
      setRestoreReport(null);
    }
  };

  const handleDelete = async () => {
    if (!user?.email) return;
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast({ title: "Email não confere", description: "Digite exatamente o email da sua conta.", variant: "destructive" });
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user-account", {
        body: { email_confirmation: confirmEmail.trim() },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.message || error?.message || "Erro");
      toast({ title: "Conta apagada", description: "Todos os seus dados foram removidos. Adeus 👋" });
      await signOut();
      window.location.href = "/";
    } catch (e: any) {
      toast({ title: "Falha ao apagar conta", description: e?.message || "Tente novamente.", variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <>
      <div className={`rounded-2xl border p-6 space-y-4 ${mode === "backup" ? "border-border bg-card" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === "backup" ? "bg-primary/10" : "bg-destructive/15"}`}>
            {mode === "backup" ? <Database size={16} className="text-primary" /> : <ShieldAlert size={16} className="text-destructive" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{mode === "backup" ? "Backup e transferência de dados" : "Meus dados (LGPD)"}</h2>
            <p className="text-[11px] text-muted-foreground">{mode === "backup" ? "Exporte seus dados ou importe um backup para esta conta." : "Gerencie os dados da sua conta."}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mode === "backup" && <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-card border border-border text-sm font-medium hover:bg-accent/50 transition disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? "Gerando..." : "Baixar meus dados (JSON)"}
          </button>}
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => void handleRestoreFile(event.target.files?.[0])}
          />
          {mode === "backup" && <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            disabled={restoreBusy || !user}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-card border border-primary/30 text-sm font-medium hover:bg-primary/10 transition disabled:opacity-50"
          >
            {restoreBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {restoreBusy ? "Conferindo backup..." : "Receber backup (JSON)"}
          </button>}
          {mode === "delete" && <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm font-medium text-destructive hover:bg-destructive/20 transition"
          >
            <Trash2 size={16} /> Apagar minha conta
          </button>}
        </div>

        {mode === "backup" && <p className="text-[11px] text-muted-foreground">
          O backup inclui clientes, contratos, parcelas, cobranças, investidores, transações, configurações e históricos da conta. A restauração confere o arquivo antes, associa os dados ao usuário conectado e mescla registros sem apagar dados atuais. Senhas, permissões administrativas e chaves de integração não são exportadas.
        </p>}

        {mode === "delete" && <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5 text-warning shrink-0" />
          Apagar a conta é <strong>permanente</strong>: remove clientes, contratos, parcelas, mensagens e histórico. Não há como desfazer.
        </p>}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmEmail(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} /> Apagar minha conta
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta ação é <strong>irreversível</strong>. Todos os seus clientes, contratos, parcelas,
                mensagens, histórico e configurações serão apagados imediatamente.
              </span>
              <span className="block">
                Recomendamos <strong>baixar seus dados</strong> antes.
              </span>
              <span className="block text-xs">
                Para confirmar, digite seu email <code className="text-destructive font-mono">{user?.email}</code>:
              </span>
              <input
                type="email"
                autoFocus
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={user?.email || ""}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting || confirmEmail.trim().toLowerCase() !== (user?.email || "").toLowerCase()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 size={14} className="animate-spin mr-2" /> Apagando...</> : "Apagar permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreOpen} onOpenChange={(open) => void closeRestorePreview(open)}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Database size={18} className="text-primary" /> Conferir restauração do backup
            </AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo passou pela validação. A restauração vai mesclar os registros com esta conta; dados atuais que não aparecem no backup serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-border/60 bg-background/50 p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {Object.entries(restoreReport || {}).filter(([, value]) => value.no_backup > 0).map(([table, value]) => (
                <div key={table} className="flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground">{table}</span>
                  <strong className="tabular-nums text-foreground">{value.no_backup}</strong>
                </div>
              ))}
              {!Object.values(restoreReport || {}).some((value) => value.no_backup > 0) && (
                <p className="col-span-2 text-muted-foreground">O arquivo não contém registros restauráveis.</p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">A conta autenticada e suas permissões não serão substituídas. Chaves e tokens de serviços externos precisarão ser configurados novamente.</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => void handleRestoreConfirm(event)}
              disabled={restoreBusy || !Object.values(restoreReport || {}).some((value) => value.no_backup > 0)}
            >
              {restoreBusy ? <><Loader2 size={14} className="mr-2 animate-spin" /> Restaurando...</> : "Restaurar dados"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DangerZone;
