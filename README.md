# LeadFlow CRM — Backend API

**Stack :** Node.js + Express + MySQL  
**Module actuel :** Module 1 — Authentification & Accès (UC-01 à UC-04)

---

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env
# → Éditer .env avec vos valeurs (DB, JWT_SECRET, etc.)
# → Générer un JWT_SECRET sécurisé : openssl rand -hex 64

# 3. Initialiser la base de données
mysql -u root -p < ../schema_v4.sql
mysql -u root -p leadflow_crm < ../seed.sql

# 4. Démarrer en développement
npm run dev

# 5. Démarrer en production
npm start
```

---

## Structure du projet

```
leadflow-crm/
├── src/
│   ├── config/
│   │   └── database.js          # Pool MySQL
│   ├── controllers/
│   │   ├── authController.js    # UC-01, UC-03
│   │   └── usersController.js   # UC-02
│   ├── middleware/
│   │   ├── auth.js              # authenticate + authorize
│   │   └── rateLimiter.js       # Rate limiting + verrouillage compte
│   ├── models/
│   │   ├── User.js              # Requêtes users
│   │   └── Log.js               # Requêtes logs_systeme
│   ├── routes/
│   │   ├── auth.js              # POST /login, POST /logout, GET /me
│   │   └── users.js             # CRUD /users
│   ├── utils/
│   │   ├── jwt.js               # generate, verify, revoke token
│   │   └── logger.js            # Winston logger
│   ├── app.js                   # Express app (middlewares + routes)
│   └── server.js                # Point d'entrée
└── tests/
    └── auth.test.js             # Tests UC-01 à UC-04
```

---

## Endpoints — Module 1

| Méthode | Route                        | Auth | Rôles          | UC   |
|---------|------------------------------|------|----------------|------|
| POST    | /api/auth/login              | Non  | —              | UC-01|
| POST    | /api/auth/logout             | Oui  | Tous           | UC-03|
| GET     | /api/auth/me                 | Oui  | Tous           | —    |
| GET     | /api/users                   | Oui  | super_admin, role_admin | UC-02|
| GET     | /api/users/:id               | Oui  | super_admin, role_admin | UC-02|
| POST    | /api/users                   | Oui  | super_admin    | UC-02|
| PATCH   | /api/users/:id               | Oui  | super_admin    | UC-02|
| POST    | /api/users/:id/reset-password| Oui  | super_admin    | UC-02|
| GET     | /api/users/:id/logs          | Oui  | super_admin    | UC-02|
| GET     | /health                      | Non  | —              | —    |

---

## Tests

```bash
# Tous les tests
npm test

# Module 1 uniquement
npm run test:auth
```

---

## Règles de sécurité implémentées

- **JWT** : expire après 8h, révocation à la déconnexion
- **Bcrypt** : 12 rounds par défaut
- **Verrouillage** : 5 tentatives échouées → verrouillage 15 min
- **Rate limiting** : 10 tentatives login / 15 min par IP · 100 req / 15 min global
- **Helmet** : en-têtes HTTP sécurisés
- **Logs** : toutes les actions sensibles loggées dans `logs_systeme`

---

## Prochains modules

- ~~**Module 2** — Gestion des Leads (UC-05 à UC-12)~~ ✅ Livré
- **Module 3** — Dossiers & CMA (UC-13 à UC-18)  ← suivant
- **Module 4** — Pédagogie & Agent IA CMA (UC-19 à UC-24)

---

## Module 2 — Gestion des Leads (UC-05 à UC-12)

### Nouveaux fichiers

```
src/
├── controllers/leadsController.js   # UC-05 à UC-12
├── models/Lead.js                   # Requêtes leads + distribution
├── models/Pipeline.js               # Historique transitions statut
├── routes/leads.js                  # Routes /api/leads
└── services/distributionService.js  # Assignation auto + réaffectation
tests/
└── leads.test.js                    # Tests UC-05 à UC-12
```

### Endpoints — Module 2

| Méthode | Route                          | Auth | Rôles | UC |
|---------|--------------------------------|------|-------|----|
| GET     | /api/leads                     | Oui  | Tous (filtre auto par rôle) | UC-07 |
| GET     | /api/leads/:id                 | Oui  | Tous  | UC-07 |
| POST    | /api/leads                     | Oui  | admin, manager, agent_accueil | UC-05 |
| POST    | /api/leads/webhook             | Non  | —     | UC-06 |
| PATCH   | /api/leads/:id                 | Oui  | Tous  | UC-10 |
| PATCH   | /api/leads/:id/statut          | Oui  | Tous  | UC-08 |
| POST    | /api/leads/:id/interactions    | Oui  | Tous  | UC-10 |
| POST    | /api/leads/:id/reassign        | Oui  | admin, manager | UC-12 |
| GET     | /api/leads/:id/historique      | Oui  | Tous  | UC-08 |

### Actions automatiques déclenchées par changement de statut

| Nouveau statut | Action automatique |
|----------------|--------------------|
| `gagne`        | Création automatique du dossier (table dossiers) |
| `rdv_booke`    | Message de suggestion RDV agenda |
| `perdu`/`annule` | Réaffectation automatique au commercial initial (UC-09) |

### Règle de distribution (UC-05/UC-06)
Round-robin pondéré : le commercial actif avec le moins de leads actifs est sélectionné,
dans la limite de max_leads défini dans agent_limites.

# Leadflow
Salaaaaaaam