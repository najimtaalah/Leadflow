-- CreateEnum
CREATE TYPE "SessionStatut" AS ENUM ('planifie', 'en_cours', 'termine', 'annule');

-- CreateEnum
CREATE TYPE "TypePresence" AS ENUM ('presentiel', 'distanciel', 'hybride');

-- CreateEnum
CREATE TYPE "SessionEdofStatut" AS ENUM ('active', 'cloturee');

-- CreateEnum
CREATE TYPE "ResultatExamen" AS ENUM ('reussi', 'echoue', 'absent');

-- CreateTable
CREATE TABLE "sessions_cours" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "type_presence" "TypePresence" NOT NULL DEFAULT 'presentiel',
    "lieu" TEXT,
    "formateur" TEXT,
    "capacite_max" INTEGER NOT NULL DEFAULT 20,
    "statut" "SessionStatut" NOT NULL DEFAULT 'planifie',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_cours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_cours_date_debut_idx" ON "sessions_cours"("date_debut");
CREATE INDEX "sessions_cours_statut_idx" ON "sessions_cours"("statut");

-- CreateTable
CREATE TABLE "sessions_edof" (
    "id" TEXT NOT NULL,
    "reference_edof" TEXT,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "date_fin_cpf" TIMESTAMP(3),
    "capacite_max" INTEGER NOT NULL DEFAULT 20,
    "statut" "SessionEdofStatut" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_edof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_edof_date_debut_idx" ON "sessions_edof"("date_debut");
CREATE INDEX "sessions_edof_statut_idx" ON "sessions_edof"("statut");

-- CreateTable
CREATE TABLE "sessions_examens_theoriques" (
    "id" TEXT NOT NULL,
    "date_examen" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT,
    "organisme" TEXT,
    "capacite_max" INTEGER NOT NULL DEFAULT 30,
    "statut" "SessionStatut" NOT NULL DEFAULT 'planifie',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_examens_theoriques_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_examens_theoriques_date_examen_idx" ON "sessions_examens_theoriques"("date_examen");
CREATE INDEX "sessions_examens_theoriques_statut_idx" ON "sessions_examens_theoriques"("statut");

-- CreateTable
CREATE TABLE "sessions_examens_pratiques" (
    "id" TEXT NOT NULL,
    "date_examen" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT,
    "organisme" TEXT,
    "capacite_max" INTEGER NOT NULL DEFAULT 10,
    "statut" "SessionStatut" NOT NULL DEFAULT 'planifie',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_examens_pratiques_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_examens_pratiques_date_examen_idx" ON "sessions_examens_pratiques"("date_examen");
CREATE INDEX "sessions_examens_pratiques_statut_idx" ON "sessions_examens_pratiques"("statut");

-- CreateTable
CREATE TABLE "affectations" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "session_cours_id" TEXT,
    "session_edof_id" TEXT,
    "session_examen_theorique_id" TEXT,
    "session_examen_pratique_id" TEXT,
    "resultat_theorique" "ResultatExamen",
    "resultat_pratique" "ResultatExamen",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affectations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affectations_dossier_id_key" ON "affectations"("dossier_id");
CREATE INDEX "affectations_session_cours_id_idx" ON "affectations"("session_cours_id");
CREATE INDEX "affectations_session_edof_id_idx" ON "affectations"("session_edof_id");
CREATE INDEX "affectations_session_examen_theorique_id_idx" ON "affectations"("session_examen_theorique_id");
CREATE INDEX "affectations_session_examen_pratique_id_idx" ON "affectations"("session_examen_pratique_id");

-- AddForeignKey
ALTER TABLE "affectations" ADD CONSTRAINT "affectations_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "affectations" ADD CONSTRAINT "affectations_session_cours_id_fkey" FOREIGN KEY ("session_cours_id") REFERENCES "sessions_cours"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affectations" ADD CONSTRAINT "affectations_session_edof_id_fkey" FOREIGN KEY ("session_edof_id") REFERENCES "sessions_edof"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affectations" ADD CONSTRAINT "affectations_session_examen_theorique_id_fkey" FOREIGN KEY ("session_examen_theorique_id") REFERENCES "sessions_examens_theoriques"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affectations" ADD CONSTRAINT "affectations_session_examen_pratique_id_fkey" FOREIGN KEY ("session_examen_pratique_id") REFERENCES "sessions_examens_pratiques"("id") ON DELETE SET NULL ON UPDATE CASCADE;
