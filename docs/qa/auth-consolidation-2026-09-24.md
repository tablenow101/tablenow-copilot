# Authentification — consolidation et échec SMTP du 24 septembre 2026

## Cause établie

L'essai du propriétaire à 13:13 UTC atteint bien la Preview `c0bcad1fb297cb8c052769af0b6117110332be3c`, déploiement `dpl_AZzxxs49t7oXbKG3YHSXQDTbK8Bp`. Le journal serveur indique `EAUTH`, réponse SMTP `535`, commande `AUTH PLAIN`, puis POST signup 503 et GET continuation 204. Il s'agit d'un refus d'identifiant SMTP, pas d'un conflit de branches ni d'un refus de code TOTP. La première correction ne suffisait pas à restaurer l'envoi.

Le domaine Resend `tablenow.io` est vérifié et l'envoi activé. La clé dédiée antérieure existe encore, mais la valeur sensible Vercel est non relisible : impossible d'affirmer si elle était incorrecte, révoquée ou mal copiée. Une nouvelle clé `TableNow-Copilot-Preview-2026-09-24`, permission envoi et domaine unique, a été créée puis authentifiée avec succès sur le serveur SMTP officiel, TLS vérifié. Seul `SMTP_PASSWORD`, Preview / `product/onboarding-owner`, a été remplacé. L'ancienne clé et la clé du produit historique sont conservées. Aucune valeur secrète enregistrée dans ce rapport.

## Branches comparées après fetch

La branche distante `product/onboarding-owner` contient déjà tous les commits d'authentification des autres branches distantes. Comparaison des chemins connexion, inscription, récupération, Google, compte et transport e-mail : aucun commit d'authentification exclusif ailleurs.

| Référence | Résultat |
| --- | --- |
| `product/stitch-functional-owner` | Ancêtre déjà intégré ; checkout local avec travail non committé à préserver |
| `product/onboarding-final-experience` | Ancêtre déjà intégré |
| `main`, `archive/pilot-2026-08-23`, `event-driven-isolated-previews` | Ancêtres ; aucune correction d'authentification à reprendre |
| `delivery/readiness-truth-2026-09-09`, `codex-event-driven-preview-shadow-v1` | Divergences hors des chemins d'authentification |
| Trois branches Dependabot | Changements de dépendances/CI ; aucune correction d'authentification à reprendre |

Le stash antérieur contient notamment une ancienne présentation et une demande de nom qui contredisent le parcours validé, ainsi que du travail indépendant : il n'est pas réappliqué ni supprimé. Aucun merge artificiel, aucune nouvelle branche, aucune suppression. Le worktree détaché de dépannage ne constitue pas une branche Git. Les 281 fichiers suivis absents du checkout Preview ont été restaurés depuis son HEAD, seuls les chemins absents étant concernés, pour reprendre le checkout existant après la correction.

## Correction ciblée

La reprise après interruption conserve l'erreur d'origine quand aucune vérification n'avait commencé. Le formulaire initial ne demande plus de recommencer une vérification inexistante. Une vérification réellement commencée puis perdue demande toujours un redémarrage. Aucun envoi automatique ni rejeu de code ajouté ; saisie, expiration, limites d'essais et TOTP conservés.

## Preuves et limites

- Test de régression d'abord rouge, puis 13 tests ciblés de retour d'erreur, reprise et séparation des écrans réussis.
- Authentification SMTP de la nouvelle clé réussie, puis déploiement Preview `dpl_EmbjB9PWupNR854ZiT7UpQCXtiYq` READY, commit exact `d554eb5e956cb24190c83636752085aaeccda735`, alias `preview.tablenow.io` vérifié.
- Envoi réel déclenché depuis le parcours normal de connexion par code vers le destinataire autorisé à 13:29:30 UTC (15:29 Paris). L'interface affiche « Code reçu par e-mail ». Resend indique `delivered`, message `01a0d39b-5e9f-7248-9cfd-67e1412a0957`. Aucun code lu ni saisi par l'agent ; onglet laissé ouvert au propriétaire.
- Cette preuve valide le transport applicatif d'un code de connexion. La réception visible par le destinataire, sa saisie privée, l'inscription par lien, Google, TOTP et la reprise d'onboarding ne sont pas validés par cet essai. Confirmation demandée au propriétaire, encore attendue.
- Aucun compte créé, mot de passe modifié, facteur TOTP supprimé ou donnée métier de recette ajoutée pendant cette consolidation.
- Aucun changement de main, production, politique d'authentification ou design.
- Mémoire canonique inaccessible : le connecteur Neon rejette `project_id` malgré sa présence ; sauvegarde en attente. Les décisions sont consignées dans le dépôt.

Les branches obsolètes ne seront proposées à la suppression qu'après recette et validation explicite du propriétaire.

## Échec du code reçu — diagnostic suivant, 24 septembre à 15:35

L'envoi réussi ne validait pas la connexion. Le test avait été lancé à tort dans la connexion sans mot de passe pour une adresse sans compte, alors que l'objectif du propriétaire était l'inscription.

Lecture seule sur l'endpoint Preview autorisé `ep-rapid-leaf-zas11naf` : aucun utilisateur pour cette adresse ; challenge créé à 13:29:29 UTC, échéance 13:39:29, une seule tentative, consommation à 13:34:36. Le journal confirme un seul POST verify-email à 13:34:35, statut 400. Le code correspondait à la preuve : le chemin serveur le consomme après validation puis retourne la même erreur générique que pour une vérification indisponible quand le compte est absent. Ni expiration ni plafond d'essais atteint. Aucun code, hash ou secret n'a été lu dans cette requête.

Correction : après preuve d'adresse valide seulement, retourner `ACCOUNT_SIGNUP_REQUIRED`, terminer le challenge et effacer son cookie. L'interface affiche la cause réelle et un lien principal « S’inscrire », sans relance du code ni création automatique. Les demandes non prouvées et les mauvais codes ne révèlent toujours pas l'existence du compte. Le message générique ne prétend plus connaître une cause non établie.

Preuves : nouveau test de régression rouge (400 au lieu du résultat attendu), puis 12 tests API et 14 tests interface verts ; contrôles TypeScript API/console réussis. Recette navigateur locale sur base jetable : code valide d'une adresse inconnue → explication → S’inscrire → formulaire e-mail/mot de passe, sans ancienne erreur. Formats 390×844 et 1440×900, aucun appareil physique ni e-mail réel dans cette recette. Captures conservées dans `/private/tmp/tn-verified-signup-evidence`. Inscription réelle par lien et onboarding du propriétaire restent ouverts.
