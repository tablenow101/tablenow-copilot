# Livraison guidée et intégrations — 21 septembre 2026

## Périmètre autorisé

Instruction complète du propriétaire (pièce jointe defa6f1a-472f-41ab-bb8a-b7529326f7c6), puis extension explicite à tous les outils cités. Branche `product/onboarding-owner`, point de départ propre `ba192c4e520a7957c0dbbefe53321c243611f45d`. Travail existant de la copie principale conservé. Main et production exclus. Aucune restauration supplémentaire : les chemins absents avaient déjà été restaurés.

Mémoire canonique : registre PostgreSQL stable, enregistrement 100 version 8, supersedes 99, ajouté puis relu. Aucune décision fonctionnelle n’est déduite d’une branche Preview.

## Plan exécuté, sans nouvelle architecture générale

1. Réutiliser les comptes, les facteurs TOTP et les défis existants. Ajouter une récupération explicite des codes de secours depuis une session authentifiée et un TOTP frais ; sécuriser le cas réponse perdue, sans modifier l’enrôlement.
2. Réutiliser les six étapes et les réponses existantes. Même barre partagée dans onboarding/cockpit ; une conversation ne modifie plus implicitement des champs métier. Compléments éditables, confirmables et supprimables individuellement.
3. Étendre le parcours des connexions à tous les outils réellement déclarés, avec procédures officielles et bloqueurs exacts. Ajouter OpenTable et Messenger de façon additive aux réponses autorisées ; aucune migration de données nécessaire.
4. Enrichir l’adaptateur IA déjà prévu avec contexte, historique isolé et documents explicitement sélectionnés. Extraire réellement le texte UTF-8 ; ne pas annoncer d’analyse pour PDF/images sans capacité disponible. Ne pas choisir un nouveau fournisseur payant.
5. Préserver le payload exact des conversations pour les réessais après rechargement : migration additive 013, métadonnées documents/étape uniquement, anciennes lignes intactes, retour arrière documenté. Une simple clé sans ses paramètres provoquait un conflit de reprise.
6. Tests ciblés, revue indépendante, build, Preview et parcours réel. Appareils physiques et saisies privées dans une séance préparée avec le propriétaire. Les contrôles automatiques ne clôturent aucun lot produit.

## Ce qui est conservé

Google, authentification par e-mail, TOTP et anti-rejeu, Google Places, brouillons serveur, réponses historiques, sauvegarde/reprise, premier résultat, fonctions cockpit, documents privés, langues FR/EN et thèmes. Aucun changement de politique MFA, aucune bascule passkey implicite, aucune nouvelle dépendance. La sélection des connexions est une projection pure des réponses ; elle ne déclare jamais une connexion vérifiée.

## Raccordements : prérequis officiels et travail restant

Vérification du 21 septembre : variables Preview globales et branche inspectées par noms uniquement. Aucun accès partenaire logiciel ni configuration IA présent. Base Preview : aucune connexion fournisseur réellement vérifiée. Les accès Google de connexion à TableNow et SMTP des codes de compte ne donnent pas accès aux calendriers ou boîtes mail du restaurateur.

| Outil | Procédure / accès officiel | À fournir ou terminer | État réel |
|---|---|---|---|
| Zenchef | [API officielle](https://help.zenchef.com/hc/en-gb/articles/27690768125597-Zenchef-API), offre compatible ou accord spécifique ; docs sur demande | Accès partenaire TableNow, documentation privée, restaurant de test autorisé ; implémentation après contrat API vérifié | BLOCKED_EXTERNAL — guidage disponible, adaptateur non implémenté |
| SevenRooms | [Documentation](https://api-docs.sevenrooms.com/) à accès individuel, [demande partenaire](https://sevenrooms.com/partnership-opportunities/) | Documentation, identifiants dédiés, droits sur établissement | BLOCKED_EXTERNAL — guidage disponible, adaptateur non implémenté |
| TheFork | [Pré-requis](https://docs.thefork.io/preliminary-steps) : POS/Partners X-Api-Key, B2B client_credentials ; pas de faux OAuth utilisateur universel | Confirmer le produit API autorisé, identifiants dédiés et périmètre restaurant | BLOCKED_EXTERNAL — guidage disponible, adaptateur non implémenté |
| OpenTable | [Programme partenaire](https://www.opentable.com/restaurant-solutions/api-partners/become-a-partner/) | Approbation, API/documentation contractuelle, identifiants et restaurant de test | BLOCKED_EXTERNAL — sélection et guidage disponibles, adaptateur non implémenté |
| Google Calendar | [Scopes officiels](https://developers.google.com/workspace/calendar/api/auth) ; consentement distinct de Google Sign-In | Application/consentement agenda autorisés, scopes minimaux, stockage des jetons, callback dédié, test liste/lecture | NOT_IMPLEMENTED — guidage disponible, accès externe requis avant recette |
| Outlook | [Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/user-list-calendars?view=graph-rest-1.0), lecture minimale de calendriers | App Entra dédiée, consentement, jetons et test sur agenda autorisé | NOT_IMPLEMENTED — guidage disponible, accès externe requis avant recette |
| Caisse / autre logiciel | Nom exact conservé, aucune marque inventée à partir des réponses | Identifier API officielle du logiciel réellement déclaré, partenariat éventuel, permissions et compte de test | BLOCKED_PROVIDER_UNKNOWN |
| WhatsApp / Instagram / Messenger | Application métier Meta ; documentation technique détaillée non récupérable à ce contrôle (429) | Accès Meta, documentation accessible, app/permissions et revue adaptées, comptes métier de test ; aucun endpoint privé inventé | NOT_IMPLEMENTED — guidage explicite |
| E-mail | Le transport SMTP TableNow existant envoie les messages de compte, pas un accès aux mails restaurant | Fournisseur de boîte et consentement distinct à définir ; droits minimaux | BLOCKED_PROVIDER_UNKNOWN |
| SMS / téléphone | Aucun prestataire activé | Fournisseur, numéro, permissions, éventuel coût à autoriser | BLOCKED_EXTERNAL |
| Manuscrit / aucun outil / hybride | Organisation déclarée, aucun raccordement imposé | Continuer avec ses réponses ; enrichir plus tard | Fonctionnement conservé, pas un connecteur |

La préparation de ces fichiers n’est pas une intégration fonctionnelle. Aucun bouton ne doit prétendre lancer OAuth quand le fournisseur impose un partenariat. Le panneau « Voir la prochaine étape » ouvre réellement les prérequis, puis une source officielle ou la correction des outils. Il n’envoie aucune demande partenaire et n’expose aucun secret.

## Contrat commun d’une connexion réelle, avant activation

- Identifier le fournisseur, l’environnement Preview, le restaurant et les permissions accordées côté serveur.
- Démarrer une autorisation depuis l’app ; état lié à session/utilisateur/restaurant, anti-CSRF et anti-rejeu ; jetons chiffrés côté serveur, jamais dans le navigateur ni les logs.
- Statuts persistants : à connecter → autorisation en cours → à tester → connecté → à reconnecter. « Connecté » exige une lecture distante autorisée réussie et son horodatage ; une déclaration ou un jeton stocké ne suffit pas.
- Distinguer connexion vérifiée et première synchronisation. Zéro élément réellement lu est un résultat valide distinct d’un échec.
- Retenter de façon idempotente ; une indisponibilité ne détruit pas les réponses ni les anciennes données. Révocation/expiration = à reconnecter.
- Isolation par tenant, restaurant et rôle. Vérifier permissions refusées, mauvais établissement, expiration, révocation, doublon et échec réseau avant activation.
- Aucun envoi/message/réservation/commande externe depuis un conseil sans confirmation de l’action.

Ce contrat ne prétend pas que la machine d’état ou les adaptateurs absents existent déjà. Leur implémentation et la recette distante restent ouvertes.

## IA et documents

Configuration sécurisée attendue dans Vercel Preview uniquement : fournisseur compatible déjà autorisé, `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` si nécessaire, et budget autorisé. Aucune valeur secrète dans ce document. Ne pas utiliser la clé d’un autre projet sans autorisation de périmètre. La configuration d’un prestataire payant nécessite l’accord correspondant.

TXT UTF-8 : extraction réelle limitée et tronquage annoncé. PDF/PNG/JPEG : stockage existant, extraction non implémentée. La réponse générative et l’analyse sémantique restent bloquées sans modèle réel ; un conseil déterministe n’est pas une conversation IA. Les mesures fournisseur absentes valent `null`, jamais zéro inventé. Le garde-budget existant reste une estimation, pas une garantie de plafonnement de la facture.

## Portes de livraison

Voir le [rapport de recette](../qa/livraison-guidee-integrations-2026-09-21.md). Ne pas annoncer « 100 % fonctionnel » ou diffuser à des bêta-testeurs comme une version terminée tant que les raccordements, IA réelle, parcours privé et téléphone physique manquent. Aucune promotion main/production.

## Correction de l’accueil demandée après la première capture

La capture du 21 septembre est une preuve de défaut, pas une référence graphique. Le storyboard validé reste prioritaire. Séparer les données de recette, la configuration restante et la préparation métier. Une seule prochaine action s’appuie sur la priorité déclarée ; chiffres visibles, configuration compacte et ouvrable, plan détaillé conservé dans Profil. Retirer les formulations de développement exposées au restaurateur.

Données de recette identifiées par preuve, et non par heuristique de titre :

- Tâche `9f185bd2-c4fc-437d-838f-a43765c52fd7`, créée le 19 septembre à 05:19:02 UTC, « Recette TableNow — vérifier le cockpit clair et sombre ». Sa création puis son achèvement sont consignés dans `docs/qa/pilote-aujourdhui-2026-09-19.md`, point 5.
- Document `1d7cc327-9caf-4e03-9b2d-7cd573ba5bfc`, créé le 21 septembre à 20:40:19 UTC, `document-recette-tablenow.txt`, 168 octets. Sa création est consignée dans `docs/qa/parcours-guide-2026-09-21.md`.
- Le document QA du 19 septembre n’est plus présent sous son nom exact à la lecture Preview ; aucune action déduite. Aucun autre objet métier artificiel prouvé dans ces rapports.

Migration additive 014 : origine `business` par défaut ou `acceptance_test`, sur tâches et documents. Les lignes existantes restent business tant qu’une preuve spécifique ne justifie pas leur classification. Filtrage au serveur des listes, compteurs dérivés, contexte conseiller et mutations métier ; aucune suppression. Deux objets identifiés seront classifiés explicitement dans la seule Preview, avec audit. Une tâche métier ayant le même titre reste visible : testé. Toute future recette qui crée des activités devra utiliser un périmètre de test identifié, sans polluer le restaurant du propriétaire.

Mémoire canonique : 101 v9, supersedes 100, ajoutée puis relue.
