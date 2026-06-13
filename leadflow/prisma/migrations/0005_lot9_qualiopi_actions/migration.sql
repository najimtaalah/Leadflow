-- Lot 9 — Qualiopi Action Tracker

-- Table principale des actions Qualiopi
CREATE TABLE "actions_qualiopi" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "indicateur" VARCHAR(10) NOT NULL CHECK ("indicateur" IN ('IND-23','IND-24','IND-25','CRIT-5','CRIT-6')),
  "formation" VARCHAR(50) CHECK ("formation" IN ('TAXI','VTC','VMDTR','ANGLAIS','FRANCAIS_FLE','GRANDE_REMISE')),
  "titre" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "responsable" VARCHAR(100),
  "date_echeance" DATE,
  "statut" VARCHAR(20) NOT NULL DEFAULT 'a_faire' CHECK ("statut" IN ('a_faire','en_cours','fait','en_retard','annule')),
  "priorite" VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK ("priorite" IN ('low','medium','high','critical')),
  "preuve" TEXT,
  "preuve_fichier_url" TEXT,
  "source_veille_semaine" VARCHAR(10),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_by" VARCHAR(100),

  CONSTRAINT "actions_qualiopi_pkey" PRIMARY KEY ("id")
);

-- Audit trail obligatoire Qualiopi
CREATE TABLE "actions_qualiopi_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action_id" UUID NOT NULL,
  "statut_avant" VARCHAR(20),
  "statut_apres" VARCHAR(20) NOT NULL,
  "changed_by" VARCHAR(100),
  "note" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "actions_qualiopi_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "actions_qualiopi_history_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions_qualiopi"("id") ON DELETE CASCADE
);

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION update_actions_qualiopi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER trigger_actions_qualiopi_updated_at
  BEFORE UPDATE ON "actions_qualiopi"
  FOR EACH ROW EXECUTE PROCEDURE update_actions_qualiopi_updated_at();

-- Index
CREATE INDEX "idx_aq_indicateur"    ON "actions_qualiopi"("indicateur");
CREATE INDEX "idx_aq_statut"        ON "actions_qualiopi"("statut");
CREATE INDEX "idx_aq_formation"     ON "actions_qualiopi"("formation");
CREATE INDEX "idx_aq_date_echeance" ON "actions_qualiopi"("date_echeance");
CREATE INDEX "idx_aq_priorite"      ON "actions_qualiopi"("priorite");
CREATE INDEX "idx_aqh_action_id"    ON "actions_qualiopi_history"("action_id");
