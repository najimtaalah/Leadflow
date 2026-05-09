# LeadFlow+ CRM

Nouveau CRM de gestion apprenants pour France Conseil & Formations.

- **Frontend** : crm-new.mywebapps.fr
- **Backend API** : crm-new.mywebapps.fr/api

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + TypeScript + Vite |
| Design system | Tailwind CSS + shadcn/ui + Radix UI + Lucide React |
| Typographie | Inter |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Base de données | PostgreSQL |
| Auth | JWT stateless + RBAC |
| API | REST |
| Déploiement | Docker + nginx |

## Setup local

### Prérequis
- Node.js 20+
- Docker + Docker Compose
- pnpm

### Installation

```bash
# Cloner le repo
git clone git@github.com:najimtaalah/leadflow-plus.git
cd leadflow-plus

# Variables d'environnement
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Éditer les valeurs dans .env

# Lancer via Docker (recommandé)
docker compose up -d

# OU en local (dev)
cd backend && pnpm install && pnpm dev &
cd frontend && pnpm install && pnpm dev
```

### Migrations Prisma

```bash
cd backend
pnpm prisma migrate dev    # dev
pnpm prisma migrate deploy  # production
pnpm prisma db seed        # comptes de test
```

## Rôles

| Rôle | Accès |
|------|-------|
| Commercial | Leads + Pré-dossiers |
| Closer | Leads + Dossiers + Conversions |
| Gestionnaire | Dossiers + Sessions + Documents |
| Admin | Tout sauf configuration système |
| SuperAdmin | Accès total |

## Comptes de test

Créés par `prisma db seed` :

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| commercial@test.fr | Test1234! | Commercial |
| closer@test.fr | Test1234! | Closer |
| gestionnaire@test.fr | Test1234! | Gestionnaire |
| admin@test.fr | Test1234! | Admin |
| superadmin@test.fr | Test1234! | SuperAdmin |
