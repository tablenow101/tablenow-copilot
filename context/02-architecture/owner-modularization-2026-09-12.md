# Architecture et modularisation du parcours propriétaire

Document de travail du 12 septembre 2026. Source produit : décisions versionnées dans `project_memory.current_records`. Le dernier état de livraison est décrit séparément dans `context/11-status/`.

## Pourquoi ces modules

Les composants partagés rendent les boutons et la conversation cohérents sur chaque écran. Les modules métier permettent de corriger l’inscription sans casser les réservations. Les contrats définissent les échanges. Les vérifications doivent établir qu’une opération est autorisée, persistée et réellement exécutée avant d’afficher son succès.

Le système reste un monolithe modulaire : console et API déployées ensemble, PostgreSQL comme source de vérité, traitements asynchrones séparés. Ce découpage technique ne doit pas multiplier les écrans ou questions de l’onboarding.

| Module | Responsabilité | Réalisation actuelle |
|---|---|---|
| `apps/console/components/account/` | Inscription, connexion, vérifications et récupération | Parcours branché sur API ; recette à prouver |
| `apps/console/app/components.css` | Contrôles partagés : dimensions, finesse, couleur du logo | Styles centralisés ; conformité visuelle à vérifier |
| `apps/console/components/ConversationInput.tsx` | Texte, micro, documents et envoi | Partagé entre onboarding et cockpit ; pièces jointes persistées |
| `apps/console/lib/priority-selection.ts` | Sélection globale indépendante des choix masqués | Implémenté avec tests |
| `services/core-api/src/account-routes.ts` | Preuves d’identité, création du propriétaire, sessions | Implémenté ; revue et tests sécurité effectués, recette distante restante |
| `services/core-api/src/onboarding-attachments.ts` | Documents privés, récupération et suppression autorisées | Implémenté, stockage persistant chiffré |
| `packages/contracts` | Schémas API et événements métier | Existant |
| `packages/domain` | Permissions, invariants et autorisations d’action | Existant |
| `services/core-api/src/repository.ts` | Persistance métier et isolation | Existant ; extraction par domaine à poursuivre |
| `packages/agent-runtime` | Préparation et contrôle des propositions | Socle ; pas encore une hôtesse autonome complète |
| `services/worker` | Exécution asynchrone et reprise | Existant ; intégrations externes partielles |
| `packages/provider-adapters` | Prestataires derrière des interfaces | E-mail, modèle, base et stockage existants |
| `services/sync-gateway` | Transport et reprise de synchronisation | Socle ; autonomie locale non certifiée |

## Comptes et onboarding

« Commencer » ouvre la connexion. « Créer votre compte » ouvre l’inscription. Le nouveau propriétaire saisit son nom, son adresse et son mot de passe, vérifie son adresse, puis configure son second facteur. La session donne ensuite accès à l’onboarding. Les retours utilisent le mot de passe et le TOTP, ou un code de secours à usage unique.

L’espace « Mon établissement » créé lors de l’inscription est provisoire : il permet la recherche et la confirmation du restaurant. Il n’est pas présenté comme une identité trouvée automatiquement. L’onboarding reste incomplet avant validation du restaurateur.

L’ancien accès par code e-mail ne doit jamais contourner un compte désormais protégé par mot de passe et second facteur. La récupération préserve le second facteur et révoque les anciennes sessions. L’inscription d’un propriétaire ne doit jamais changer les identifiants d’un compte déjà existant.

Les étapes d’authentification sont une machine à états côté serveur. Le navigateur ne peut ni déclarer son adresse vérifiée, ni choisir son rôle, ni créer une session par un état local. Les secrets ne sont jamais journalisés ni enregistrés dans GitHub. Le QR TOTP est produit localement dans le navigateur.

« Tout sélectionner » inclut les enjeux masqués par le +, sans ajouter stock/légal ou un besoin « Autre » non exprimé. La sélection de tous les enjeux ne fixe pas leur ordre. Les réponses vocales ou écrites complètent le profil avec leur provenance ; une interprétation ne devient pas un fait confirmé sans validation.

## Agent Accueil et Réservations

L’agent métier cible conduit toute la conversation avec les règles, connaissances et priorités de l’établissement. Il appelle des opérations contrôlées : disponibilités, création, modification, annulation, communication et notification. La prise d’une réservation ne dépend pas d’une chaîne obligatoire de sous-agents.

Des spécialistes pourront contribuer à l’analyse. L’orchestrateur choisit une compétence avec un délai et un résultat structuré. Une compétence indisponible ne doit pas interrompre les fonctions déterministes disponibles. Les agents de développement et les skills de Codex ne sont pas des agents métier déjà déployés.

Chaque opération porte le restaurant, l’auteur, une clé d’idempotence et une version. L’écriture métier et son événement doivent être atomiques. La reprise distingue échec certain et résultat externe ambigu. Un prestataire ayant accepté un message ne prouve pas sa réception par le client.

L’état de présence « Message envoyé / Confirmé / Annulé » est séparé de la réservation prise. Les horaires des rappels et personnes informées appartiennent aux règles du restaurant. WhatsApp, téléphonie, Zenchef et SevenRooms font partie de la prochaine construction annoncée par le fondateur ; ils ne sont pas certifiés dans cette livraison.

## Données et mémoire

| Donnée | Source et usage |
|---|---|
| Décisions du fondateur | Registre privé versionné `project_memory` |
| Logo, Stitch et références | Archive durable et catalogue avec empreintes |
| Profil, priorités et règles | Données isolées par restaurant, provenance et versions |
| Documents du + | Données privées de l’onboarding, téléchargement forcé |
| Réservations importées | Système autoritaire choisi, références et états de synchronisation dans Copilot |

Les documents sont enregistrés réellement, mais leur analyse automatique reste une capacité distincte à implémenter. Aucun fichier fourni ne doit être exécuté sur l’origine de l’application. Une migration ultérieure vers le stockage objet doit conserver autorisation, intégrité et suppression.

## Conditions de livraison

1. Revue produit et sécurité terminée, corrections intégrées, tests concernés et compilation réussis.
2. Code synchronisé dans GitHub, migrations appliquées seulement à la base Copilot cible, déploiement identifié par commit.
3. Parcours réel : inscription, e-mail reçu, second facteur, connexion, récupération, reprise d’onboarding, priorités et documents ; vérification ordinateur/mobile.
4. Preuves séparées pour tests locaux, données cloud, e-mails acceptés/reçus et recette navigateur. Aucun succès déduit du seul état READY.

Les limites restantes doivent être corrigées ou décrites précisément. Une dépendance à un accès utilisateur ou à un service absent ne doit jamais conduire à supprimer un contrôle. L’autonomie hors ligne et l’alimentation indépendante restent des objectifs à construire et tester.
