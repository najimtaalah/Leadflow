import Link from "next/link";
import { AlertCircle, ArrowRight, Clock } from "lucide-react";
import { getDashboardSummary } from "@/lib/db/qualiopi-actions";
import { ACTION_PRIORITE_LABELS, ACTION_PRIORITE_VARIANT, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export async function QualiopiDashboardWidget() {
  const summary = await getDashboardSummary();

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          Actions Qualiopi
        </h3>
        <Link
          href="/qualiopi/actions"
          className="text-[11px] text-accent hover:underline flex items-center gap-1"
        >
          Voir toutes <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link href="/qualiopi/actions?statut=en_retard" className="group">
          <div className="bg-red-50 border border-red-200 rounded p-2.5 group-hover:bg-red-100 transition-colors">
            <div className="text-[22px] font-bold text-red-600 leading-none">{summary.en_retard_count}</div>
            <div className="text-[11px] text-red-600 mt-0.5">EN RETARD</div>
          </div>
        </Link>
        <Link href="/qualiopi/actions?priorite=critical" className="group">
          <div className="bg-orange-50 border border-orange-200 rounded p-2.5 group-hover:bg-orange-100 transition-colors">
            <div className="text-[22px] font-bold text-orange-600 leading-none">{summary.prioritaires.length}</div>
            <div className="text-[11px] text-orange-600 mt-0.5">PRIORITAIRES</div>
          </div>
        </Link>
      </div>

      {summary.prochaines_echeances.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-foreground-muted mb-2">Prochaines échéances</p>
          <div className="space-y-1">
            {summary.prochaines_echeances.map((action) => {
              const daysLeft = action.date_echeance
                ? Math.ceil((new Date(action.date_echeance).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <Link
                  key={action.id}
                  href={`/qualiopi/actions/${action.id}`}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-surface-hover transition-colors group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-foreground-subtle shrink-0">[{action.indicateur}]</span>
                    <span className="text-[12px] text-foreground truncate">{action.titre}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Badge variant={ACTION_PRIORITE_VARIANT[action.priorite] as Parameters<typeof Badge>[0]['variant']} className="text-[9px]">
                      {ACTION_PRIORITE_LABELS[action.priorite]}
                    </Badge>
                    {daysLeft !== null && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${daysLeft <= 2 ? 'text-red-500 font-medium' : daysLeft <= 7 ? 'text-orange-500' : 'text-foreground-muted'}`}>
                        <Clock className="h-2.5 w-2.5" />
                        J-{daysLeft}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {summary.en_retard_count === 0 && summary.prochaines_echeances.length === 0 && (
        <p className="text-[12px] text-foreground-muted text-center py-2">Aucune action urgente</p>
      )}
    </div>
  );
}
