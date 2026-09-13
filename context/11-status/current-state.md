# Fondations hybrides — reprise du 13 septembre 2026

GitHub CLI authentifié ; sauvegarde locale précédente poussée (`62648ee`). Mémoire canonique active et historique lus. Fondations en cours : récupération de contexte à droits réduits, connaissances communes évaluées/versionnées, missions persistantes et dédupliquées, sources/incertitudes, décisions et résultats du patron. Parcours corrigé pour ne pas confondre le drapeau du seed avec un onboarding finalisé ; seed rejoué sans écraser les corrections du propriétaire. Aucun nouveau fournisseur activé. Tests et Preview de ce lot en cours ; aucune certification utilisateur à ce stade. Voir [contrats et périmètre](../../docs/architecture/hybrid-foundations-2026-09-13.md).

# Raccordement Resend — 13 septembre 2026

Domaine `tablenow.io` vérifié, sept variables SMTP enregistrées pour la seule Preview de `product/stitch-functional-owner`, dont la clé sensible ajoutée par le propriétaire puis restreinte à la branche. Le redéploiement `jyp8smof5`, issu explicitement de la référence autorisée `96v84r74c`, est **READY** au commit `0d191dd`. L'écran d'inscription est accessible ; la saisie privée du mot de passe est confiée au propriétaire. Envoi réel, réception, TOTP, onboarding et cockpit ne sont pas encore validés. `8qufwgirl` (`main`) est explicitement exclu. Voir [l'état Resend](resend-preview-2026-09-13.md).

## Historique avant raccordement SMTP

# Reprise du déploiement Preview — 12 et 13 septembre 2026

La Preview `dpl_3bkD3gAw5LZH9MaLxpn9YvvPQA2M` est **READY** sur `product/stitch-functional-owner`, commit `0d191dd34d4db2ef5078b414b7bacf408859d35d`, après correction de `OTP_PEPPER` limitée à cette branche. Accès Vercel normal établi ; navigation de compte et refus de connexion testés sur desktop/mobile. Le parcours nouveau propriétaire reste **BLOCKED** : transport d'e-mail absent, réponses 503 observées. E-mail reçu, TOTP, onboarding et cockpit **NOT_RUN**. Production et legacy inchangés. Voir [la reprise](deployment-resume-2026-09-12.md) et [la recette avec captures](../../docs/qa/deployment-2026-09-13/report.md).

# Reprise locale — boucle de corrections du 12 septembre 2026

Voir [le reporting de corrections](correction-loop-2026-09-12.md). Des régressions ont été reproduites puis corrigées sur l'authentification, les contrôles métier et l'onboarding. Une passe indépendante sans cache a exécuté 162 tests réussis et quatre ignorés ; elle ne constitue ni 100 parcours réels ni une attestation de livraison. Le navigateur local est bloqué par deux timeouts du téléchargement officiel de Chromium. Aucun déploiement, push ou envoi réel n'a été réalisé pendant cette reprise. Le rapport détaille le périmètre exact de la dernière relance.

Le BCC existe dans les dépôts historiques frontend/backend, avec génération d'adresse et route CloudMailin ; il n'est plus considéré absent globalement. Il n'a pas été modifié ni testé en production.

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

## Google Places — import ciblé
Adaptation locale autorisée effectuée ; recherche Google et détails côté serveur Copilot, annuaire de secours conservé. TypeScript et 58 tests concernés passent. Clé Google absente du processus local ; navigateur Chromium manquant. Pas de test réel ni déploiement attesté. Détails : [google-places-import.md](google-places-import.md).
