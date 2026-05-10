export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('commercial','closer_habilite','gestionnaire','admin','super_admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  commercial_id TEXT NOT NULL REFERENCES users(id),
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('formulaire_web','telephone','recommandation','autre')),
  formation_visee TEXT,
  statut TEXT NOT NULL DEFAULT 'nouveau' CHECK(statut IN ('nouveau','qualifie','en_cours','gagne','perdu')),
  badge_pre_dossier INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  date_creation TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_commercial ON leads(commercial_id);
CREATE INDEX IF NOT EXISTS idx_leads_statut ON leads(statut);
CREATE INDEX IF NOT EXISTS idx_leads_date ON leads(date_creation);

CREATE TABLE IF NOT EXISTS relances (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  commercial_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('appel','email','rdv','autre')),
  date_prevue TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'a_faire' CHECK(statut IN ('a_faire','en_retard','faite')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_relances_lead ON relances(lead_id);
CREATE INDEX IF NOT EXISTS idx_relances_commercial ON relances(commercial_id);
CREATE INDEX IF NOT EXISTS idx_relances_date ON relances(date_prevue);

CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) UNIQUE,
  commercial_id TEXT NOT NULL REFERENCES users(id),
  montant REAL,
  statut TEXT NOT NULL DEFAULT 'libre' CHECK(statut IN ('libre','figee')),
  date_figement TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commissions_commercial ON commissions(commercial_id);

CREATE TABLE IF NOT EXISTS timeline_activites (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  type TEXT NOT NULL CHECK(type IN ('appel','message','rdv','relance','note','changement_statut','pre_dossier_ouvert')),
  description TEXT,
  auteur_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timeline_lead ON timeline_activites(lead_id);

CREATE TABLE IF NOT EXISTS apprenants (
  id TEXT PRIMARY KEY,
  id_lead_origine TEXT REFERENCES leads(id),
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  date_naissance TEXT NOT NULL,
  lieu_naissance TEXT,
  nationalite TEXT,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  statut TEXT NOT NULL DEFAULT 'pre_actif' CHECK(statut IN ('pre_actif','actif')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_apprenants_lead ON apprenants(id_lead_origine);

CREATE TABLE IF NOT EXISTS dossiers (
  id TEXT PRIMARY KEY,
  id_apprenant TEXT NOT NULL REFERENCES apprenants(id),
  id_lead_origine TEXT REFERENCES leads(id),
  formation_type TEXT NOT NULL CHECK(formation_type IN ('vtc','taxi','vmdtr','passerelle_vtc_taxi','passerelle_taxi_vtc')),
  formule TEXT NOT NULL CHECK(formule IN ('standard','accelere','illimite','week_end','mixte')),
  numero_cma TEXT,
  type_financement TEXT CHECK(type_financement IN ('cpf','france_travail','opco','personnel','autre')),
  reference_financeur TEXT,
  montant_vendu REAL,
  apport_personnel REAL,
  montant_prise_en_charge REAL,
  commercial_id TEXT REFERENCES users(id),
  gestionnaire_id TEXT REFERENCES users(id),
  statut TEXT NOT NULL DEFAULT 'pre_dossier' CHECK(statut IN ('pre_dossier','en_cours','valide','non_planifie','planifie','annule')),
  statut_bloc_admin TEXT NOT NULL DEFAULT 'non_demarre' CHECK(statut_bloc_admin IN ('non_demarre','en_cours','soumis','valide','rejete')),
  statut_bloc_financier TEXT NOT NULL DEFAULT 'non_demarre' CHECK(statut_bloc_financier IN ('non_demarre','en_cours','soumis','valide','rejete')),
  notes TEXT,
  notes_financier TEXT,
  date_creation TEXT NOT NULL DEFAULT (datetime('now')),
  date_activation TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dossiers_apprenant ON dossiers(id_apprenant);
CREATE INDEX IF NOT EXISTS idx_dossiers_lead ON dossiers(id_lead_origine);
CREATE INDEX IF NOT EXISTS idx_dossiers_statut ON dossiers(statut);

CREATE TABLE IF NOT EXISTS pieces_justificatives (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL REFERENCES dossiers(id),
  type_piece TEXT NOT NULL,
  fichier_nom TEXT,
  fichier_path TEXT,
  date_depot TEXT,
  statut TEXT NOT NULL DEFAULT 'a_fournir' CHECK(statut IN ('a_fournir','fournie','rejetee','validee')),
  motif_rejet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pieces_dossier ON pieces_justificatives(dossier_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  dossier_id TEXT REFERENCES dossiers(id),
  lead_id TEXT REFERENCES leads(id),
  type_action TEXT NOT NULL,
  detail TEXT,
  auteur_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_dossier ON audit_log(dossier_id);
CREATE INDEX IF NOT EXISTS idx_audit_lead ON audit_log(lead_id);
`;
