import { NextRequest, NextResponse } from "next/server";
import { exportActionsCSV } from "@/lib/db/qualiopi-actions";
import type { ActionQualiopiStatut, ActionQualiopiPriorite, ActionQualiopiIndicateur, ActionQualiopiFormation } from "@/lib/db/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const csv = await exportActionsCSV({
    indicateur: searchParams.get('indicateur') as ActionQualiopiIndicateur | undefined ?? undefined,
    formation: searchParams.get('formation') as ActionQualiopiFormation | undefined ?? undefined,
    statut: searchParams.get('statut') as ActionQualiopiStatut | undefined ?? undefined,
    priorite: searchParams.get('priorite') as ActionQualiopiPriorite | undefined ?? undefined,
    q: searchParams.get('q') ?? undefined,
  });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="actions-qualiopi-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
