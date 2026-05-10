"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export interface Column<T> {
  key: keyof T | string;
  header: React.ReactNode;
  cell: (row: T, rowIndex: number) => React.ReactNode;
  width?: string;
  minWidth?: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

export interface RowGroup<T> {
  key: string;
  label: React.ReactNode;
  rows: T[];
}

type SortDir = "asc" | "desc" | null;

interface DataTableProps<T> {
  columns: Column<T>[];
  rows?: T[];
  groups?: RowGroup<T>[];
  getRowId: (row: T) => string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onRowClick?: (row: T) => void;
  sortKey?: string;
  sortDir?: SortDir;
  onSort?: (key: string) => void;
  emptyState?: React.ReactNode;
  rowHeight?: "xs" | "sm" | "md";
  className?: string;
}

const ROW_HEIGHT = {
  xs: "h-[28px]",
  sm: "h-[32px]",
  md: "h-[36px]",
};

export function DataTable<T>({
  columns,
  rows,
  groups,
  getRowId,
  selectable = false,
  selectedIds,
  onSelectionChange,
  onRowClick,
  sortKey,
  sortDir,
  onSort,
  emptyState,
  rowHeight = "sm",
  className,
}: DataTableProps<T>) {
  const allRows = rows ?? groups?.flatMap((g) => g.rows) ?? [];
  const allIds = allRows.map(getRowId);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds?.has(id));
  const someSelected = !allSelected && allIds.some((id) => selectedIds?.has(id));

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(allIds));
  }

  function toggleRow(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  }

  function renderRows(rowList: T[], groupKey?: string) {
    return rowList.map((row, idx) => {
      const id = getRowId(row);
      const isSelected = selectedIds?.has(id) ?? false;
      return (
        <tr
          key={`${groupKey ?? "r"}-${id}`}
          className={cn(
            "group border-b border-border last:border-0 transition-colors",
            isSelected ? "bg-accent-subtle" : "hover:bg-surface-hover",
            onRowClick && "cursor-pointer"
          )}
          onClick={() => onRowClick?.(row)}
        >
          {selectable && (
            <td
              className="pl-3 pr-1 w-[32px]"
              onClick={(e) => { e.stopPropagation(); toggleRow(id); }}
            >
              <div className="opacity-0 group-hover:opacity-100 data-[checked]:opacity-100">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleRow(id)}
                  aria-label="Sélectionner la ligne"
                  data-checked={isSelected || undefined}
                />
              </div>
            </td>
          )}
          {columns.map((col) => (
            <td
              key={String(col.key)}
              className={cn(
                ROW_HEIGHT[rowHeight],
                "px-3 text-[13px] text-foreground align-middle whitespace-nowrap overflow-hidden text-ellipsis",
                col.align === "right" && "text-right",
                col.align === "center" && "text-center"
              )}
              style={{ width: col.width, minWidth: col.minWidth }}
            >
              {col.cell(row, idx)}
            </td>
          ))}
        </tr>
      );
    });
  }

  return (
    <div className={cn("w-full overflow-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border bg-background-subtle">
            {selectable && (
              <th className="pl-3 pr-1 w-[32px]">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => { if (el) (el as HTMLButtonElement).dataset.state = someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"; }}
                  onCheckedChange={toggleAll}
                  aria-label="Tout sélectionner"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  "h-[30px] px-3 text-[11px] font-medium text-foreground-muted text-left align-middle whitespace-nowrap",
                  col.sortable && "cursor-pointer hover:text-foreground select-none",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center"
                )}
                style={{ width: col.width, minWidth: col.minWidth }}
                onClick={() => col.sortable && onSort?.(String(col.key))}
              >
                <span className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <span className="text-foreground-subtle">
                      {sortKey === String(col.key) ? (
                        sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups
            ? groups.map((group) => (
                <React.Fragment key={group.key}>
                  <tr className="border-b border-border bg-background-muted">
                    <td
                      colSpan={columns.length + (selectable ? 1 : 0)}
                      className="px-3 h-[26px] text-[11px] font-semibold text-foreground-muted uppercase tracking-wider"
                    >
                      {group.label}
                      <span className="ml-1.5 font-normal text-foreground-subtle">{group.rows.length}</span>
                    </td>
                  </tr>
                  {renderRows(group.rows, group.key)}
                </React.Fragment>
              ))
            : rows && rows.length > 0
            ? renderRows(rows)
            : (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="py-12 text-center text-[13px] text-foreground-muted"
                >
                  {emptyState ?? "Aucune donnée"}
                </td>
              </tr>
            )}
        </tbody>
      </table>
    </div>
  );
}
