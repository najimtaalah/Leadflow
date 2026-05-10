import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

const ROLE_LABELS: Record<string, string> = {
  commercial: "Commercial",
  closer_habilite: "Closer habilité",
  gestionnaire: "Gestionnaire",
  admin: "Admin",
  super_admin: "Super Admin",
};

async function switchUser(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  if (userId) {
    const store = await cookies();
    store.set("user_id", userId, { path: "/", httpOnly: true, sameSite: "lax" });
  }
  redirect("/leads");
}

export default async function LoginPage() {
  const users = await prisma.user.findMany({ orderBy: { role: "asc" } });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-foreground">LeadFlow+</h1>
          <p className="text-sm text-foreground-muted">Choisissez un compte pour accéder à l&apos;application</p>
        </div>
        <form action={switchUser} className="space-y-3">
          <div className="space-y-2">
            {users.map((user) => (
              <label
                key={user.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-surface-raised transition-colors"
              >
                <input type="radio" name="userId" value={user.id} className="accent-accent" required />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{user.prenom} {user.nom}</p>
                  <p className="text-xs text-foreground-muted">{ROLE_LABELS[user.role] ?? user.role}</p>
                </div>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Connexion
          </button>
        </form>
      </div>
    </div>
  );
}
