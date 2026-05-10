"use client";

import * as React from "react";
import {
  Users, BookOpen, Building2, LayoutDashboard, Settings,
  BarChart2, Plus, Filter, Search, Edit2, Trash2, Eye,
  CheckCircle2, Clock, AlertCircle, XCircle, Download,
  FileText, Bell, Star, ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CollapsibleSection } from "@/components/ds/collapsible-section";
import { Sidebar } from "@/components/ds/sidebar";
import { AppLayout, PageHeader, PageContent } from "@/components/ds/app-layout";
import { DataTable } from "@/components/ds/data-table";
import { HoverActions } from "@/components/ds/hover-actions";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerCloseButton } from "@/components/ds/drawer";
import { CommandPalette, useCommandPalette } from "@/components/ds/command-palette";
import { ThemeToggle } from "@/components/ds/theme-toggle";
import { toast } from "@/lib/use-toast";
import type { Column } from "@/components/ds/data-table";

/* ---- Sample data ---- */
interface Learner {
  id: string;
  name: string;
  email: string;
  company: string;
  status: "active" | "pending" | "completed" | "cancelled";
  progress: number;
  session: string;
}

const LEARNERS: Learner[] = [
  { id: "1", name: "Sophie Martin", email: "s.martin@example.com", company: "TechCorp", status: "active", progress: 72, session: "Dev React 2025" },
  { id: "2", name: "Lucas Bernard", email: "l.bernard@example.com", company: "StartupXYZ", status: "pending", progress: 0, session: "Dev React 2025" },
  { id: "3", name: "Emma Dubois", email: "e.dubois@example.com", company: "DigitalCo", status: "completed", progress: 100, session: "Python Data" },
  { id: "4", name: "Hugo Leroy", email: "h.leroy@example.com", company: "TechCorp", status: "active", progress: 45, session: "Python Data" },
  { id: "5", name: "Léa Moreau", email: "l.moreau@example.com", company: "MegaInc", status: "cancelled", progress: 12, session: "UX Design 2025" },
  { id: "6", name: "Tom Petit", email: "t.petit@example.com", company: "StartupXYZ", status: "active", progress: 88, session: "Dev React 2025" },
];

const STATUS_LABELS: Record<Learner["status"], string> = {
  active: "Actif",
  pending: "En attente",
  completed: "Terminé",
  cancelled: "Annulé",
};

const STATUS_VARIANT: Record<Learner["status"], "blue" | "orange" | "green" | "red"> = {
  active: "blue",
  pending: "orange",
  completed: "green",
  cancelled: "red",
};

const SIDEBAR_SECTIONS = [
  {
    items: [
      { id: "dashboard", label: "Tableau de bord", href: "/design-system", icon: LayoutDashboard, count: undefined },
      { id: "learners", label: "Apprenants", href: "/design-system", icon: Users, count: 24 },
      { id: "sessions", label: "Sessions", href: "/design-system", icon: BookOpen, count: 6 },
      { id: "companies", label: "Entreprises", href: "/design-system", icon: Building2, count: 8 },
    ],
  },
  {
    title: "Rapports",
    items: [
      { id: "analytics", label: "Analytiques", href: "/design-system", icon: BarChart2 },
      { id: "documents", label: "Documents", href: "/design-system", icon: FileText },
    ],
  },
  {
    title: "Système",
    items: [
      { id: "settings", label: "Paramètres", href: "/design-system", icon: Settings },
    ],
  },
];

const COMMAND_ACTIONS = [
  { id: "new-learner", label: "Nouvel apprenant", icon: Plus, group: "Créer", shortcut: "⌘N", onSelect: () => {} },
  { id: "new-session", label: "Nouvelle session", icon: Plus, group: "Créer", shortcut: "⌘⇧N", onSelect: () => {} },
  { id: "go-learners", label: "Apprenants", icon: Users, group: "Navigation", shortcut: "GL", onSelect: () => {} },
  { id: "go-sessions", label: "Sessions", icon: BookOpen, group: "Navigation", shortcut: "GS", onSelect: () => {} },
  { id: "go-analytics", label: "Analytiques", icon: BarChart2, group: "Navigation", onSelect: () => {} },
  { id: "export", label: "Exporter les données", icon: Download, group: "Actions", onSelect: () => {} },
];

export default function DesignSystemPage() {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const [inputError, setInputError] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState("colors");

  const columns: Column<Learner>[] = [
    {
      key: "name",
      header: "Nom",
      width: "200px",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] rounded-full bg-accent-subtle text-accent flex items-center justify-center text-[10px] font-semibold shrink-0">
            {row.name[0]}
          </div>
          <span className="font-medium text-foreground">{row.name}</span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      width: "200px",
      cell: (row) => <span className="text-foreground-muted">{row.email}</span>,
    },
    {
      key: "company",
      header: "Entreprise",
      width: "140px",
      cell: (row) => <span>{row.company}</span>,
    },
    {
      key: "session",
      header: "Session",
      width: "160px",
      cell: (row) => <span className="text-foreground-muted">{row.session}</span>,
    },
    {
      key: "status",
      header: "Statut",
      width: "110px",
      cell: (row) => (
        <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: "progress",
      header: "Progression",
      width: "160px",
      cell: (row) => <Progress value={row.progress} showLabel />,
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      cell: (row) => (
        <HoverActions
          actions={[
            { id: "view", icon: Eye, label: "Voir", onClick: (e) => { e.stopPropagation(); toast({ title: `Vue de ${row.name}` }); } },
            { id: "edit", icon: Edit2, label: "Modifier", onClick: (e) => { e.stopPropagation(); setDrawerOpen(true); } },
            { id: "delete", icon: Trash2, label: "Supprimer", variant: "destructive", onClick: (e) => { e.stopPropagation(); toast({ variant: "destructive", title: "Suppression", description: `${row.name} a été supprimé(e)` }); } },
          ]}
        />
      ),
    },
  ];

  const GROUPS = [
    {
      key: "active",
      label: <><CheckCircle2 className="inline h-3 w-3 mr-1 text-status-green" />Actifs</>,
      rows: LEARNERS.filter((r) => r.status === "active"),
    },
    {
      key: "pending",
      label: <><Clock className="inline h-3 w-3 mr-1 text-status-orange" />En attente</>,
      rows: LEARNERS.filter((r) => r.status === "pending"),
    },
    {
      key: "done",
      label: <><Star className="inline h-3 w-3 mr-1 text-status-blue" />Terminés & Annulés</>,
      rows: LEARNERS.filter((r) => r.status === "completed" || r.status === "cancelled"),
    },
  ];

  const navItems = [
    { id: "colors", label: "Couleurs" },
    { id: "typography", label: "Typographie" },
    { id: "components", label: "Composants" },
    { id: "layout", label: "Layout" },
    { id: "data", label: "Tables" },
  ];

  return (
    <>
      <AppLayout
        sidebar={
          <Sidebar
            sections={SIDEBAR_SECTIONS}
            activeId="learners"
            logo={
              <div className="flex items-center gap-2">
                <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center">
                  <Users className="h-3 w-3 text-accent-foreground" />
                </div>
                <span className="text-[13px] font-semibold text-foreground">LeadFlow</span>
              </div>
            }
          />
        }
      >
        <PageHeader
          title="Design System"
          description="LeadFlow — Density Pro"
          actions={
            <>
              <Button variant="ghost" size="icon-sm" onClick={() => setCmdOpen(true)} title="Palette de commandes (⌘K)">
                <Search className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" title="Notifications">
                <Bell className="h-3.5 w-3.5" />
              </Button>
              <ThemeToggle />
              <Separator orientation="vertical" className="h-[18px]" />
              <Button size="sm" onClick={() => setDrawerOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nouveau
              </Button>
            </>
          }
          tabs={
            <div className="px-4 flex items-center gap-0 border-t border-border">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={[
                    "h-[34px] px-3 text-[13px] font-medium cursor-pointer border-b-2 -mb-px transition-colors",
                    activeSection === item.id
                      ? "text-foreground border-accent"
                      : "text-foreground-muted border-transparent hover:text-foreground",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        />
        <PageContent className="overflow-auto">
          {/* ---- COLORS ---- */}
          {activeSection === "colors" && (
            <div className="p-6 space-y-6">
              <Section title="Tokens de couleur">
                <div className="grid grid-cols-2 gap-4">
                  <ColorGroup title="Surfaces" swatches={[
                    { name: "background", var: "--background" },
                    { name: "background-subtle", var: "--background-subtle" },
                    { name: "background-muted", var: "--background-muted" },
                    { name: "surface", var: "--surface" },
                    { name: "surface-hover", var: "--surface-hover" },
                    { name: "surface-active", var: "--surface-active" },
                  ]} />
                  <ColorGroup title="Texte" swatches={[
                    { name: "foreground", var: "--foreground" },
                    { name: "foreground-muted", var: "--foreground-muted" },
                    { name: "foreground-subtle", var: "--foreground-subtle" },
                    { name: "foreground-disabled", var: "--foreground-disabled" },
                  ]} />
                  <ColorGroup title="Accents" swatches={[
                    { name: "accent", var: "--accent" },
                    { name: "accent-hover", var: "--accent-hover" },
                    { name: "accent-subtle", var: "--accent-subtle" },
                  ]} />
                  <ColorGroup title="Statuts" swatches={[
                    { name: "status-gray", var: "--status-gray-bg", label: "Gris" },
                    { name: "status-blue", var: "--status-blue-bg", label: "Bleu" },
                    { name: "status-orange", var: "--status-orange-bg", label: "Orange" },
                    { name: "status-green", var: "--status-green-bg", label: "Vert" },
                    { name: "status-red", var: "--status-red-bg", label: "Rouge" },
                  ]} />
                </div>
              </Section>
              <Section title="Badges de statut">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="gray"><AlertCircle className="h-2.5 w-2.5" /> En attente</Badge>
                  <Badge variant="blue"><Clock className="h-2.5 w-2.5" /> En cours</Badge>
                  <Badge variant="orange"><AlertCircle className="h-2.5 w-2.5" /> À valider</Badge>
                  <Badge variant="green"><CheckCircle2 className="h-2.5 w-2.5" /> Terminé</Badge>
                  <Badge variant="red"><XCircle className="h-2.5 w-2.5" /> Annulé</Badge>
                  <Badge variant="outline">Brouillon</Badge>
                </div>
              </Section>
            </div>
          )}

          {/* ---- TYPOGRAPHY ---- */}
          {activeSection === "typography" && (
            <div className="p-6 space-y-6">
              <Section title="Échelle typographique">
                <div className="space-y-3">
                  {[
                    { size: "11px", label: "xs — labels, meta", cls: "text-[11px]" },
                    { size: "12px", label: "sm — helper text, timestamps", cls: "text-[12px]" },
                    { size: "13px", label: "base — corps principal", cls: "text-[13px]" },
                    { size: "14px", label: "md — titres de section", cls: "text-[14px] font-semibold" },
                    { size: "15px", label: "lg — titres de page", cls: "text-[15px] font-semibold" },
                    { size: "17px", label: "xl — headings", cls: "text-[17px] font-bold" },
                    { size: "20px", label: "2xl — display", cls: "text-[20px] font-bold" },
                  ].map((t) => (
                    <div key={t.size} className="flex items-baseline gap-4 py-1.5 border-b border-border last:border-0">
                      <span className="text-[11px] text-foreground-subtle w-[40px] shrink-0">{t.size}</span>
                      <span className={t.cls}>Apprenants — Formation professionnelle Qualiopi</span>
                      <span className="text-[11px] text-foreground-subtle ml-auto">{t.label}</span>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Poids">
                <div className="flex flex-wrap gap-6">
                  {["font-normal", "font-medium", "font-semibold", "font-bold"].map((w) => (
                    <div key={w} className="space-y-0.5">
                      <p className={`text-[13px] ${w}`}>LeadFlow CRM</p>
                      <p className="text-[11px] text-foreground-subtle">{w}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ---- COMPONENTS ---- */}
          {activeSection === "components" && (
            <div className="p-6 space-y-6">
              <Section title="Boutons">
                <div className="flex flex-wrap gap-2 items-center">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                </div>
                <div className="flex flex-wrap gap-2 items-center mt-3">
                  <Button size="xs">XSmall</Button>
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="md">Medium</Button>
                  <Button size="icon"><Plus className="h-3.5 w-3.5" /></Button>
                  <Button disabled>Disabled</Button>
                </div>
              </Section>

              <Section title="Formulaires">
                <div className="grid grid-cols-2 gap-4 max-w-lg">
                  <div className="space-y-1">
                    <Label htmlFor="nom">Nom complet</Label>
                    <Input id="nom" placeholder="Sophie Martin" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="sophie@example.com" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="err">Champ en erreur</Label>
                    <Input id="err" value="invalide" error="Format d'email invalide" onChange={() => {}} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dis">Désactivé</Label>
                    <Input id="dis" disabled placeholder="Non modifiable" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-4">
                  {["Inscription confirmée", "Évaluations reçues", "Convention signée"].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <Checkbox id={label} />
                      <Label htmlFor={label}>{label}</Label>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Progress bar (complétude dossier)">
                <div className="space-y-3 max-w-sm">
                  {[
                    { label: "Sophie Martin", value: 100 },
                    { label: "Lucas Bernard", value: 72 },
                    { label: "Emma Dubois", value: 45 },
                    { label: "Hugo Leroy", value: 12 },
                  ].map((item) => (
                    <div key={item.label} className="space-y-0.5">
                      <p className="text-[12px] text-foreground-muted">{item.label}</p>
                      <Progress value={item.value} showLabel />
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Tabs">
                <Tabs defaultValue="infos">
                  <TabsList>
                    <TabsTrigger value="infos">Informations</TabsTrigger>
                    <TabsTrigger value="formations">Formations</TabsTrigger>
                    <TabsTrigger value="docs">Documents</TabsTrigger>
                    <TabsTrigger value="eval">Évaluations</TabsTrigger>
                  </TabsList>
                  <TabsContent value="infos">
                    <p className="text-[13px] text-foreground-muted">Fiche apprenant — informations personnelles et contact.</p>
                  </TabsContent>
                  <TabsContent value="formations">
                    <p className="text-[13px] text-foreground-muted">Historique des formations et sessions.</p>
                  </TabsContent>
                  <TabsContent value="docs">
                    <p className="text-[13px] text-foreground-muted">Conventions, attestations, feuilles d'émargement.</p>
                  </TabsContent>
                  <TabsContent value="eval">
                    <p className="text-[13px] text-foreground-muted">Évaluations et questionnaires de satisfaction.</p>
                  </TabsContent>
                </Tabs>
              </Section>

              <Section title="Sections collapsibles">
                <div className="border border-border rounded-[6px] overflow-hidden divide-y divide-border max-w-md">
                  <div className="p-3">
                    <CollapsibleSection title="Informations personnelles" defaultOpen>
                      <div className="py-2 space-y-1.5">
                        <DataRow label="Email" value="sophie@example.com" />
                        <DataRow label="Téléphone" value="+33 6 12 34 56 78" />
                        <DataRow label="Entreprise" value="TechCorp" />
                      </div>
                    </CollapsibleSection>
                  </div>
                  <div className="p-3">
                    <CollapsibleSection title="Accessibilité" defaultOpen={false}>
                      <div className="py-2 space-y-1.5">
                        <DataRow label="Mobilité réduite" value="Non" />
                        <DataRow label="Déficience auditive" value="Non" />
                      </div>
                    </CollapsibleSection>
                  </div>
                </div>
              </Section>

              <Section title="Toasts">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => toast({ title: "Enregistrement réussi", description: "Les modifications ont été sauvegardées." })}>
                    Toast default
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast({ variant: "success", title: "Apprenant inscrit", description: "Sophie Martin a été ajoutée à la session." })}>
                    Toast succès
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer ce dossier." })}>
                    Toast erreur
                  </Button>
                </div>
              </Section>

              <Section title="Command Palette (⌘K)">
                <Button variant="outline" size="sm" onClick={() => setCmdOpen(true)}>
                  <Search className="h-3.5 w-3.5" />
                  Ouvrir la palette (⌘K)
                </Button>
              </Section>

              <Section title="Drawer">
                <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
                  Ouvrir le drawer
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Section>
            </div>
          )}

          {/* ---- LAYOUT ---- */}
          {activeSection === "layout" && (
            <div className="p-6 space-y-6">
              <Section title="Spacing (density)">
                <div className="space-y-2">
                  {[
                    { label: "row-xs", size: "28px", cls: "h-[28px]" },
                    { label: "row-sm", size: "32px", cls: "h-[32px]" },
                    { label: "row-md", size: "36px", cls: "h-[36px]" },
                    { label: "row-lg", size: "40px", cls: "h-[40px]" },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-[11px] text-foreground-subtle w-[70px]">{r.label}</span>
                      <div className={`${r.cls} bg-accent-subtle border border-accent/30 rounded-[3px] w-[200px] flex items-center px-2`}>
                        <span className="text-[11px] text-accent">{r.size}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Radius">
                <div className="flex flex-wrap gap-4">
                  {[
                    { label: "xs — 3px", cls: "rounded-[3px]" },
                    { label: "sm — 4px", cls: "rounded-[4px]" },
                    { label: "base — 5px", cls: "rounded-[5px]" },
                    { label: "md — 6px", cls: "rounded-[6px]" },
                    { label: "lg — 8px", cls: "rounded-[8px]" },
                    { label: "xl — 12px", cls: "rounded-[12px]" },
                    { label: "full — pill", cls: "rounded-full" },
                  ].map((r) => (
                    <div key={r.label} className="flex flex-col items-center gap-1">
                      <div className={`w-[48px] h-[48px] bg-accent-subtle border-2 border-accent/40 ${r.cls}`} />
                      <span className="text-[10px] text-foreground-subtle">{r.label}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ---- DATA TABLES ---- */}
          {activeSection === "data" && (
            <div className="space-y-0">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
                <div className="flex items-center gap-2">
                  <Input placeholder="Rechercher un apprenant..." className="w-[220px]" />
                  <Button variant="outline" size="sm">
                    <Filter className="h-3.5 w-3.5" />
                    Filtres
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <span className="text-[12px] text-foreground-muted">{selectedIds.size} sélectionné(s)</span>
                  )}
                  <Button size="sm" onClick={() => setDrawerOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Apprenant
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="flat">
                <div className="px-4 border-b border-border">
                  <TabsList className="border-0 h-auto py-0">
                    <TabsTrigger value="flat">Vue liste</TabsTrigger>
                    <TabsTrigger value="grouped">Vue groupée</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="flat" className="pt-0">
                  <DataTable
                    columns={columns}
                    rows={LEARNERS}
                    getRowId={(r) => r.id}
                    selectable
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onRowClick={() => setDrawerOpen(true)}
                    rowHeight="sm"
                  />
                </TabsContent>
                <TabsContent value="grouped" className="pt-0">
                  <DataTable
                    columns={columns}
                    groups={GROUPS}
                    getRowId={(r) => r.id}
                    selectable
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onRowClick={() => setDrawerOpen(true)}
                    rowHeight="sm"
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </PageContent>
      </AppLayout>

      {/* Drawer — fiche apprenant */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <div>
              <DrawerTitle>Sophie Martin</DrawerTitle>
              <DrawerDescription>s.martin@example.com · TechCorp</DrawerDescription>
            </div>
            <DrawerCloseButton />
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <Tabs defaultValue="infos">
              <TabsList>
                <TabsTrigger value="infos">Infos</TabsTrigger>
                <TabsTrigger value="formations">Formations</TabsTrigger>
                <TabsTrigger value="docs">Documents</TabsTrigger>
              </TabsList>
              <TabsContent value="infos" className="space-y-4">
                <CollapsibleSection title="Informations personnelles" defaultOpen>
                  <div className="space-y-3 pt-1">
                    <FormField label="Prénom" defaultValue="Sophie" />
                    <FormField label="Nom" defaultValue="Martin" />
                    <FormField label="Email" defaultValue="s.martin@example.com" type="email" />
                    <FormField label="Téléphone" defaultValue="+33 6 12 34 56 78" type="tel" />
                  </div>
                </CollapsibleSection>
                <CollapsibleSection title="Accessibilité" defaultOpen={false}>
                  <div className="space-y-2 pt-2">
                    {["Mobilité réduite", "Déficience visuelle", "Déficience auditive"].map((label) => (
                      <div key={label} className="flex items-center gap-2">
                        <Checkbox id={`acc-${label}`} />
                        <Label htmlFor={`acc-${label}`}>{label}</Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
                <div className="space-y-1">
                  <p className="text-[12px] font-medium text-foreground-muted uppercase tracking-wider">Complétude du dossier</p>
                  <Progress value={72} showLabel />
                </div>
              </TabsContent>
              <TabsContent value="formations">
                <p className="text-[13px] text-foreground-muted">Session : Dev React 2025 — <Badge variant="blue">Actif</Badge></p>
              </TabsContent>
              <TabsContent value="docs">
                <p className="text-[13px] text-foreground-muted">Convention, attestation, feuille d'émargement.</p>
              </TabsContent>
            </Tabs>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={() => { setDrawerOpen(false); toast({ variant: "success", title: "Enregistré", description: "Le dossier apprenant a été mis à jour." }); }}>
              Enregistrer
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Command palette */}
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        actions={COMMAND_ACTIONS}
      />
    </>
  );
}

/* ---- Local helper components ---- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function ColorGroup({ title, swatches }: { title: string; swatches: { name: string; var: string; label?: string }[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-foreground-muted">{title}</p>
      <div className="space-y-1">
        {swatches.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <div className="w-[28px] h-[16px] rounded-[3px] border border-border shrink-0" style={{ backgroundColor: `var(${s.var})` }} />
            <span className="text-[11px] font-mono text-foreground-muted">{s.label ?? s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-foreground-muted w-[120px] shrink-0">{label}</span>
      <span className="text-[13px] text-foreground">{value}</span>
    </div>
  );
}

function FormField({ label, defaultValue, type = "text" }: { label: string; defaultValue: string; type?: string }) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}
