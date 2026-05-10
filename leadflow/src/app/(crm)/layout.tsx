import { AppLayout } from "@/components/ds/app-layout";
import { CrmSidebar } from "@/components/crm/crm-sidebar";
import { getCurrentUser } from "@/lib/auth";
import { countRelancesEnRetard } from "@/lib/db/leads";
import { initDb } from "@/lib/db/dossiers";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  initDb();
  const user = await getCurrentUser();
  const relancesEnRetard = await countRelancesEnRetard(
    user.role === 'commercial' ? user.id : undefined
  );

  return (
    <AppLayout
      sidebar={
        <CrmSidebar
          relancesEnRetard={relancesEnRetard}
          currentUserRole={user.role}
          currentUserName={`${user.prenom} ${user.nom}`}
        />
      }
    >
      {children}
    </AppLayout>
  );
}
