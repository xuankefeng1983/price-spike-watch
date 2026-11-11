import { useEffect, useRef } from "react";
import { BookOpen, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useExplainView, type ExplainIn } from "@/lib/api";

/** Side panel: AI read of the current view. Regenerates only on request, flags when the view has moved on. */
export function ExplainPanel({ open, onClose, view }: { open: boolean; onClose: () => void; view: ExplainIn | null }) {
  const m = useExplainView();
  const asked = useRef<string | null>(null);
  const key = view ? JSON.stringify(view) : null;
  const stale = !!m.data && asked.current !== key;

  const run = () => {
    if (!view || m.isPending) return;
    asked.current = key;
    m.mutate(view);
  };

  // First open (or reopen with nothing yet) explains straight away.
  useEffect(() => {
    if (open && !m.data && !m.isPending && !m.isError) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const out = m.data?.data;

  return (
    <aside
      role="dialog"
      aria-label="Explain this view"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-card shadow-2xl"
    >
      <header className="flex items-center gap-2 border-b px-5 py-4">
        <Sparkles className="h-4 w-4 text-heat-1" aria-hidden />
        <h2 className="font-semibold">Explain this view</h2>
        <div className="flex-1" />
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 text-sm">
        {stale && !m.isPending && (
          <div className="flex items-center gap-3 rounded-md border border-heat-1/50 p-3">
            You've changed the filters or spike since this was written.
            <button type="button" onClick={run} className="ml-auto shrink-0 underline underline-offset-2">Update</button>
          </div>
        )}

        {m.isPending && (
          <div className="space-y-3" aria-live="polite">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading the numbers on this page… (about 10 seconds)
            </p>
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${90 - i * 12}%` }} />)}
          </div>
        )}

        {m.isError && !m.isPending && (
          <div className="space-y-2 rounded-md border border-heat-3/50 p-3">
            <p>The summary couldn't be written just now. The dashboard itself is unaffected.</p>
            <button type="button" onClick={run} className="underline underline-offset-2">Try again</button>
          </div>
        )}

        {out && !m.isPending && (
          <>
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{out.view_label}</p>
              <h3 className="text-lg font-semibold leading-snug">{out.headline}</h3>
              <p className="leading-relaxed">{out.summary}</p>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Key points</h4>
              <ul className="space-y-2">
                {out.key_points.map((k, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-heat-2" />{k}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-2 rounded-md bg-muted/60 p-4">
              <h4 className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" aria-hidden /> How to read this page
              </h4>
              <ul className="space-y-2">
                {out.how_to_read.map((k, i) => <li key={i} className="leading-relaxed">{k}</li>)}
              </ul>
            </section>

            <p className="border-l-2 border-heat-1 pl-3 text-muted-foreground">{out.caveat}</p>
          </>
        )}
      </div>

      <footer className="flex items-center gap-3 border-t px-5 py-3 text-xs text-muted-foreground">
        <span>AI-written by {out?.model ?? "Claude Sonnet"} from this page's numbers only. Check before sharing.</span>
        <button
          type="button"
          onClick={run}
          disabled={m.isPending || !view}
          className="ml-auto flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-foreground hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className="h-3 w-3" aria-hidden /> Regenerate
        </button>
      </footer>
    </aside>
  );
}
