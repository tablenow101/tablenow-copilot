# Point de livraison — 12 septembre 2026, après publication

Code publié dans PR 17, commit `38f73117ec94e76d865f0821688a0987f4b0e66b`. Revues produit, composants et sécurité terminées ; typage, tests locaux et build Next.js réussis.

Le déploiement `dpl_BNFrayzdJHDtMGedBmJsWMFjC4re` a appliqué les migrations 008 et 009 à la Preview Neon dédiée (lecture SQL confirmée), puis a échoué : `SESSION_SECRET`, `OTP_PEPPER` et `PLATFORM_ADMIN_EMAIL` absents dans Vercel. Ne pas rétablir les anciennes valeurs dérivées automatiquement. Aucun nouveau lien fonctionnel ni certification de production à annoncer.

Resend connecté à ChatGPT, mais aucune méthode Resend exposée dans cette session ; transport serveur, domaine et remise réelle non vérifiés. L'accès navigateur à la Preview reste protégé par la connexion Vercel. Détails et preuves dans `deployment-readiness-2026-09-12.md`.

---

# État réel — 12 septembre 2026

## Reprise — comptes et composants

Les formulations anciennes ci-dessous sur les identifiants à clarifier sont dépassées par les validations de la mémoire canonique : inscription, e-mail vérifié, mot de passe personnel et second facteur. Le code ajoute les routes compte, la récupération, les codes de secours, les documents privés du + et la sélection globale. Voir [architecture et modularisation](../02-architecture/owner-modularization-2026-09-12.md). La revue produit, la revue sécurité et la vérification du déploiement sont en cours ; aucune certification finale n’est annoncée ici.

## Historique antérieur à cette reprise

Correction du propriétaire : l'image d'entrée basse définition est rejetée et doit être remplacée par une création haut de gamme à valider. Le parcours OTP systématique ne correspond pas à la connexion récurrente souhaitée. Les identifiants permanents demandés restent à préciser avant implémentation ; voir D-021 et les validations exactes.

## Livraison propriétaire en cours

La branche `product/stitch-functional-owner`, issue de `product/onboarding-final-experience`, contient le parcours propriétaire fonctionnel : connexion par code, onboarding sauvegardé, recherche publique d'établissement, cockpit, décisions, communications, service/salle, équipe et conversation persistante. Voir [le bilan de livraison](owner-build-2026-09-12.md).

Le dernier Stitch est la référence fonctionnelle et visuelle. La simplicité demandée concerne la lisibilité, sans autorisation de masquer les fonctions ni d'inventer des textes. Voir [les validations exactes](../00-source-material/copy-approvals.md). Les stocks et le module métier légal sont exclus ; les protections et consentements existants sont conservés.

La reprise de l'entrée ajoute l'image issue du dernier Stitch et le seul CTA « Commencer », puis l'authentification avec ses deux textes validés et l'asset Google officiel. Les variantes de couleur de l'authentification suivent le système. L'image haute définition, l'harmonisation des autres écrans et la validation des autres textes restent à terminer. La recette navigateur demeure à effectuer ; ces modifications ne valent pas certification produit.

Le code `f6e72bab` est sauvegardé dans la PR #17, avec Preview Vercel **READY**, Quality Gate GitHub **success** et migrations 001 à 007 confirmées sur une nouvelle branche Neon isolée (1 restaurant de démonstration). La recette humaine desktop/mobile reste **BLOCKED_AUTH** : la Preview demande une connexion Vercel ; l'aperçu local avait également été refusé (`ERR_BLOCKED_BY_CLIENT`). Aucun test visuel de la nouvelle interface ni livraison réelle d'e-mail n'est certifié. La production n'est pas modifiée.

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
