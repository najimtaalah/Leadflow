"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, RefreshCw, X, ChevronDown, Check,
  ExternalLink, Phone, MessageSquare, Mail,
  StickyNote, UserPlus, Settings2, MoreHorizontal,
  Trash2, Download, Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { LeadWithRelations, User } from "@/lib/db/types";
import { formatDate, LEAD_STATUT_LABELS, LEAD_STATUT_VARIANT, SOURCE_LABELS } from "@/lib/format";

interface Filters {
  statut: string[];
  commercial: string;
  source: string[];
  pre_dossier: boolean;
  en_retard: boolean;
  sort: string;
  dir: "asc" | "desc";
}

interface Props {
  leads: LeadWithRelations[];
  currentUser: User;
  commercials: User[];
  currentFilters: Filters;
}

const STATUTS = ["nouveau", "qualifie", "en_cours", "gagne", "perdu"];
const SOURCES = ["formulaire_web", "telephone", "recommandation", "autre"];

const SOURCE_DOT: Record<string, string> = {
  formulaire_web: "bg-status-blue",
  telephone: "bg-status-green",
  recommandation: "bg-status-orange",
  autre: "bg-status-gray",
};

function isNewLead(dateCreation: string): boolean {
  return Date.now() - new Date(dateCreation).getTime() < 24 * 60 * 60 * 1000;
}

function initials(prenom: string, nom: string): string {
  return `${(prenom[0] ?? "?").toUpperCase()}${(nom[0] ?? "?").toUpperCase()}`;
}

function leadRef(index: number): string {
  return `#${String(index + 1).padStart(4, "0")}`;
}

export function LeadsListClient({ leads, currentUser, commercials, currentFilters }: Props) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState(currentFilters);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const isManager = ["gestionnaire", "admin", "super_admin"].includes(currentUser.role);

  function pushFilters(f: Filters) {
    const p = new URLSearchParams();
    for (const s of f.statut) p.append("statut", s);
    for (const s of f.source) p.append("source", s);
    if (f.commercial) p.set("commercial", f.commercial);
    if (f.pre_dossier) p.set("pre_dossier", "1");
    if (f.en_retard) p.set("en_retard", "1");
    if (f.sort !== "l.date_creation") p.set("sort", f.sort);
    if (f.dir !== "desc") p.set("dir", f.dir);
    router.push(`/leads?${p.toString()}`);
  }

  function removeFilter(type: "statut" | "source" | "commercial", value?: string) {
    const f = { ...filters };
    if (type === "statut" && value) f.statut = f.statut.filter((x) => x !== value);
    if (type === "source" && value) f.source = f.source.filter((x) => x !== value);
    if (type === "commercial") f.commercial = "";
    setFilters(f);
    pushFilters(f);
  }

  function resetFilters() {
    const f: Filters = { statut: [], commercial: "", source: [], pre_dossier: false, en_retard: false, sort: "l.date_creation", dir: "desc" };
    setFilters(f);
    router.push("/leads");
  }

  function toggleRow(id: string) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }

  const filtered = React.useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        `${l.prenom} ${l.nom}`.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.telephone ?? "").includes(q)
    );
  }, [leads, search]);

  const allSelected = filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id));
  const someSelected = !allSelected && filtered.some((l) => selectedIds.has(l.id));

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((l) => l.id)));
  }

  const hasActiveFilters =
    filters.statut.length > 0 || filters.source.length > 0 || filters.commercial || filters.pre_dossier || filters.en_retard;

  const commercialName = (id: string) => {
    const c = commercials.find((x) => x.id === id);
    return c ? `${c.prenom} ${c.nom}` : id;
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface shrink-0 flex-wrap">
        {/* Search */}
        <div className="relative w-[260px] shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-subtle pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un lead…"
            className="h-[28px] w-full pl-8 pr-3 text-[12px] rounded-[5px] border border-border bg-background text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Active filter chips + filter pickers */}
        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
          {filters.statut.map((s) => (
            <ActiveChip key={`st-${s}`} label={LEAD_STATUT_LABELS[s] ?? s} onRemove={() => removeFilter("statut", s)} />
          ))}
          {filters.source.map((s) => (
            <ActiveChip key={`src-${s}`} label={SOURCE_LABELS[s] ?? s} onRemove={() => removeFilter("source", s)} />
          ))}
          {filters.commercial && (
            <ActiveChip label={commercialName(filters.commercial)} onRemove={() => removeFilter("commercial")} />
          )}

          <FilterDropdown
            label="Statut"
            items={STATUTS.map((s) => ({ value: s, label: LEAD_STATUT_LABELS[s] ?? s, active: filters.statut.includes(s) }))}
            onToggle={(s) => {
              const next = filters.statut.includes(s) ? filters.statut.filter((x) => x !== s) : [...filters.statut, s];
              const f = { ...filters, statut: next };
              setFilters(f);
              pushFilters(f);
            }}
          />
          <FilterDropdown
            label="Source"
            items={SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] ?? s, active: filters.source.includes(s) }))}
            onToggle={(s) => {
              const next = filters.source.includes(s) ? filters.source.filter((x) => x !== s) : [...filters.source, s];
              const f = { ...filters, source: next };
              setFilters(f);
              pushFilters(f);
            }}
          />
          {isManager && (
            <FilterDropdown
              label="Commercial"
              items={commercials.map((c) => ({ value: c.id, label: `${c.prenom} ${c.nom}`, active: filters.commercial === c.id }))}
              onToggle={(id) => {
                const f = { ...filters, commercial: filters.commercial === id ? "" : id };
                setFilters(f);
                pushFilters(f);
              }}
            />
          )}

          {hasActiveFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-foreground-muted hover:text-foreground transition-colors">
              <X className="h-3 w-3" />
              Réinitialiser
            </button>
          )}
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" className="text-foreground-muted gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[12px]">Sync Meta</span>
          </Button>
          <Button variant="default" size="sm">
            <Plus className="h-3.5 w-3.5" />
            Nouveau lead
          </Button>
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-accent-subtle shrink-0">
          <span className="text-[12px] font-medium text-accent">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="w-px h-3.5 bg-border mx-0.5" />
          <Button variant="ghost" size="xs" className="gap-1">
            <UserPlus className="h-3 w-3" /> Assigner
          </Button>
          <Button variant="ghost" size="xs" className="gap-1">
            <Settings2 className="h-3 w-3" /> Statut
          </Button>
          <Button variant="ghost" size="xs" className="gap-1">
            <Download className="h-3 w-3" /> Exporter
          </Button>
          <Button variant="ghost" size="xs" className="gap-1">
            <Send className="h-3 w-3" /> Message
          </Button>
          <Button variant="ghost" size="xs" className="gap-1 hover:text-destructive hover:bg-status-red-bg">
            <Trash2 className="h-3 w-3" /> Supprimer
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-foreground-subtle hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-background-subtle">
              <th className="w-[40px] pl-3 pr-1">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement).dataset.state = someSelected
                        ? "indeterminate"
                        : allSelected
                        ? "checked"
                        : "unchecked";
                    }
                  }}
                  onCheckedChange={toggleAll}
                  aria-label="Tout sélectionner"
                />
              </th>
              <Th w="w-[68px]">Réf</Th>
              <Th>Lead</Th>
              <Th w="w-[130px]">Téléphone</Th>
              <Th w="w-[180px]">Email</Th>
              <Th w="w-[110px]">Source</Th>
              <Th w="w-[130px]">Statut</Th>
              {isManager && <Th w="w-[140px]">Commercial</Th>}
              <Th w="w-[90px]">Date</Th>
              {/* Actions column — always reserved to prevent layout shift */}
              <th className="w-[196px]" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8 + (isManager ? 1 : 0)} className="py-16 text-center text-[13px] text-foreground-muted">
                  Aucun lead ne correspond à vos filtres
                </td>
              </tr>
            ) : (
              filtered.map((lead, idx) => {
                const isSelected = selectedIds.has(lead.id);
                const isNew = isNewLead(lead.date_creation);
                const variant = LEAD_STATUT_VARIANT[lead.statut] as
                  | "gray" | "blue" | "orange" | "green" | "red" | "violet" | "outline" | null | undefined;

                return (
                  <tr
                    key={lead.id}
                    className={`group border-b border-border cursor-pointer transition-colors ${
                      isSelected ? "bg-accent-subtle/60 hover:bg-accent-subtle/80" : "hover:bg-surface-hover"
                    }`}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/leads/${lead.id}`)}
                    aria-label={`Lead ${lead.prenom} ${lead.nom}`}
                  >
                    {/* Checkbox */}
                    <td
                      className="w-[40px] pl-3 pr-1 h-[34px] align-middle"
                      onClick={(e) => { e.stopPropagation(); toggleRow(lead.id); }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(lead.id)}
                        aria-label={`Sélectionner ${lead.prenom} ${lead.nom}`}
                      />
                    </td>

                    {/* Réf */}
                    <td className="w-[68px] px-3 h-[34px] align-middle">
                      <span className="text-[11px] text-foreground-subtle tabular-nums font-mono">{leadRef(idx)}</span>
                    </td>

                    {/* Lead name + NEW badge */}
                    <td className="px-3 h-[34px] align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-medium text-foreground truncate">
                          {lead.prenom} {lead.nom}
                        </span>
                        {isNew && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0 text-[9px] font-bold rounded bg-status-blue text-white leading-[14px] tracking-widest uppercase">
                            NEW
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Téléphone */}
                    <td className="w-[130px] px-3 h-[34px] align-middle">
                      <span className="text-[12px] text-foreground tabular-nums">{lead.telephone || "—"}</span>
                    </td>

                    {/* Email */}
                    <td className="w-[180px] px-3 h-[34px] align-middle max-w-[180px]">
                      <span className="text-[12px] text-foreground-muted block truncate">{lead.email || "—"}</span>
                    </td>

                    {/* Source */}
                    <td className="w-[110px] px-3 h-[34px] align-middle">
                      <div className="flex items-center gap-1.5">
                        <span className={`shrink-0 inline-block w-1.5 h-1.5 rounded-full ${SOURCE_DOT[lead.source] ?? "bg-status-gray"}`} />
                        <span className="text-[12px] text-foreground-muted truncate">{SOURCE_LABELS[lead.source]}</span>
                      </div>
                    </td>

                    {/* Statut */}
                    <td className="w-[130px] px-3 h-[34px] align-middle">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={variant}>{LEAD_STATUT_LABELS[lead.statut] ?? lead.statut}</Badge>
                        {lead.badge_pre_dossier ? (
                          <Badge variant="outline" className="text-[10px] px-1">PD</Badge>
                        ) : null}
                      </div>
                    </td>

                    {/* Commercial */}
                    {isManager && (
                      <td className="w-[140px] px-3 h-[34px] align-middle">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent-subtle text-accent text-[9px] font-bold">
                            {initials(lead.commercial_prenom ?? "?", lead.commercial_nom ?? "?")}
                          </span>
                          <span className="text-[12px] text-foreground truncate">
                            {lead.commercial_prenom} {lead.commercial_nom}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Date */}
                    <td className="w-[90px] px-3 h-[34px] align-middle">
                      <span className="text-[12px] text-foreground-muted tabular-nums">{formatDate(lead.date_creation)}</span>
                    </td>

                    {/* Hover actions — fixed-width column, opacity transition */}
                    <td
                      className="w-[196px] px-2 h-[34px] align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-100"
                        role="group"
                        aria-label="Actions"
                      >
                        <HoverBtn
                          icon={ExternalLink}
                          label="Ouvrir la fiche"
                          onClick={() => router.push(`/leads/${lead.id}`)}
                        />
                        <HoverBtn
                          icon={Phone}
                          label="Appeler"
                          onClick={() => lead.telephone && window.open(`tel:${lead.telephone}`)}
                        />
                        <HoverBtn
                          icon={MessageSquare}
                          label="WhatsApp"
                          onClick={() =>
                            lead.telephone && window.open(`https://wa.me/${lead.telephone.replace(/\s/g, "")}`)
                          }
                        />
                        <HoverBtn
                          icon={Mail}
                          label="Envoyer un email"
                          onClick={() => lead.email && window.open(`mailto:${lead.email}`)}
                        />
                        <HoverBtn icon={StickyNote} label="Ajouter une note" onClick={() => {}} />
                        <HoverBtn icon={UserPlus} label="Assigner à un commercial" onClick={() => {}} />
                        <HoverBtn icon={Settings2} label="Changer le statut" onClick={() => {}} />
                        <HoverBtn icon={MoreHorizontal} label="Plus d'actions" onClick={() => {}} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function Th({ children, w }: { children?: React.ReactNode; w?: string }) {
  return (
    <th className={`h-[30px] px-3 text-[11px] font-medium text-foreground-muted text-left align-middle whitespace-nowrap ${w ?? ""}`}>
      {children}
    </th>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium bg-accent text-accent-foreground">
      {label}
      <button
        onClick={onRemove}
        className="flex items-center justify-center w-[14px] h-[14px] rounded-full hover:bg-white/20 transition-colors"
        aria-label={`Retirer le filtre ${label}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

interface DropdownItem {
  value: string;
  label: string;
  active: boolean;
}

function FilterDropdown({ label, items, onToggle }: { label: string; items: DropdownItem[]; onToggle: (v: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeCount = items.filter((i) => i.active).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-colors border border-dashed ${
          activeCount > 0
            ? "border-accent text-accent bg-accent-subtle"
            : "border-border text-foreground-muted hover:text-foreground hover:bg-surface-hover"
        }`}
      >
        {label}
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-accent text-white text-[9px] font-bold">
            {activeCount}
          </span>
        )}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] bg-surface border border-border rounded-[6px] shadow-lg py-0.5">
          {items.map((item) => (
            <button
              key={item.value}
              onClick={() => onToggle(item.value)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-surface-hover transition-colors text-left"
            >
              <span
                className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border shrink-0 ${
                  item.active ? "bg-accent border-accent" : "border-border"
                }`}
              >
                {item.active && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              <span className={item.active ? "text-accent font-medium" : "text-foreground"}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HoverBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-foreground-muted hover:text-foreground hover:bg-surface-active transition-colors focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
