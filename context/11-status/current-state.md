# État réel — 30 août 2026

## Construit dans le dépôt

- monorepo TypeScript avec console, API, worker, synchronisation, MCP et runner Computer Use ;
- neuf espaces produit, administration, onboarding et centre confidentialité ;
- accès par invitation et code e-mail côté serveur ;
- 66 tables PostgreSQL réparties dans quatre migrations ;
- isolation RLS, intégrité inter-tables et clés anti-doublon ;
- modes logiciel, calendrier, papier, aucun et hybride ;
- harness Copilot avec permissions, budgets, risques et validations ;
- documentation sécurité, RGPD, exploitation et contexte permanent ;
- Docker conservé pour développement, portabilité et mode local futur.
- API métier intégrée au même projet Next.js pour le runtime Vercel ;
- migration Preview automatique, verrouillée et limitée à la base Copilot ;
- amorçage pilote désactivé par défaut et impossible en Production ;
- route de disponibilité ne révélant aucune valeur secrète.

## Vérifié avant cette mise à jour documentaire

- typage strict, tests et builds de tous les workspaces ;
- 70 tests effectifs réussis ;
- audit des dépendances sans vulnérabilité connue ;
- aucun secret réel embarqué ;
- build Vercel complet réussi localement ;
- 80 fichiers Markdown et leurs liens relatifs vérifiés ;
- quatre tests PostgreSQL embarqués validant migrations, RLS, intégrité et idempotence.

## Pas encore réellement raccordé dans le cloud

- connexion Neon confirmée par le fondateur, à vérifier par une migration Preview ;
- migrations et données pilotes cloud ;
- envoi SMTP réel ;
- stockage privé des exports et preuves ;
- tâches durables et Computer Use isolé ;
- login complet jusqu'au cockpit sur la version cloud ;
- certification de tous les parcours desktop et mobile.
