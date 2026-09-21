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

## Preview réellement testée — commit cca7cdd

Déploiement `dpl_275zq3gRTxi7bKGr8W8Hvubqgjkx`, URL `tablenow-copilot-v2-lruswlpvg-tablenow101.vercel.app`, alias `preview.tablenow.io`, Preview READY sur `cca7cdd87cf1df5b80eebfdd99967ef95026d4d9`. Migrations 013 et 014 appliquées à 22:00:29 UTC le 21 septembre. Journaux : compilation réussie, test technique de base/session/workspace/CSRF réussi ; ce test injecté ne valide ni e-mail reçu ni Google/TOTP réel.

Classification en transaction des deux objets identifiés (tâche/document), après garde tenant/identité/date exacte : deux événements `acceptance_data.classified`. Les deux lignes sont conservées, contenu du document toujours chiffré présent ; zéro tâche et zéro document business dans ce restaurant. Une première garde a annulé l’opération car l’affichage ISO avait tronqué les microsecondes ; lecture du timestamp texte exact, puis transaction réussie. Aucune suppression.

Parcours navigateur, session propriétaire existante :
- Accueil : tâche QA absente et progression artificielle 1/1 supprimée ; prochain pas équipe cohérent avec priorité enregistrée.
- Ma configuration repliée, deux points restants ; lien Zenchef ouvre directement Connexions. « Voir la prochaine étape » affiche le bloqueur fournisseur et le lien officiel. Aucun raccordement réel prétendu.
- « Organiser mon équipe » atteint Équipe ; « Ajouter une action » ouvre le formulaire puis Annuler/Fermer conserve l’absence de nouvelle tâche. Aucun faux poste créé.
- Barre : saisie locale → repli → réouverture conserve exactement le brouillon ; aucun envoi automatique ; le brouillon de recette a été vidé sans être envoyé. Documents affiche les capacités et limites avant ajout. Le fichier QA n’est plus proposé.
- Clair/sombre observés à 390×844, 820×1180 et 1440×900.

| Viewport | Fin de contenu visible au bas du défilement | Début de barre | Débordement horizontal |
|---|---:|---:|---|
| 390×844 | 698,9 px | 739 px | absent |
| 820×1180 | 1033,0 px | 1073 px | absent |
| 1440×900 (barre repliée) | 804,2 px | 844 px | absent |

Hauteur réduite 390×350, panneau fichiers ouvert : barre193–340px, contenu117px de haut, commandes du panneau accessibles par son défilement ; aucun débordement horizontal. Cette simulation n’est pas une validation du clavier iOS/Android. Aucun appareil physique ou microphone n’a été testé.

Écart découvert en suivant Zenchef : deux conversations de recette des rapports précédents restent dans l’historique. Migration 015 et filtrage ciblé préparés ; ne pas classer les messages utilisateur « Test » ou « Ça ne fonctionne pas » par ressemblance. Les dialogues métier restent conservés.

Captures de la version réellement déployée : [avant mobile](livraison-guidee-2026-09-22/dashboard-avant-mobile.png), [après mobile sombre](livraison-guidee-2026-09-22/dashboard-apres-mobile-sombre.png), [après mobile clair](livraison-guidee-2026-09-22/dashboard-apres-mobile-clair.png), [bas de page mobile](livraison-guidee-2026-09-22/dashboard-mobile-fin.png), [tablette sombre](livraison-guidee-2026-09-22/dashboard-tablette-sombre.png), [tablette claire](livraison-guidee-2026-09-22/dashboard-tablette-clair.png), [ordinateur sombre](livraison-guidee-2026-09-22/dashboard-ordinateur-sombre.png), [ordinateur clair](livraison-guidee-2026-09-22/dashboard-ordinateur-clair.png). Le profil garde le plan détaillé et les faits confirmés ; reformulation des deux anciens textes observée, sans modification du plan enregistré.

Extension 015 : 35 tests ciblés réussis, typecheck API vert, revue indépendante sans défaut actionnable. Test de classement pendant une réponse modèle : aucune nouvelle réponse/message métier réintroduit. La classification des deux conversations identifiées reste à exécuter après publication ; aucun autre message utilisateur ne sera classé.
