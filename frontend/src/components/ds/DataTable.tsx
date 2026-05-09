import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  actions?: (row: T) => React.ReactNode;
}

type SortDir = "asc" | "desc";

interface SortState {
  key: string;
  dir: SortDir;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  searchable = false,
  searchPlaceholder = "Rechercher…",
  emptyMessage = "Aucun résultat",
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<SortState | null>(null);
  const [filter, setFilter] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!filter) return data;
    const q = filter.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = (row as Record<string, unknown>)[col.key as string];
        return String(val ?? "").toLowerCase().includes(q);
      }),
    );
  }, [data, filter, columns]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sort.key] ?? "";
      const bv = (b as Record<string, unknown>)[sort.key] ?? "";
      const cmp = String(av).localeCompare(String(bv), "fr");
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort]);

  function handleSort(key: string) {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === "asc" ? { key, dir: "desc" } : null;
      }
      return { key, dir: "asc" };
    });
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sort?.key !== colKey) return <ChevronsUpDown className="h-3 w-3 text-foreground-subtle" />;
    return sort.dir === "asc"
      ? <ChevronUp className="h-3 w-3 text-foreground" />
      : <ChevronDown className="h-3 w-3 text-foreground" />;
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {searchable && (
        <div className="px-0">
          <Input
            placeholder={searchPlaceholder}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-7 text-[12px] w-[240px]"
          />
        </div>
      )}

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className={cn(
                    "text-left px-3 py-2 font-medium text-foreground-muted text-[11px] uppercase tracking-wide whitespace-nowrap",
                    col.sortable && "cursor-pointer select-none hover:text-foreground",
                  )}
                  onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && <SortIcon colKey={String(col.key)} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-8 text-foreground-muted text-[13px]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "group border-b border-border last:border-0 hover:bg-accent/50 transition-colors",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-3 py-2 align-middle">
                      {col.actions ? (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {col.actions(row)}
                        </div>
                      ) : col.render ? (
                        col.render(row)
                      ) : (
                        String((row as Record<string, unknown>)[col.key as string] ?? "—")
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
