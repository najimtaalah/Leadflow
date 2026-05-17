-- Lot 5 — Examens & Tentatives
-- FRA-177 / specs FRA-176

-- New enums
CREATE TYPE "TentativeStatut" AS ENUM ('en_cours', 'reussie', 'echouee');
CREATE TYPE "SaisieResultat" AS ENUM ('admis', 'refuse');
CREATE TYPE "StatutResultatExamen" AS ENUM ('planifie', 'passe', 'resultat_en_attente', 'reussi', 'echoue');
CREATE TYPE "SessionTypeExamen" AS ENUM ('theorique', 'pratique');
CREATE TYPE "StatutConvocationRequest" AS ENUM ('en_attente', 'traitee', 'annulee');
CREATE TYPE "StatutAttestationRequest" AS ENUM ('en_attente', 'traitee', 'annulee');

-- Extend SessionStatut with exam-specific statuses
ALTER TYPE "SessionStatut" ADD VALUE 'convocations_envoyees';
ALTER TYPE "SessionStatut" ADD VALUE 'resultats_saisis';

-- Add jury fields to exam session tables
ALTER TABLE "sessions_examens_theoriques"
  ADD COLUMN "jury_examinateur" TEXT,
  ADD COLUMN "jury_contact" TEXT;

ALTER TABLE "sessions_examens_pratiques"
  ADD COLUMN "jury_examinateur" TEXT,
  ADD COLUMN "jury_contact" TEXT;

-- Table tentatives
CREATE TABLE "tentatives" (
  "id"                            TEXT NOT NULL,
  "dossier_id"                    TEXT NOT NULL,
  "numero"                        INTEGER NOT NULL,
  "statut"                        "TentativeStatut" NOT NULL DEFAULT 'en_cours',
  "session_examen_theorique_id"   TEXT,
  "session_examen_pratique_id"    TEXT,
  "date_cloture"                  TIMESTAMPTZ,
  "created_at"                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "tentatives_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tentatives_dossier_numero_unique" UNIQUE ("dossier_id", "numero"),
  CONSTRAINT "tentatives_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tentatives_session_examen_theorique_id_fkey" FOREIGN KEY ("session_examen_theorique_id") REFERENCES "sessions_examens_theoriques"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "tentatives_session_examen_pratique_id_fkey" FOREIGN KEY ("session_examen_pratique_id") REFERENCES "sessions_examens_pratiques"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "tentatives_dossier_id_idx" ON "tentatives"("dossier_id");

-- Table resultats_examens
CREATE TABLE "resultats_examens" (
  "id"             TEXT NOT NULL,
  "dossier_id"     TEXT NOT NULL,
  "tentative_id"   TEXT NOT NULL,
  "session_type"   "SessionTypeExamen" NOT NULL,
  "session_id"     TEXT NOT NULL,
  "statut"         "StatutResultatExamen" NOT NULL DEFAULT 'planifie',
  "resultat"       "SaisieResultat",
  "score"          NUMERIC(5,2),
  "mention"        VARCHAR(50),
  "observations"   TEXT,
  "saisi_par_id"   TEXT,
  "saisi_le"       TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "resultats_examens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resultats_examens_tentative_session_type_unique" UNIQUE ("tentative_id", "session_type"),
  CONSTRAINT "resultats_examens_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "resultats_examens_tentative_id_fkey" FOREIGN KEY ("tentative_id") REFERENCES "tentatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "resultats_examens_saisi_par_id_fkey" FOREIGN KEY ("saisi_par_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "resultats_examens_dossier_id_idx" ON "resultats_examens"("dossier_id");
CREATE INDEX "resultats_examens_tentative_id_idx" ON "resultats_examens"("tentative_id");

-- Table convocation_requests (déclencheur pour Lot 6)
CREATE TABLE "convocation_requests" (
  "id"           TEXT NOT NULL,
  "dossier_id"   TEXT NOT NULL,
  "tentative_id" TEXT,
  "session_type" "SessionTypeExamen" NOT NULL,
  "session_id"   TEXT NOT NULL,
  "statut"       "StatutConvocationRequest" NOT NULL DEFAULT 'en_attente',
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "convocation_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "convocation_requests_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "convocation_requests_dossier_id_idx" ON "convocation_requests"("dossier_id");

-- Table attestation_requests (déclencheur pour Lot 6)
CREATE TABLE "attestation_requests" (
  "id"           TEXT NOT NULL,
  "dossier_id"   TEXT NOT NULL,
  "tentative_id" TEXT,
  "statut"       "StatutAttestationRequest" NOT NULL DEFAULT 'en_attente',
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "attestation_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attestation_requests_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "attestation_requests_dossier_id_idx" ON "attestation_requests"("dossier_id");
