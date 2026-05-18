import { useParams, useSearchParams, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { DocumentsTab } from "@/components/dossier/DocumentsTab";
import { ConformiteTab } from "@/components/dossier/ConformiteTab";
import { useAuthStore } from "@/stores/auth.store";

type Tab = "documents" | "conformite";

const TABS: { id: Tab; label: string }[] = [
  { id: "documents", label: "Documents" },
  { id: "conformite", label: "Conformité Qualiopi" },
];

export function DossierDetailPage() {
  const { id: dossierId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const activeTab = (searchParams.get("tab") as Tab) ?? "documents";

  if (!dossierId) {
    return (
      <div className="p-6 text-foreground-muted text-[13px]">
        Identifiant de dossier manquant.
      </div>
    );
  }

  // COMMERCIAL cannot access Conformité tab
  const allowedTabs =
    user?.role === "COMMERCIAL"
      ? TABS.filter((t) => t.id !== "conformite")
      : TABS;

  function setTab(tab: Tab) {
    setSearchParams({ tab });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="px-6 pt-5 pb-0 text-[12px] text-foreground-muted">
        <Link to="/dossiers" className="hover:text-foreground">
          Dossiers
        </Link>
        {" / "}
        <span className="text-foreground font-medium">{dossierId}</span>
      </div>

      {/* Tab bar */}
      <div className="px-6 mt-4 border-b border-border flex items-center gap-0">
        {allowedTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-foreground-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "documents" && <DocumentsTab dossierId={dossierId} />}
        {activeTab === "conformite" && user?.role !== "COMMERCIAL" && (
          <ConformiteTab dossierId={dossierId} />
        )}
      </div>
    </div>
  );
}
