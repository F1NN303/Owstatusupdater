import AppLayout from "@/components/AppLayout";
import { pickLang, useAppShell } from "@/lib/appShell";
import { ArrowLeft, ExternalLink, ShieldCheck, Scale } from "lucide-react";
import { Link } from "react-router-dom";

const TermsPage = () => {
  const { language } = useAppShell();
  const t = (en: string, de: string) => pickLang(language, en, de);

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-6 pt-6">
        <div className="flex items-center justify-between gap-3 pb-4 pt-1">
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="glass flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-90"
              aria-label={t("Back to settings", "Zurück zu Einstellungen")}
            >
              <ArrowLeft size={16} className="text-foreground" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("Legal", "Rechtliches")}
              </p>
              <h1 className="text-lg font-semibold text-foreground">
                {t("Terms & Ownership", "Nutzung & Eigentum")}
              </h1>
            </div>
          </div>
        </div>

        <section className="glass glass-specular rounded-2xl p-4">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <Scale size={14} className="text-primary/80" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("Ownership", "Eigentum")}
              </h2>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t(
                "This project is public for deployment and collaboration, but it is proprietary and not open source.",
                "Dieses Projekt ist für Deployment und Zusammenarbeit öffentlich, ist aber proprietär und nicht Open Source."
              )}
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t(
                "Source code, UI design, branding, and original content remain the property of the repository owner unless a file says otherwise.",
                "Quellcode, UI-Design, Branding und originale Inhalte bleiben Eigentum des Repository-Inhabers, sofern eine Datei nichts anderes angibt."
              )}
            </p>
          </div>
        </section>

        <section className="glass glass-specular mt-3 rounded-2xl p-4">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-primary/80" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("Allowed Use", "Erlaubte Nutzung")}
              </h2>
            </div>
            <ul className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
              <li>
                {t(
                  "You may view and use the live website in a browser for normal personal use.",
                  "Du darfst die Live-Website im Browser für normale persönliche Nutzung ansehen und verwenden."
                )}
              </li>
              <li>
                {t(
                  "You may not re-host, mirror, copy, or redistribute the site or source code without written permission.",
                  "Du darfst die Website oder den Quellcode ohne schriftliche Erlaubnis nicht erneut hosten, spiegeln, kopieren oder weiterverteilen."
                )}
              </li>
              <li>
                {t(
                  "Public availability on GitHub/GitHub Pages does not grant reuse rights.",
                  "Die öffentliche Verfügbarkeit auf GitHub/GitHub Pages gewährt keine Wiederverwendungsrechte."
                )}
              </li>
            </ul>
          </div>
        </section>

        <section className="glass glass-specular mt-3 rounded-2xl p-4">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <Scale size={14} className="text-primary/80" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("Third-Party Marks", "Drittmarken")}
              </h2>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t(
                "Service names and logos shown in this app (for example OpenAI, Microsoft 365, PlayStation, Steam, Overwatch) are trademarks of their respective owners.",
                "In dieser App angezeigte Servicenamen und Logos (z. B. OpenAI, Microsoft 365, PlayStation, Steam, Overwatch) sind Marken der jeweiligen Inhaber."
              )}
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t(
                "They are used only for service identification and status reference. No affiliation, endorsement, or ownership claim is made.",
                "Sie werden ausschliesslich zur Service-Identifikation und Statusreferenz genutzt. Es wird keine Verbindung, Billigung oder Inhaberschaft behauptet."
              )}
            </p>
          </div>
        </section>

        <section className="glass glass-specular mt-3 rounded-2xl p-4">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <Scale size={14} className="text-primary/80" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("Imprint Notice (DE)", "Impressum-Hinweis (DE)")}
              </h2>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t(
                "This is a non-commercial hobby project. No business services or commercial offers are provided on this website.",
                "Dies ist ein nicht-kommerzielles Hobbyprojekt. Auf dieser Website werden keine gewerblichen Leistungen oder kommerziellen Angebote bereitgestellt."
              )}
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t(
                "Current operator assessment: under this non-commercial setup, no separate legal imprint details are published here.",
                "Aktuelle Betreiber-Einschaetzung: Bei dieser nicht-kommerziellen Ausgestaltung werden hier keine separaten Impressumsangaben veroeffentlicht."
              )}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground/90">
              {t(
                "Legal note only, no legal advice. If use or project scope changes, legal obligations (including imprint requirements) may change.",
                "Nur Hinweis, keine Rechtsberatung. Wenn sich Nutzung oder Projektumfang aendern, koennen sich rechtliche Pflichten (einschliesslich Impressumspflicht) aendern."
              )}
            </p>
          </div>
        </section>

        <section className="glass glass-specular mt-3 rounded-2xl p-4">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-primary/80" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("Security & Privacy", "Sicherheit & Privatsphäre")}
              </h2>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t(
                "This site only uses public status data and public signup configuration. Secrets and internal runtime state should not be exposed in public outputs.",
                "Diese Website verwendet nur öffentliche Statusdaten und öffentliche Anmeldekonfiguration. Geheimnisse und interne Laufzeitdaten dürfen nicht in öffentlichen Ausgaben erscheinen."
              )}
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t(
                "If you discover an accidental exposure, report it privately to the repository owner instead of posting sensitive details publicly.",
                "Wenn du eine versehentliche Offenlegung entdeckst, melde sie bitte privat an den Repository-Inhaber statt sensible Details öffentlich zu posten."
              )}
            </p>
          </div>
        </section>

        <section className="mt-3 grid gap-3">
          <a
            href="https://github.com/F1NN303/Owstatusupdater/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="glass glass-specular flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-foreground transition-colors hover:bg-white/5"
          >
            <span>{t("Open LICENSE", "LICENSE öffnen")}</span>
            <ExternalLink size={14} className="text-muted-foreground" />
          </a>
          <a
            href="https://github.com/F1NN303/Owstatusupdater/blob/main/NOTICE.md"
            target="_blank"
            rel="noreferrer"
            className="glass glass-specular flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-foreground transition-colors hover:bg-white/5"
          >
            <span>{t("Open NOTICE", "NOTICE öffnen")}</span>
            <ExternalLink size={14} className="text-muted-foreground" />
          </a>
        </section>
      </main>
    </AppLayout>
  );
};

export default TermsPage;
