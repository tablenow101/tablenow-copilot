# Porte de validation — lot 1 partiellement vérifié — BLOCKED_AUTH

Instruction du propriétaire du 16 septembre 2026 : le lot 1 reste ouvert. Le commit publié avant correction TOTP est `0215615c08eea23cf7a29c0b622e46fb85739d55` ; les contrôles techniques ne constituent pas une validation produit.

Cause du refus observé : le défi Google + MFA avait expiré 5 min 34 s avant la requête. Le serveur l'a rejeté avant de comparer le code et le compteur de tentatives est resté à zéro. L'enrôlement TOTP est actif dans la base Preview, chiffré et lié au même utilisateur Google ; SHA-1, six chiffres, 30 secondes et tolérance ±1 pas correspondent au QR. Aucun OTP e-mail n'est créé dans ce parcours. La correction locale distingue désormais l'expiration par HTTP 410, utilise PostgreSQL comme horloge d'autorité, renouvelle ensemble défi et cookie, expose la durée restante au navigateur et propose une relance explicite sans désactiver le TOTP. Tests locaux : API 98 réussis / 4 ignorés, console 55 réussis, typechecks réussis. Détails : `docs/qa/totp-expiry-2026-09-16.md`.

À exécuter : publier la correction en Preview, ouvrir un nouveau parcours Google, laisser le navigateur ouvert pour la saisie privée du propriétaire, puis priorités → sauvegarde → établissement → déconnexion/reconnexion → reprise, avec preuves ordinateur et mobile. Puis demander la validation explicite du lot 1. Aucun verdict de réussite pour ce parcours à ce stade.

Le lot 2 peut seulement être préparé et codé indépendamment. Aucun commit final, clôture ou lot 3 avant validation du lot 1, correspondance documentée des huit étapes vers six, tests de migration réversible sans perte (nouveau, partiel, historique terminé), présentation du diff et validation explicite du propriétaire. Chaque lot possède désormais cette porte produit. Inscription de cette nouvelle décision en mémoire PostgreSQL : en attente ; cette note ne la remplace pas.

# Advisor continu — lot 1 en cours, 16 septembre 2026

La spécification validée est conservée dans `docs/product/CONTINUOUS_ADVISOR.fr.md`, avec architecture et plan d’exécution. La mémoire PostgreSQL canonique a été relue sous l’enregistrement 94 version 3, qui remplace 93. Le lot 1 rend l’ordre priorités → établissement commun aux contrats, au serveur et à l’interface, ajoute la migration additive 012 pour les nouveaux brouillons et retire la ressource de l’ancien accueil photographique. `pnpm check` est vert : lint et typecheck complets, 210 tests réussis, 4 intégrations ignorées et build Next réussi. Le rendu public local est lisible sans débordement à 1440 × 900 et 390 × 844, sans photo historique ni overlay ; l’API locale n’était pas démarrée, donc le parcours authentifié reste à vérifier sur la Preview après déploiement. `main` reste inchangée. La mention de Preview non modifiée décrivait le contrôle local avant publication du commit 0215615 ; voir la porte de validation ci-dessus.

# Google OAuth et domaine historique — correction déployée, 16 septembre 2026

La Preview canonique sert le commit `aec792bd813d1de87c2b5c90b250aa17ed580288`, déploiement `dpl_DxrVpDcz3vuJes76kFQbNWwREBUR`, sur `preview.tablenow.io`. `copilot.tablenow.io` est maintenant affecté à la même branche et redirige réellement vers la Preview avant OAuth. Parcours vérifié dans le navigateur : ancien lien → `preview.tablenow.io/login` → sélecteur Google avec retour `https://preview.tablenow.io/api/v1/oauth/google/callback` → retour TableNow → écran TOTP. Aucun `redirect_uri_mismatch` observé. Google reste en mode Testing avec 2 testeurs inscrits sur un plafond de 100 ; un nouveau bêta-testeur doit être ajouté à cette liste tant que l'application n'est pas publiée. La protection Vercel Standard reste active. TOTP complet, e-mail reçu, onboarding, cockpit et appareils mobiles ne sont pas encore certifiés.

# Migration TableNow OS — garde de publication, 15 septembre 2026

`product/onboarding-owner` reste le sas de sécurité temporaire au commit publié `787973170fe3cde6f1e0db84fdfa5b4d3a8ef515`. Les corrections locales centralisent la topologie autorisée (`preview.tablenow.io`/branche cible et `os.tablenow.io`/`main`), bloquent toute migration avant validation du projet, de la branche, de l'origine et de l'endpoint Neon, exigent les identifiants SMTP complets et restaurent l'identité TableNow OS. `pnpm check` est vert : lint 16/16, typecheck 16/16, 207 tests réussis, 4 intégrations ignorées, build 11/11. Ce résultat est local ; le nouveau commit, le build Vercel et le parcours réel ne sont pas encore validés. La décision canonique de cycle de vie est enregistrée sous `project_memory.current_records` id 90, version 3.

# Adresse stable Copilot — 14 septembre 2026

`copilot.tablenow.io` est désormais rattaché à la branche Preview `product/stitch-functional-owner`. DNS Gandi ajoutés et vérifiés ; 26 enregistrements existants préservés. Origine serveur de branche et nouveau retour Google configurés, ancien retour conservé pour la transition. Corrections des deux textes validés prêtes ; 135 tests passent, 4 ignorés, compilations réussies. Publication et recette du nouveau domaine en cours : aucune certification du parcours complet. Les trois nouveaux logos annoncés ne sont pas disponibles. [Preuves et écarts](../../docs/qa/stable-preview-2026-09-14.md).

# Google + TOTP réussis, onboarding commencé — 13 septembre 2026, 22:40 UTC

Après la saisie privée du propriétaire, le compte Google Radwan est actif, possède ses identifiants TOTP, une liaison Google et une session non expirée ; le navigateur atteint réellement `/onboarding`. Brouillon serveur en section `establishment`, révision 10, non finalisé. Le propriétaire précise qu'il manquait de temps lors des essais précédents : ne pas attribuer l'expiration à une erreur de saisie. L'onglet est désormais conservé pour sa saisie. Il signale une présentation d'onboarding ancienne et demande un compte rendu pour ChatGPT ; comparaison de la référence attendue à effectuer, sans refonte décidée. Aucun cockpit complet ni recette mobile validés. [Compte rendu complet](../../docs/qa/compte-rendu-chatgpt-2026-09-13.md). Les entrées ci-dessous sont historiques.

# Diagnostic du parcours Google — 13 septembre 2026, 22:25 UTC

Le propriétaire signale que sa tentative « Continuer avec Google » ne lui a pas permis d'entrer dans TableNow. Lecture Preview : la tentative Google du profil Radwan atteint la configuration TOTP à 22:13 UTC, sans tentative de validation enregistrée, puis expire à 22:23 UTC. Aucun compte n'est encore créé pour cette adresse ; le compte Bryan existe avec ses identifiants, sans liaison Google. Une demande distincte de vérification par e-mail est créée à 22:17 UTC et reste à cette étape après deux essais ; ces métadonnées seules ne permettent pas de dire si le code était erroné ou si une récupération visait un compte inexistant. Le parcours complet reste **BLOCKED**, sa compréhension est insuffisante. L'identité voulue doit être clarifiée avant une nouvelle tentative ; aucun nouveau code envoyé ni réglage changé pendant ce diagnostic. Alias de branche vérifié READY sur `f0e98b9`. [Diagnostic détaillé](../../docs/qa/google-preview-2026-09-13/report.md#diagnostic-apres-le-retour-du-proprietaire).

# Google + TOTP — raccordement Preview en cours

Google est ajouté comme choix facultatif avec TOTP conservé, selon confirmation du propriétaire. Projet Google séparé `tablenow-copilot-preview`, consentement en mode test et client créés ; l'ancien client et son consentement sont inchangés. Variables OAuth de type Secret, Preview et branche cible uniquement. Code `4f0512c`, Preview `hepfd5jgo` READY, migration 011 vérifiée, CI verte. 133 tests locaux passent, 4 sont ignorés ; compilation réussie. Bouton → Google → consentement → retour réel TableNow vérifié sur desktop. TOTP privé attendu avant onboarding/cockpit ; recette mobile non exécutée. La première clé, exposée par un libellé technique Google avant utilisation, a été remplacée et supprimée. [Preuves et limites](../../docs/qa/google-preview-2026-09-13/report.md).

# Authentification — présentation déployée en Preview

Commit `c01d192` publié sur la branche cible ; Preview `qs35jybon` READY. Couleurs TableNow conservées, logo en haut, champs et boutons alignés, six cases pour le code. « Se souvenir de moi » raccordé à la persistance des cookies à durée maximale inchangée, selon le choix explicite du propriétaire. CI GitHub verte ; présentation et navigation publiques vérifiées ordinateur/mobile. Google/Apple indisponibles en attente des accès ; connexion complète réelle et réouverture de session non testées dans ce lot. [Preuves et limites](../../docs/qa/auth-layout-2026-09-13/report.md).

# Fondations déployées — 13 septembre 2026

Les commits `62648ee` et `747d040` sont poussés. Preview `nlhtnepu8` READY sur la branche cible ; migration 010 confirmée dans Neon Preview. Quality Gate GitHub vert (qualité, PostgreSQL, Docker). Entrée/connexion/inscription observées desktop et mobile émulé ; la connexion privée du propriétaire manque sur la nouvelle URL pour terminer onboarding, reprise et cockpit. Aucun verdict produit complet. [Rapport détaillé](../../docs/qa/governed-2026-09-13/report.md).

## Historique de cette reprise

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
