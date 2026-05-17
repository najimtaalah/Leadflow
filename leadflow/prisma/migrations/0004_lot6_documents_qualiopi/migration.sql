-- Lot 6 — Documents & Module Qualiopi visuel

-- New enums
CREATE TYPE "TypeDocument" AS ENUM (
  'convocation_formation',
  'contrat_formation',
  'emargement',
  'attestation_formation',
  'certificat',
  'facture',
  'convocation_examen_theo',
  'convocation_examen_prat'
);

CREATE TYPE "SourceTypeDocument" AS ENUM (
  'session_cours',
  'session_edof',
  'session_examen_theo',
  'session_examen_prat',
  'dossier'
);

CREATE TYPE "StatutDocument" AS ENUM (
  'non_genere',
  'en_attente',
  'genere',
  'signe',
  'bloque'
);

CREATE TYPE "QualiopiCouleur" AS ENUM ('vert', 'orange', 'rouge', 'gris');

CREATE TYPE "QualiopiDeclencheurType" AS ENUM (
  'document',
  'session',
  'champ',
  'audit',
  'manuel'
);

-- New fields on dossiers
ALTER TABLE "dossiers"
  ADD COLUMN "objectif_formation"          TEXT,
  ADD COLUMN "evaluation_pre_formation"    TEXT,
  ADD COLUMN "evaluation_pre_formation_at" TIMESTAMPTZ;

-- Table documents_dossier
CREATE TABLE "documents_dossier" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "dossier_id"    TEXT        NOT NULL,
  "type_document" "TypeDocument"     NOT NULL,
  "source_type"   "SourceTypeDocument" NOT NULL,
  "source_id"     TEXT,
  "statut"        "StatutDocument"   NOT NULL DEFAULT 'non_genere',
  "url_fichier"   TEXT,
  "genere_at"     TIMESTAMPTZ,
  "genere_par_id" TEXT,
  "signe_at"      TIMESTAMPTZ,
  "signe_par_id"  TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "documents_dossier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documents_dossier_dossier_id_fkey"
    FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE,
  CONSTRAINT "documents_dossier_genere_par_id_fkey"
    FOREIGN KEY ("genere_par_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "documents_dossier_signe_par_id_fkey"
    FOREIGN KEY ("signe_par_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "documents_dossier_dossier_id_type_document_key"
  ON "documents_dossier"("dossier_id", "type_document");

CREATE INDEX "documents_dossier_dossier_id_idx" ON "documents_dossier"("dossier_id");

-- Table qualiopi_historique
CREATE TABLE "qualiopi_historique" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "dossier_id"       TEXT        NOT NULL,
  "critere_num"      INTEGER     NOT NULL,
  "statut_avant"     "QualiopiCouleur"         NOT NULL,
  "statut_apres"     "QualiopiCouleur"         NOT NULL,
  "declencheur_type" "QualiopiDeclencheurType" NOT NULL,
  "declencheur_id"   TEXT,
  "acteur_id"        TEXT,
  "note"             TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "qualiopi_historique_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "qualiopi_historique_dossier_id_fkey"
    FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE,
  CONSTRAINT "qualiopi_historique_acteur_id_fkey"
    FOREIGN KEY ("acteur_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "qualiopi_historique_dossier_id_idx"
  ON "qualiopi_historique"("dossier_id");
CREATE INDEX "qualiopi_historique_dossier_id_critere_num_idx"
  ON "qualiopi_historique"("dossier_id", "critere_num");
