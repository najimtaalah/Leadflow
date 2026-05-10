-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('commercial', 'closer_habilite', 'gestionnaire', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "LeadStatut" AS ENUM ('nouveau', 'qualifie', 'en_cours', 'gagne', 'perdu');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('formulaire_web', 'telephone', 'recommandation', 'autre');

-- CreateEnum
CREATE TYPE "RelanceType" AS ENUM ('appel', 'email', 'rdv', 'autre');

-- CreateEnum
CREATE TYPE "RelanceStatut" AS ENUM ('a_faire', 'en_retard', 'faite');

-- CreateEnum
CREATE TYPE "CommissionStatut" AS ENUM ('libre', 'figee');

-- CreateEnum
CREATE TYPE "TimelineType" AS ENUM ('appel', 'message', 'rdv', 'relance', 'note', 'changement_statut', 'pre_dossier_ouvert');

-- CreateEnum
CREATE TYPE "ApprenantStatut" AS ENUM ('pre_actif', 'actif');

-- CreateEnum
CREATE TYPE "FormationType" AS ENUM ('vtc', 'taxi', 'vmdtr', 'passerelle_vtc_taxi', 'passerelle_taxi_vtc');

-- CreateEnum
CREATE TYPE "Formule" AS ENUM ('standard', 'accelere', 'illimite', 'week_end', 'mixte');

-- CreateEnum
CREATE TYPE "TypeFinancement" AS ENUM ('cpf', 'france_travail', 'opco', 'personnel', 'autre');

-- CreateEnum
CREATE TYPE "DossierStatut" AS ENUM ('pre_dossier', 'en_cours', 'valide', 'non_planifie', 'planifie', 'annule');

-- CreateEnum
CREATE TYPE "BlocStatut" AS ENUM ('non_demarre', 'en_cours', 'soumis', 'valide', 'rejete');

-- CreateEnum
CREATE TYPE "PieceStatut" AS ENUM ('a_fournir', 'fournie', 'rejetee', 'validee');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "commercial_id" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "formation_visee" TEXT,
    "statut" "LeadStatut" NOT NULL DEFAULT 'nouveau',
    "badge_pre_dossier" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relances" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "commercial_id" TEXT NOT NULL,
    "type" "RelanceType" NOT NULL,
    "date_prevue" TIMESTAMP(3) NOT NULL,
    "statut" "RelanceStatut" NOT NULL DEFAULT 'a_faire',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "commercial_id" TEXT NOT NULL,
    "montant" DOUBLE PRECISION,
    "statut" "CommissionStatut" NOT NULL DEFAULT 'libre',
    "date_figement" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_activites" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "type" "TimelineType" NOT NULL,
    "description" TEXT,
    "auteur_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_activites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apprenants" (
    "id" TEXT NOT NULL,
    "id_lead_origine" TEXT,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "date_naissance" TEXT NOT NULL,
    "lieu_naissance" TEXT,
    "nationalite" TEXT,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "adresse" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "statut" "ApprenantStatut" NOT NULL DEFAULT 'pre_actif',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apprenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" TEXT NOT NULL,
    "id_apprenant" TEXT NOT NULL,
    "id_lead_origine" TEXT,
    "formation_type" "FormationType" NOT NULL,
    "formule" "Formule" NOT NULL,
    "numero_cma" TEXT,
    "type_financement" "TypeFinancement",
    "reference_financeur" TEXT,
    "montant_vendu" DOUBLE PRECISION,
    "apport_personnel" DOUBLE PRECISION,
    "montant_prise_en_charge" DOUBLE PRECISION,
    "commercial_id" TEXT,
    "gestionnaire_id" TEXT,
    "statut" "DossierStatut" NOT NULL DEFAULT 'pre_dossier',
    "statut_bloc_admin" "BlocStatut" NOT NULL DEFAULT 'non_demarre',
    "statut_bloc_financier" "BlocStatut" NOT NULL DEFAULT 'non_demarre',
    "notes" TEXT,
    "notes_financier" TEXT,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_activation" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_justificatives" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "type_piece" TEXT NOT NULL,
    "fichier_nom" TEXT,
    "fichier_path" TEXT,
    "date_depot" TIMESTAMP(3),
    "statut" "PieceStatut" NOT NULL DEFAULT 'a_fournir',
    "motif_rejet" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pieces_justificatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT,
    "lead_id" TEXT,
    "type_action" TEXT NOT NULL,
    "detail" TEXT,
    "auteur_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "leads_commercial_id_idx" ON "leads"("commercial_id");
CREATE INDEX "leads_statut_idx" ON "leads"("statut");
CREATE INDEX "leads_date_creation_idx" ON "leads"("date_creation");

-- CreateIndex
CREATE INDEX "relances_lead_id_idx" ON "relances"("lead_id");
CREATE INDEX "relances_commercial_id_idx" ON "relances"("commercial_id");
CREATE INDEX "relances_date_prevue_idx" ON "relances"("date_prevue");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_lead_id_key" ON "commissions"("lead_id");
CREATE INDEX "commissions_commercial_id_idx" ON "commissions"("commercial_id");

-- CreateIndex
CREATE INDEX "timeline_activites_lead_id_idx" ON "timeline_activites"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "apprenants_id_lead_origine_key" ON "apprenants"("id_lead_origine");
CREATE INDEX "apprenants_id_lead_origine_idx" ON "apprenants"("id_lead_origine");

-- CreateIndex
CREATE INDEX "dossiers_id_apprenant_idx" ON "dossiers"("id_apprenant");
CREATE INDEX "dossiers_id_lead_origine_idx" ON "dossiers"("id_lead_origine");
CREATE INDEX "dossiers_statut_idx" ON "dossiers"("statut");

-- CreateIndex
CREATE INDEX "pieces_justificatives_dossier_id_idx" ON "pieces_justificatives"("dossier_id");

-- CreateIndex
CREATE INDEX "audit_logs_dossier_id_idx" ON "audit_logs"("dossier_id");
CREATE INDEX "audit_logs_lead_id_idx" ON "audit_logs"("lead_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_commercial_id_fkey" FOREIGN KEY ("commercial_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "relances" ADD CONSTRAINT "relances_commercial_id_fkey" FOREIGN KEY ("commercial_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_commercial_id_fkey" FOREIGN KEY ("commercial_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_activites" ADD CONSTRAINT "timeline_activites_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "timeline_activites" ADD CONSTRAINT "timeline_activites_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apprenants" ADD CONSTRAINT "apprenants_id_lead_origine_fkey" FOREIGN KEY ("id_lead_origine") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_id_apprenant_fkey" FOREIGN KEY ("id_apprenant") REFERENCES "apprenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_id_lead_origine_fkey" FOREIGN KEY ("id_lead_origine") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_commercial_id_fkey" FOREIGN KEY ("commercial_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_gestionnaire_id_fkey" FOREIGN KEY ("gestionnaire_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_justificatives" ADD CONSTRAINT "pieces_justificatives_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
