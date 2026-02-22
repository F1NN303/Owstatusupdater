import AppLayout from "@/components/AppLayout";
import { resolveLegacyPath } from "@/lib/legacySite";
import {
  ExternalLink,
  Globe,
  Info,
  Settings,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const runtimeMode = import.meta.env.MODE;

const SettingsPage = () => {
  const builtAt = new Date().toLocaleString();

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-28 pt-8">
        <div className="flex items-start justify-between gap-3 pb-5 pt-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">
              Settings
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Preview controls, links, and migration diagnostics
            </p>
          </div>
          <div className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <Settings size={18} className="text-primary" />
          </div>
        </div>

        <section className="glass glass-specular rounded-2xl p-4">
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <Wrench size={14} className="text-primary/80" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Preview State
              </h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Runtime
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{runtimeMode}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Render
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">React Preview</p>
              </div>
              <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Session Opened
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">{builtAt}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4">
          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-primary/80" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Navigation
                </h2>
              </div>
              <a
                href={resolveLegacyPath("/")}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                <span>Open legacy site root</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </a>
              <a
                href={resolveLegacyPath("/overwatch.html")}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                <span>Open legacy Overwatch dashboard</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </a>
              <a
                href={resolveLegacyPath("/sony/index.html")}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                <span>Open legacy Sony PSN dashboard</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </a>
            </div>
          </div>

          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary/80" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Migration Notes
                </h2>
              </div>
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Bottom navigation is now app-style (`Home`, `Favorites`, `Alerts`, `Settings`).
                Service detail pages remain under Home and now use compact tabbed sections.
              </p>
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                EN/DE toggle and persistent version footer are planned next for feature parity with
                the legacy site.
              </p>
            </div>
          </div>

          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10 flex items-center gap-2">
              <Info size={14} className="text-primary/80" />
              <p className="text-xs text-muted-foreground">
                This page is a preview shell and does not change backend status pipelines.
              </p>
            </div>
          </div>
        </section>
      </main>
    </AppLayout>
  );
};

export default SettingsPage;
