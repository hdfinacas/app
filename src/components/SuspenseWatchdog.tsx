import { useEffect, useState } from "react";

/** Mostra uma opção de recuperação se um módulo lazy demorar demais. */
const SuspenseWatchdog = ({
  children,
  timeoutMs = 20000,
}: {
  children: React.ReactNode;
  timeoutMs?: number;
}) => {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setStalled(true), timeoutMs);
    return () => window.clearTimeout(id);
  }, [timeoutMs]);

  return <>
    {children}
    {stalled && <div role="alert" className="fixed inset-x-4 bottom-4 z-[200] mx-auto flex max-w-lg items-center justify-between gap-4 rounded-2xl border border-[#00B6EF40] bg-[#0b1016]/95 p-4 text-white shadow-2xl backdrop-blur-xl">
      <p className="text-left text-xs leading-relaxed text-white/75">Esta etapa está demorando mais do que o normal. Você pode tentar novamente.</p>
      <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-xl border border-[#00B6EF55] bg-[#00B6EF17] px-3 py-2 text-xs font-semibold text-[#54d4ff] transition hover:bg-[#00B6EF2b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B6EF]">
        Tentar novamente
      </button>
    </div>}
  </>;
};

export default SuspenseWatchdog;
