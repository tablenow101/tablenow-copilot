# Recette — livraison guidée et intégrations, 21 septembre 2026

État : en cours, aucune clôture produit. Plan et procédures : [contrat](../product/livraison-guidee-integrations-2026-09-21.md).

## Preuves locales déjà obtenues

- 23 tests API récupération/comptes/Google réussis ; 13 tests helpers UI récupération/feedback réussis.
- 25 tests API ciblés conversation/documents/opérations réussis ; 4 tests adaptateur modèle réussis.
- 105 tests console réussis avant les derniers ajouts du catalogue ; 8 tests catalogue/checklist réussis.
- Typechecks API/console et compilation contrats réussis ; revue sécurité indépendante de la récupération sans défaut actionnable.
- Limitation de requêtes : défaut HTTP 500 identifié par test ; mapping corrigé en 429 sans exposer l’erreur brute. Protection existante conservée.

Ces ensembles se recoupent : ne pas additionner leurs nombres comme un total de tests uniques. Résultats consolidés et Preview seront consignés après exécution.

## Critères encore ouverts

| Exigence | État à ce point |
|---|---|
| Google/e-mail/TOTP nouveau compte et changement d’app sur un seul téléphone | NOT_RUN — séance privée avec propriétaire nécessaire |
| Remplacement/réception des codes de secours sur compte réel | NOT_RUN — aucune rotation réelle faite par l’agent |
| Six étapes, sauvegarde, reprise, compléments, synthèse, premier résultat | Tests ciblés locaux verts ; recette du nouveau build en attente |
| Conversation libre IA | BLOCKED_EXTERNAL — aucun modèle configuré en Preview |
| TXT extrait | Tests réels de contenu/isolation verts ; Preview en attente |
| Analyse sémantique de fichier | BLOCKED_EXTERNAL pour TXT ; NOT_IMPLEMENTED pour extraction PDF/images |
| Dictée progressive / niveau sonore | Tests session verts ; microphone réel et téléphone physique NOT_RUN |
| Tous fournisseurs raccordés | BLOCKED_EXTERNAL / NOT_IMPLEMENTED selon matrice ; aucune connexion réelle annoncée |
| UI sombre/claire ordinateur/tablette/téléphone | Nouveau build Preview à vérifier ; viewport ≠ appareil physique |
| Main / production | Hors périmètre, aucune modification autorisée ici |

## Revue et corrections avant publication

- Erreur 429 auparavant convertie en 500 : classification corrigée, limite conservée.
- Reprise après rechargement : préserver métadonnées documents/étape et ancien format ; migration additive 013, 15 tests conversation/migrations réussis. Aucune réponse historique réécrite.
- Liens juridiques du nouvel écran de codes de secours : nouvel onglet pour ne pas perdre la copie privée non confirmée.
- Retour Priorités accessible depuis la recherche d’établissement ; notes proposées visibles dans la synthèse avec statut distinct, sans confirmation automatique.
- Réponses réseau bornées et réconciliation d’état ; sélection document protégée contre un changement d’établissement pendant la lecture.

Première consolidation : 125 tests API réussis, 4 tests externes PostgreSQL ignorés ; contrats 12/12 ; build Core API et Next réussis. Ces contrôles ont précédé le correctif de reprise et ne remplacent pas sa validation finale.

## Consolidation finale locale avant Preview

- API : **128 réussis, 4 ignorés** (`vitest run src --maxWorkers=2`). Une exécution précédente fortement parallèle a dépassé le délai de 5 s sur le hachage de mot de passe ; relance complète avec deux workers verte, aucune réduction du coût cryptographique ni modification du test.
- Console : **114 réussis**, typecheck vert. Contrats : **12 réussis**, build vert. Adaptateur modèle : **4 tests ciblés réussis**.
- Core API : build/typecheck verts. Next : build final réussi et route `/account/security` générée.
- Diff contrôlé ; revue indépendante des parcours de récupération et de reprise. Aucun secret réel ajouté ni nouvelle dépendance.
- Baseline Preview avant migration : 4 utilisateurs, 1 enrôlement de compte, 1 brouillon, 4 demandes Copilot. Ces comptes ne sont ni modifiés ni supprimés par la migration 013.
- Main distante vérifiée inchangée : `665ca205111c7937b1e7507137e0af2b3c161c54`.

Le commit à suivre est une sauvegarde de travail testée pour Preview, pas la clôture d’un lot ni une validation produit.

## Défauts signalés dans la capture de l’accueil

Verdict de la capture initiale : `WRONG_FLOW`. Tâche de recette affichée comme activité, statut ambigu, configuration mêlée au service et prochaines actions répétées. Migration 014 et correction ciblée de composition préparées ; la capture ne devient pas une nouvelle direction artistique. Classification explicite des deux objets QA en Preview et vérification de leur disparition des compteurs à exécuter après migration. Pas de suppression.

## Contrôles de la correction ciblée de l’accueil

- Origine explicite : 35 tests ciblés tâche/fichiers réussis ; une activité métier portant le même nom qu’une recette reste visible et modifiable. Migration 014 préserve les lignes et les contenus chiffrés.
- API complète : 131 réussis, 4 ignorés et une assertion de texte anglais à mettre à jour après suppression du vocabulaire technique. L’assertion a été adaptée au nouveau texte utile ; les 20 tests onboarding passent ensuite. Ce résultat est distinct d’une exécution complète intégralement verte.
- Revue indépendante : deux liens vers `/inventory` (route inexistante) remplacés par le plan conservé dans Profil ; tests vérifient les routes réellement admises et l’ancre cible. Les recommandations historiques personnalisées sont préservées ; seuls les anciens libellés exacts sont reformulés.
- Réserve du dock ajustée à la hauteur visuelle disponible, notamment lorsque le clavier réduit la fenêtre ; téléphone physique non vérifié.
- Rendu Next compilé avant ces deux dernières retouches ; nouvelle compilation Vercel attendue avant toute déclaration de livraison.

Contrôle final après ces corrections : **132 tests API réussis, 4 ignorés** ; **125 tests console réussis** ; typechecks API/console et build API réussis. Les tests ignorés exigent un PostgreSQL externe dédié ; ils ne sont pas présentés comme réussis.

Après libellé de raccordement explicite dans la checklist : 22 tests ciblés catalogue/checklist/accueil réussis. Dock : borne 42 % de `--tn-viewport-height`, cohérente avec la hauteur du shell, au lieu de 42dvh indépendant du clavier. Validation navigateur encore attendue.
