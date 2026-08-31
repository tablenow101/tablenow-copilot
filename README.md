# TableNow Copilot

TableNow Copilot est le centre de pilotage opérationnel des restaurants : il rassemble les réservations, les communications, les équipes, les stocks, les opérations et les décisions assistées par IA dans une expérience cohérente sur ordinateur et mobile.

## Commencer ici

- [`context/CONTEXT.md`](context/CONTEXT.md) explique le produit et les décisions en langage simple.
- [`context/11-status/current-state.md`](context/11-status/current-state.md) décrit exactement ce qui fonctionne aujourd'hui.
- [`context/11-status/next-actions.md`](context/11-status/next-actions.md) contient la prochaine séquence de travail.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) définit la manière sûre de modifier le produit.

## Capacités déjà présentes

- accès privé par code e-mail à usage unique ;
- onboarding adapté aux restaurants équipés d'un logiciel, d'un calendrier, de papier, d'aucun outil ou d'un fonctionnement hybride ;
- neuf espaces métier reliés à des données persistantes ;
- saisie et pilotage sur ordinateur comme sur mobile ;
- organisations, établissements, membres, rôles et isolation entre restaurants ;
- Copilot avec permissions, budgets, preuves, journal d'audit et validation humaine ;
- intégrations fiables avec anti-doublon, file d'événements et reprise après erreur ;
- serveur MCP passant exclusivement par l'API métier ;
- Computer Use isolé, autorisé domaine par domaine et utilisé uniquement en dernier recours ;
- demandes RGPD, export, rectification, limitation et effacement ;
- PostgreSQL versionné par migrations et déployable sur Neon ;
- déploiement cloud sur Vercel et environnement local reproductible avec Docker.

## Architecture

| Zone | Responsabilité |
|---|---|
| `apps/console` | Interface web responsive et routes serveur Vercel |
| `services/core-api` | Règles métier, authentification, données et migrations |
| `services/worker` | Travaux différés et reprise fiable |
| `services/computer-use-runner` | Navigation externe isolée et contrôlée |
| `services/sync-gateway` | Synchronisation optionnelle et idempotente |
| `packages/contracts` | Formats d'échange validés |
| `packages/domain` | Permissions et invariants métier |
| `packages/agent-runtime` | Orchestration sécurisée du Copilot |
| `packages/provider-adapters` | Connexions remplaçables aux fournisseurs |
| `packages/mcp-server` | Outils IA exposés par l'API TableNow |

Le produit est un monolithe modulaire : une seule fondation à exploiter, avec des composants séparés et testables.

## Développement local

Prérequis : Node.js 22 ou plus récent, pnpm 11.19 et PostgreSQL.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

La console répond sur `http://localhost:3000`, l'API sur `http://localhost:4000` et la passerelle de synchronisation optionnelle sur `http://localhost:4100`.

Pour lancer l'ensemble dans des conteneurs avec une messagerie locale :

```bash
./scripts/init-node.sh direction@restaurant.fr
```

## Contrôle qualité

```bash
pnpm check
pnpm audit --audit-level=high
```

Chaque proposition de changement doit réussir le typage strict, les tests, les builds, l'audit de dépendances, l'isolation PostgreSQL et la construction des images Docker. GitHub exécute ces contrôles automatiquement avant intégration.

## Déploiement

- Vercel héberge la console et l'API intégrée.
- Neon fournit une base PostgreSQL dédiée par environnement.
- Chaque branche produit une Preview isolée.
- Seul l'artefact testé est promu vers la production.
- Aucun second backend cloud ni double écriture n'est autorisé.

Les règles détaillées se trouvent dans [`docs/DEPLOYMENT_BOUNDARIES.fr.md`](docs/DEPLOYMENT_BOUNDARIES.fr.md) et [`context/08-deployment-operations/release-process.md`](context/08-deployment-operations/release-process.md).

## Sécurité

Ne place jamais une clé, un mot de passe, une donnée client ou une URL de base réelle dans GitHub, un ticket ou une conversation. Utilise les variables chiffrées de l'environnement concerné et suis [`SECURITY.md`](SECURITY.md) pour signaler un problème.
