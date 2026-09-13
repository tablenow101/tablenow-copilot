# Livraison intermédiaire — fondations gouvernées

Date : 13 septembre 2026. Verdict global : **BLOCKED pour la recette utilisateur complète**, fondations techniques déployées et testées. Ce rapport ne déclare pas TableNow terminé.

## Source et sauvegardes

- Dépôt `tablenow101/tablenow-copilot`, branche `product/stitch-functional-owner`.
- SHA local et distant vérifiés au départ : `0d191dd34d4db2ef5078b414b7bacf408859d35d`.
- `62648eed2d66f9cc2634acc9f01e5dff385db5fd` : preuves SMTP, correction OTP et précédents essais navigateur sauvegardés et poussés.
- `747d040f4a8fcf3c8347825a0c5838a624e192ce` : missions de conseil persistantes, isolation des contextes, traçabilité, reprise et correction du parcours propriétaire ; poussé sans force.
- Aucun changement local de code SMTP/authentification n'était resté hors Git au départ : le raccordement précédent était enregistré dans Vercel. Le propriétaire rapporte son succès ; cela ne certifie pas toutes les étapes suivantes.
- GitHub CLI connecté officiellement à `tablenow101`. Le premier `git push` avait échoué faute d'identification du terminal ; la connexion au connecteur Codex ne suffisait pas à Git local.

## Décisions couvertes

Mémoire stable lue : point d'entrée 85, dix chemins Memoire-Gouvernee (75–84), décisions et références historiques 4, 5, 67, 68, 71–74. Aucun dossier historique supprimé, aucune archive remplacée, aucun contenu privé intégral copié dans ce dépôt public. La mémoire stable est restée en lecture seule ; l'état d'implémentation est documenté dans le dépôt, sans prétendre avoir mis à jour ses versions canoniques.

| Décision | Réalisation et preuve | Limite |
|---|---|---|
| Entrée → compte → sécurité → profil → cockpit | Entrée et design conservés ; session dérive la complétude d'un brouillon réellement finalisé, pas du seul drapeau du seed ; un accès sans section d'édition à un brouillon terminé retourne au cockpit | Connexion utilisateur de cette nouvelle URL encore attendue |
| Préserver le travail et les profils | Seed rejouable sans réécriture du nom, rôle, profil et systèmes existants ; test PostgreSQL rejoué | Données anciennes conservées, aucune remise à zéro |
| Séparer les quatre mémoires | Mémoire de conception absente de la base Preview ; rôle de contexte sans accès aux identifiants ; connaissances communes dans un schéma distinct ; contexte temporaire expirant ; historique privé tenant/restaurant/utilisateur | Le schéma commun est un socle, pas une bibliothèque métier peuplée et évaluée |
| Orchestration hybride | Qualification simple, règles spécialisées réservation/opérations/analyse, calculs vérifiables puis rédaction facultative par le modèle déjà configuré | Pas de déploiement de cinq agents autonomes, pas de sélection empirique d'un « meilleur modèle » ; routage initial déterministe |
| Fiabilité et reprise | Clé de demande, empreinte, bail de 45 s, délai modèle de 30 s, trois tentatives maximum, contrôle d'ancien travail et messages atomiques | Reprise explicite par l'utilisateur ; aucun worker autonome ajouté. Contexte supprimé après fin/échec, sinon expirant et nettoyage à la prochaine demande du même périmètre |
| Preuves et apprentissage | Rapport persistant avec sources, conflits et incertitudes ; décisions/résultats en observations immuables ; versions communes approuvées seulement après évaluation renseignée | Aucun apprentissage automatique, transfert de données privées ou nouvelle autorisation d'action |
| Clavier, voix, documents | Compositeur existant conservé, + à gauche, micro volontaire, sortie écrite | Dictée réelle et analyse documentaire automatique non certifiées ; analyse automatique toujours explicitement indisponible |

Les [contrats d'écran](../../architecture/hybrid-foundations-2026-09-13.md) ont été écrits avant les changements visibles. Les libellés opérationnels de preuve sont documentés ; aucune nouvelle accroche commerciale n'a été ajoutée.

## Fichiers modifiés

- `services/core-api/migrations/010_governed_copilot.sql` : schéma commun, missions, contexte temporaire, observations, intégrité et rôle de lecture restreint.
- `services/core-api/src/governed-copilot.ts` : récupération ciblée, orchestration de conseil, budgets existants, persistance, rejeu et API d'observations.
- `packages/agent-runtime/src/service-assessment.ts`, `index.ts` : qualification et calculs de service, conflits, inconnues, sources et recommandations sans action externe.
- `services/core-api/src/owner-operations.ts`, `app.ts` : raccordement aux routes existantes, injection de modèle pour tests, erreurs explicites sans détail fournisseur sensible.
- `apps/console/components/CopilotEvidence.tsx`, `OwnerShell.tsx`, `app/globals.css` : preuves et décision du patron, identifiant stable de requête, reprise après rechargement, styles existants conservés.
- `services/core-api/src/repository.ts`, `apps/console/components/OnboardingFlow.tsx` : complétude réelle et retour direct au cockpit.
- `services/core-api/src/seed.ts`, `preview-smoke.ts` : seed non écrasant, contrôle adapté au compte déjà doté de mot de passe/TOTP.
- `services/core-api/src/governed-copilot.test.ts`, `schema-migrations.test.ts` : scénarios et contrôles SQL réels embarqués.
- `.gitignore` : cache pnpm local exclu ; documentation d'architecture, décisions et statut mise à jour.

## Déploiement vérifié

- URL : [Preview du lot](https://tablenow-copilot-v2-nlhtnepu8-tablenow101.vercel.app).
- ID : `dpl_8osq1MuaTdq8HsMUqnJZj4sTFiYt`.
- Projet : `tablenow-copilot-v2`, équipe `tablenow101`, **Preview**, branche et commit `747d040` confirmés par Vercel.
- État : **READY** ; build 28 s, compilation Next.js 2,9 s, TypeScript 4,7 s ; terminé à 19:20:08 UTC.
- Migration 010 appliquée à 19:19:45 UTC ; relecture indépendante sur `br-ancient-sun-za1ku4d2`, distincte de la branche stable.
- Rôle en Preview : NOLOGIN, non-superutilisateur, sans BYPASSRLS ; lecture des identifiants et écriture de connaissance commune refusées par les privilèges. `project_memory` absent de cette base.
- Source produit préservée : branche issue de `96v84r74c`; `8qufwgirl`/main exclu. Aucun alias de production modifié, aucune promotion.

Le déploiement documentaire précédent `62648ee` avait échoué car son ancien smoke exigeait encore un OTP de connexion pour le compte déjà protégé par TOTP. Le nouveau smoke vérifie le refus de cette voie, les accès anonymes refusés et la base ; il ne supprime aucun contrôle et ne prétend pas tester une connexion complète.

## Tests réellement exécutés

- Builds TypeScript des cinq paquets API et typage console : sortie 0.
- Suite API locale : 79 tests réussis, 4 tests PostgreSQL externe ignorés faute de base externe locale ; les tests PGlite sont réellement exécutés.
- Dernière passe ciblée après corrections seed/reprise : 11 tests réussis, dont 7 scénarios gouvernés et 4 contrôles de seed/smoke.
- Console : 40 tests réussis ; runtime historique : 2 tests réussis.
- Compilation Next.js locale : sortie 0. Build distant complet et migration : réussis.
- [Quality Gate GitHub, run 34777321586](https://github.com/tablenow101/tablenow-copilot/actions/runs/34777321586) sur `747d040` : trois jobs réussis — TypeScript/tests/build/audit, isolation PostgreSQL externe, images Docker. Le job PostgreSQL externe de CI complète les quatre tests ignorés localement.
- Scénario synthétique de service exécuté par l'API sur PostgreSQL embarqué : absence, réservation/modification/retard évoqués, capacité du plan différente de la capacité restaurant ; calculs distincts d'une occupation simultanée, inconnues explicites, décision du patron persistée, rejeu sans second message ni travail externe.
- Connaissances : version approuvée courante retenue ; candidate, ancienne et expirée exclues ; écriture depuis le rôle de contexte refusée.
- Sécurité : rôle de contexte incapable de lire une mémoire privée de conception présente dans la fixture ou les credentials ; lecture brute des restaurants limitée à celui sélectionné ; accès à un autre tenant refusé ; historique d'un autre restaurant vide ; CSRF et rôle insuffisant refusés.
- Fiabilité : échec fournisseur sans fuite de détails, reprise au même identifiant, conservation d'une seule paire de messages, reprise de bail expiré, rejet pendant une tentative active et après trois tentatives.
- Diff, motifs courants de clés privées et liens documentaires locaux contrôlés ; aucun secret détecté. Les tests utilisent des données synthétiques, pas des secrets live.

Un autre contrôle automatique Vercel nommé `tablenow-copilot-console` est en échec. Ce projet n'est pas la cible autorisée ; aucune configuration ni tentative de correction n'y a été faite. Le contrôle `tablenow-copilot-v2` est réussi.

## Recette réelle navigateur

| Scénario | Exécuté | Verdict / limite |
|---|---|---|
| Entrée avec Commencer → connexion → lien inscription | Oui, nouvelle Preview | Navigation accessible ; [connexion desktop](desktop-login.png) |
| Inscription mobile, 390 × 844 | Oui, vue émulée | Largeur document 390 px pour viewport 390 px ; [capture](mobile-register.png). Pas de téléphone physique |
| Retour inscription → connexion après redimensionnement | Oui, seconde tentative | Premier clic suivi d'un timeout ; second clic réussit. Friction observée, cause non établie |
| Mot de passe/TOTP réel de ce compte | Non terminé | Session absente sur la nouvelle URL ; saisie privée demandée au propriétaire |
| Nouvelle inscription, réception du code et confirmation Gmail dans cette passe | NOT_RUN | Compte de test déjà inscrit ; succès précédent rapporté par le propriétaire, aucune nouvelle réception déclarée ici |
| Onboarding automatique, sauvegarde, reprise puis cockpit | NOT_RUN en navigateur sur ce lot | Connexion nécessaire ; tests serveur ne remplacent pas ce parcours |
| Conseil de service, décision et résultat depuis les écrans | NOT_RUN en navigateur sur ce lot | Scénario API synthétique exécuté, pas une recette utilisateur certifiée |
| Micro réel, clair/sombre complet, téléphone physique | NOT_RUN | À vérifier après connexion |

Les captures illustrent les étapes réellement ouvertes ; elles ne constituent pas une validation globale du design. Le logo est chargé dans le DOM (image 800 px natifs) ; aucun changement de marque n'a été effectué.

## Suite indispensable

Le propriétaire se connecte normalement dans la Preview avec `bryanduvalpro@gmail.com`, mot de passe et TOTP saisis uniquement dans la page. Ensuite : constater la redirection automatique, jouer l'onboarding court jusqu'au cockpit, interrompre/reprendre, vérifier la persistance puis les recommandations et observations desktop/mobile. Demander une confirmation explicite de réception lors de tout nouvel essai e-mail. Les fondations et la compilation réussies ne valent pas certification de ces parcours.

Ne pas publier en production. Ne pas activer de nouveau modèle, connecteur, téléphone ou canal, ni de modules Stocks/Légal. Les sources de recommandations ne prouvent pas à elles seules la fidélité sémantique d'une réponse de modèle ; l'évaluation métier complète reste à faire avant adoption.
