-- Migration 006 — Vues calculées (soldes, commissions, finances dossier)

CREATE OR REPLACE VIEW vue_soldes AS
SELECT
    d.id AS dossier_id,
    d.reference,
    GREATEST(
        COALESCE(d.cout_total_formation, d.fp_manuel, 0)
        - COALESCE(d.part_financeur, 0), 0
    ) AS financement_personnel,
    COALESCE(SUM(e.montant), 0) AS total_encaisse,
    GREATEST(
        GREATEST(
            COALESCE(d.cout_total_formation, d.fp_manuel, 0)
            - COALESCE(d.part_financeur, 0), 0
        ) - COALESCE(SUM(e.montant), 0), 0
    ) AS reste_a_payer
FROM dossiers d
LEFT JOIN encaissements e ON e.dossier_id = d.id
GROUP BY d.id;

CREATE OR REPLACE VIEW vue_commissions AS
SELECT
    u.id                            AS vendeur_id,
    CONCAT(u.prenom,' ',u.nom)      AS vendeur_nom,
    r.nom                           AS role_nom,
    a.id                            AS agence_id,
    a.nom                           AS agence_nom,
    COUNT(d.id)                     AS nb_dossiers,
    COALESCE(SUM(d.cout_total_formation), 0) AS base_calcul,
    cc.taux_base,
    ROUND(COALESCE(SUM(d.cout_total_formation), 0) * cc.taux_base / 100, 2) AS commission_base,
    0.00                            AS supplement_equipe,
    ROUND(COALESCE(SUM(d.cout_total_formation), 0) * cc.taux_base / 100, 2) AS commission_totale
FROM users u
JOIN roles r ON r.id = u.role_id
    AND r.nom IN ('commercial','manager')
JOIN config_commissions cc ON cc.role_nom = r.nom
LEFT JOIN agences a ON a.id = u.agence_id
LEFT JOIN dossiers d ON d.vendeur_id = u.id
    AND d.archived = 0
    AND d.cout_total_formation > 0
WHERE u.actif = 1
GROUP BY u.id, u.prenom, u.nom, r.nom, a.id, a.nom, cc.taux_base;

CREATE OR REPLACE VIEW vue_finances_dossier AS
SELECT
    d.id, d.reference, d.nom, d.prenom,
    GREATEST(
        COALESCE(d.cout_total_formation, d.fp_manuel, 0)
        - COALESCE(d.part_financeur, 0), 0
    ) AS financement_personnel,
    COALESCE(enc.total, 0) AS total_encaisse,
    d.frais_cma,
    d.frais_cma_paye
FROM dossiers d
LEFT JOIN (
    SELECT dossier_id, SUM(montant) AS total
    FROM encaissements GROUP BY dossier_id
) enc ON enc.dossier_id = d.id;
