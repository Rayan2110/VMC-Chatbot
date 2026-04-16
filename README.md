# VMC Chatbot — Marques Confort

Application web responsive pour la saisie d'interventions VMC par les intervenants terrain. Arbre de décision conditionnel, captures obligatoires, données structurées prêtes pour Power BI.

## Stack

- **Frontend** : React 18 + Vite (web responsive, déployable en PWA)
- **Backend** : Node.js + Express
- **Base de données** : PostgreSQL via Prisma ORM
- **Monorepo** : npm workspaces

## Structure

```
vmc-chatbot/
├── apps/
│   ├── web/       # Frontend React (intervenant)
│   └── api/       # Backend Express
├── packages/
│   └── db/        # Schéma Prisma + seeds (partagé)
└── package.json   # Workspaces
```

## Installation

### Prérequis

- Node.js ≥ 18
- PostgreSQL local OU une URL Postgres distante (Render, Railway, Supabase…)

### Setup

```bash
# 1. Installer toutes les dépendances du monorepo
npm install

# 2. Configurer la connexion BDD
cp apps/api/.env.example apps/api/.env
cp apps/api/.env.example packages/db/.env
# Éditer les deux .env avec ton DATABASE_URL

# 3. Créer le schéma en base
npm run db:push

# 4. Générer le client Prisma
npm run db:generate

# 5. Seed avec les données de démo (intervenants, clients, arbre VMC)
npm run db:seed
```

## Démarrage

```bash
# Lancer API + Web en parallèle
npm run dev

# Ou séparément :
npm run api:dev    # http://localhost:4000
npm run web:dev    # http://localhost:5173
```

L'app est accessible sur `http://localhost:5173`. L'API tourne en parallèle sur `:4000` et est exposée à React via le proxy Vite (`/api/*`).

## Outils utiles

```bash
npm run db:studio   # GUI Prisma pour explorer/éditer la base
```

## Déploiement (cible POC)

- **Web** → Vercel (auto-deploy depuis GitHub, gratuit)
- **API + DB** → Render (Node service + PostgreSQL managed)

Variables d'environnement à configurer côté Render :
- `DATABASE_URL` (fournie automatiquement par le service Postgres)
- `NODE_ENV=production`

## Périmètre du POC v0

Cette première version implémente :

- ✅ Authentification simple par sélection d'intervenant
- ✅ Création d'intervention (client + adresse + motif)
- ✅ Moteur de parcours data-driven lisant l'arbre depuis la BDD
- ✅ Sous-arbre complet « Dépannage > Ne fonctionne plus » (5 étapes)
- ✅ Captures obligatoires : photo (simulée), mesure numérique, signature
- ✅ Issues : clôture normale, escalade vers manager
- ✅ Interface tablette-friendly (boutons larges, polices grosses)

À détailler en phase suivante :

- ⏳ Sous-arbres des 4 autres symptômes (bruit, débit, humidité, code erreur)
- ⏳ Branches Entretien, Remplacement, Installation
- ⏳ Vraie capture photo via API navigateur (`getUserMedia`)
- ⏳ Vraie signature via canvas tactile
- ⏳ Mode offline (Service Worker + IndexedDB)
- ⏳ Interface admin pour éditer l'arbre sans toucher au code
- ⏳ Pont avec Mercator (vues SQL ou API)

## Architecture technique

L'arbre de décision est **stocké en base, pas codé en dur** dans l'application. Conséquence pratique : ajouter ou modifier un nœud de l'arbre passe par un INSERT en base, pas par un déploiement d'application.

Modèle de données : voir `packages/db/prisma/schema.prisma` ou le diagramme ERD du document `chatbot_vmc_cartographie.docx` (chapitre 4.3).

## Endpoints API

| Méthode | Endpoint | Usage |
|---------|----------|-------|
| GET | `/health` | Healthcheck |
| GET | `/intervenants` | Liste des intervenants actifs |
| GET | `/clients` | Liste des clients |
| GET | `/questions/first` | Première question de l'arbre |
| GET | `/questions/:id` | Question spécifique avec ses réponses possibles |
| POST | `/interventions` | Créer une intervention |
| GET | `/interventions/:id` | Détail complet d'une intervention |
| POST | `/interventions/:id/reponses` | Enregistrer une réponse, retourne la suite |
| POST | `/interventions/:id/captures` | Enregistrer une capture (photo/mesure/etc.) |
