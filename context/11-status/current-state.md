# État réel — 12 septembre 2026

## Livraison propriétaire en cours

La branche `product/stitch-functional-owner`, issue de `product/onboarding-final-experience`, contient le parcours propriétaire fonctionnel : connexion par code, onboarding sauvegardé, recherche publique d'établissement, cockpit, décisions, communications, service/salle, équipe et conversation persistante. Voir [le bilan de livraison](owner-build-2026-09-12.md).

Stitch est la base visuelle, mais la consigne la plus récente donne priorité à la simplicité : une priorité, une prochaine action, les détails à la demande. Les stocks et le module métier légal sont exclus ; les protections et consentements existants sont conservés.

Le code est testé localement. La recette humaine desktop/mobile reste **BLOCKED** : le navigateur de cette session refuse l'aperçu local (`ERR_BLOCKED_BY_CLIENT`). Aucun test visuel de la nouvelle interface ni livraison réelle d'e-mail n'est certifié. La production n'est pas modifiée.

Le dépôt est actuellement public ; la mention « privé » ci-dessous décrit l'état historique, pas une garantie de confidentialité actuelle.

## Historique — 31 août 2026

## Code et mémoire

- dépôt privé canonique créé : `tablenow101/tablenow-copilot` ;
- source synchronisée sur la branche stable `main` ;
- monorepo TypeScript avec console, API, worker, synchronisation, MCP et runner Computer Use ;
- documentation d'entrée, contexte permanent, sécurité et gouvernance GitHub structurés ;
- CI GitHub active et entièrement verte sur le commit `4a47d50` : code, PostgreSQL et Docker ;
- Dependabot actif, avec correctifs groupés et versions majeures exclues de l'automatisation ;
- neuf espaces produit, administration, onboarding et centre confidentialité ;
- accès privé par code e-mail côté serveur ;
- 66 tables PostgreSQL réparties dans quatre migrations ;
- isolation RLS, intégrité inter-tables et clés anti-doublon ;
- modes logiciel, calendrier, papier, aucun outil et hybride ;
- Copilot avec permissions, budgets, risques, preuves et validations humaines ;
- Docker conservé pour le développement, les tests de portabilité et le mode local futur.

## Vérifié localement

- typage strict, tests et builds de tous les workspaces ;
- 70 tests effectifs réussis ;
- audit des dépendances sans vulnérabilité connue ;
- aucun secret réel embarqué ;
- build Vercel complet réussi ;
- migrations PostgreSQL, RLS, intégrité et idempotence testées ;
- documentation et liens relatifs vérifiés ;
- migration exécutable depuis une installation vierge vérifiée par GitHub Actions.

## Cloud

- projet Vercel Copilot existant et isolé ;
- base Neon confirmée par le propriétaire ;
- connexion GitHub → Vercel encore à prouver par un nouveau déploiement Preview ;
- migrations Neon encore à prouver sur cette Preview ;
- SMTP réel, stockage privé, tâches durables et Computer Use cloud encore à raccorder ;
- parcours complet ordinateur et mobile encore à certifier sur la version cloud.
