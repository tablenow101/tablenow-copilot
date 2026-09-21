# Parcours guidé — reprise du 21 septembre 2026

Statut : corrections déployées, recette partielle ; aucun lot clôturé. Branche `product/onboarding-owner`, base `543c47fd2451eaca7716c3c3e33e0e579511e7c4`. Référence distante de `main` : `665ca205111c7937b1e7507137e0af2b3c161c54`. Aucune promotion autorisée. Le 21 septembre, Vercel confirme que `preview.tablenow.io` sert exactement cette base, déploiement `dpl_ALSusSfUDgSrxCo3X9B9h7UXeHrL`, READY. Ce statut ne certifie pas le parcours.

## Restauration ciblée vérifiée

Le contrôle Git initial trouvait 60 fichiers suivis absents. Aucun checkout partiel, bit skip-worktree, rebase, merge ni verrou Git en cours. HEAD et origine étaient identiques. Après autorisation du propriétaire : sauvegarde du diff et des documents locaux, puis `git restore --source=HEAD --worktree --pathspec-from-file=/private/tmp/tn-missing-tracked-files --pathspec-file-nul`. Les 60 chemins sont restaurés ; les SHA-256 des 316 fichiers suivis déjà présents sont inchangés. Les modifications locales et le rapport non suivi sont préservés. Sauvegarde privée locale : `/private/tmp/tn-before-targeted-restore-20260921/`. Dépendances restaurées depuis le lockfile figé, sans nouvelle dépendance.

## Diagnostic ciblé établi

- Preview accessible dans le navigateur de cette session, puis session propriétaire reprise automatiquement jusqu'au dashboard. Cela ne prouve pas l'accès d'un autre testeur derrière la protection Vercel.
- `/decisions` affiche réellement « Tout est clair pour le moment » avec zéro décision. Capture avant correction à 390 × 844. Ce n'est pas une preuve d'évaluation des données.
- L'enrôlement présente le QR en premier et cache les instructions manuelles. Le collage complet et `inputMode=numeric` existent déjà : les préserver.
- La continuation serveur existante couvre Google. Une inscription par e-mail perd l'étape visible après rechargement ; la reprise doit lire le défi HttpOnly existant sans prolonger sa durée ni réémettre un secret différent.
- Le TOTP expiré possède déjà un code HTTP 410, mais le code e-mail expiré et le code incorrect aboutissent encore au même refus générique. Les limites de tentatives, la protection contre réutilisation et les contrôles d'origine doivent rester inchangés.
- L'onboarding possède huit sections internes regroupées visuellement en six. La caisse et les connexions ne constituent pas encore deux étapes explicites. La normalisation actuelle supprime des réponses de branches inactives : ne pas l'utiliser pour migrer les données historiques.
- La première synthèse métier est réellement persistée. La réutiliser ; ne pas créer un deuxième moteur de recommandations ni attribuer aux données restaurant un conseil général.
- Les fichiers sont stockés de façon privée ; aucune analyse n'est implémentée. Cette limite doit être annoncée avant le choix du fichier, avec des états de transfert et une issue explicite.

## Séquence de correction autorisée

1. TOTP sur un téléphone : instructions visibles, clé copiable, QR secondaire, aucune donnée sensible dans les captures ; reprise depuis le défi serveur encore valide, erreurs distinctes et requêtes bornées.
2. Conservation avant réorganisation : correspondance explicite des huit sections historiques vers six groupes visibles, sans migration SQL inutile ; tests neuf/partiel/terminé et changement de priorité sans perte. Les configurations secondaires restent reportables.
3. Systèmes déclarés et connexions honnêtes, checklist déterministe et premier conseil dont la provenance est explicitée.
4. États vides et pièces jointes : messages exacts, action suivante, conservation du texte, délai borné et résultat inconnu distingué d'un échec certain.
5. Recette sur Preview : nouveau compte → TOTP privé → configuration → première valeur → reprise, puis clavier, dictée et fichiers. Aucun test sur viewport ne sera présenté comme test sur téléphone physique.

## Verdicts actuels

- Défaut d'état vide : reproduit sur Preview (`WRONG_FLOW`).
- Parcours neuf complet : `NOT_RUN`.
- TOTP et bascule vers une application sur un téléphone physique : `NOT_RUN`.
- Authentification Google/e-mail et protections : tests HTTP/PGlite réussis ; nouveau parcours réel déployé encore `NOT_RUN`.
- Présentation 8 → 6 sans migration SQL : implémentée et testée localement ; conservation vérifiée sur trois profils.
- Premier déploiement des corrections : `3436270e56d145283245275138725dc8f59ae44c`, `dpl_5GW4j4sXwTu7VbWSZLB3NoYygQKa`, READY sur Preview. Correctif de préférence en préparation.

Aucune clôture de lot ni certification produit ne découle de ce rapport. Les décisions de configuration progressive ont été enregistrées et relues dans la mémoire canonique : enregistrement 99, version 7 du design system, succédant à 98.

## Diff fonctionnel préparé

- Authentification : la continuation lit le défi HttpOnly encore valide, pour inscription/e-mail, connexion, récupération et Google ; elle n’envoie aucun e-mail, ne renouvelle pas le délai et ne change pas le facteur TOTP. Le frontend ne reprend que le parcours demandé. Une réponse perdue entraîne une relecture session/défi avant un nouveau POST.
- TOTP : clé copiable et trois instructions visibles sur un téléphone ; QR pour autre appareil dans un volet secondaire. Clavier numérique, champ accessible unique, collage complet et code de secours conservés. Erreurs code incorrect / expiré / vérification indisponible / réseau ou serveur distinguées.
- Réponses : projection active pour le calcul et conservation intégrale des anciennes réponses en base. Ajout facultatif de `presentationStep` et de la caisse déclarée dans le JSON existant, sans migration SQL ni changement de schemaVersion.
- Navigation : six groupes visibles, réglages secondaires dans Compléments et connexion reportable. Les déclarations ne deviennent jamais des connexions vérifiées. La navigation d’un profil terminé préserve la révision métier et son premier résultat.
- Cockpit : checklist déterministe issue des réponses sauvegardées ; conseils généraux explicitement séparés des résultats issus des réponses du restaurant. L’absence de décision ou réservation enregistrée n’est plus présentée comme preuve que toute l’activité est connue.
- Documents : panneau d’information avant sélection, stockage privé sans analyse annoncé, délais bornés ; réponse perdue = résultat inconnu avec relecture, sans réenvoi automatique.
- Identité : actifs officiels inchangés et non tronqués ; logo noir sur clair, citron sur sombre. Aucun nouveau composant décoratif ou dépendance.

## Correspondance des huit sections historiques

| Clé conservée | Groupe visible | Conservation / confirmation |
|---|---|---|
| `priorities` | Priorités | Réponses conservées ; priorité explicite. |
| `establishment` | Établissement | Confirmation de l’identité maintenue. |
| `interaction` | Compléments, préférences | Historique conservé ; report ne vaut pas confirmation. Un ancien brouillon arrêté ici reprend sur Systèmes avant les compléments. |
| `reservations` | Systèmes utilisés | Réservations conservées ; caisse ajoutée facultativement. |
| Aucune ancienne clé convertie | Connexions | Métadonnée de présentation ; aucune confirmation historique transformée en connexion. |
| `operations` | Compléments, fonctionnement | Branches inactives préservées, seules les réponses pertinentes alimentent le résultat. |
| `authority` | Compléments / validation en synthèse | Rôle serveur et accord explicite conservés. |
| `final_note` | Compléments | Notes et propositions conservées ; aucune proposition non confirmée transformée en fait. |
| `review` | Synthèse | Conditions, cadre de validation et premier résultat persisté conservés. |

### Conservation et retour arrière

Aucune transformation de masse n’est nécessaire : les huit clés métier, les anciennes réponses et la version de schéma restent en place. Les champs de présentation et de caisse sont facultatifs. Le retour arrière doit conserver ces champs additifs dans le contrat de lecture : redéployer aveuglément l’ancien schéma strict rejetterait les nouveaux champs. Pour retirer la nouvelle présentation, conserver son lecteur compatible et ignorer la métadonnée ; ne supprimer aucune réponse.

### Vérifications techniques déjà exécutées

- Tests HTTP/PGlite authentification : 17/17, reprise signup/email/enroll, login/reset/Google, absence de clé TOTP existante dans la continuation, pas d’e-mail ajouté par une lecture, délais et anti-rejeu conservés.
- Tests PGlite repository onboarding : 3/3, profils neuf, partiel, historique terminé. Navigation des six groupes sans changement de la révision finalisée, du résultat, des confirmations ni de la date de finalisation.
- Tests pièces jointes : 6/6, réponses perdues, timeout, refus, absence de double envoi automatique.
- Le contrôle TypeScript console passe. Compilation et recette déployée en cours ; ces contrôles ne prouvent pas l’usage sur un téléphone physique.

Le conseil général de briefing reprend une pratique d’un [guide professionnel Lightspeed](https://www.lightspeedhq.fr/blog/20-conseils-rapides-pour-optimiser-la-productivite-de-votre-restaurant/), publié le 12 avril 2022 et consulté le 21 septembre 2026. Il n’est présenté ni comme étude scientifique, ni comme diagnostic restaurant, ni comme gain mesuré.

### Contrôles finaux avant le point de contrôle Preview

- API : 109 tests réussis, 4 intégrations PostgreSQL externes ignorées faute de `INTEGRATION_DATABASE_URL` ; exécution avec deux workers, 30,56 s. Le timeout crypto observé lors d’une exécution sous forte concurrence ne se reproduit pas.
- Console : 87 tests réussis, 1,63 s.
- Contrats : 12 tests réussis.
- Typechecks API/console et compilation Next : réussis. `git diff --check` : réussi.
- Les quatre tests de persistance repository incluent en plus le refus de propositions non confirmées lors du passage groupé vers la synthèse.
- La continuation en lecture possède un budget de 30 lectures/15 min ; les limites de soumission des codes, les cinq essais par défi, le verrouillage du compte et l’anti-rejeu restent inchangés.
- Limite résiduelle connue : si la réponse du premier MFA est perdue après création de la session, les codes de secours à usage unique ne peuvent pas être réaffichés. L’interface confirme la connexion, indique cette perte et n’invente pas leur récupération. L’application TOTP reste active.

## Correctif de reprise des préférences

La relecture PGlite reproduit trois défauts : choix vocal explicite perdu, préférence reportée confirmée sans choix, préférence utilisateur antérieure écrasée à la finalisation. Cause : la sauvegarde dépendait du franchissement de l’ancienne section `interaction`, et la finalisation forçait toujours sa confirmation. Les deux écritures utilisent désormais `preferredModeConfirmed`, issu du choix explicite. Les trois nouveaux tests échouent avant correction et réussissent après ; les sept tests de persistance passent (5,79 s), ainsi que le typecheck API. Aucune migration ni modification d’enrôlement.

## Premiers essais déployés

Sur `3436270`, session existante : cockpit, conseil général avec source et limites, checklist issue des réponses (Zenchef déclaré, connexion non vérifiée, caisse à préciser). Préparer le briefing remplit la barre sans envoyer ; clic explicite sur la flèche produit une réponse, conservée après rechargement. Limite produit visible : synthèse déterministe, IA non configurée ; cela ne valide pas un Advisor conversationnel complet. Essais neuf/physique restent à effectuer.

### Défaut de position reproduit dans le navigateur

Sur Preview, ouvrir Systèmes depuis Décisions → Continuer → Connexions → recharger ramenait à Systèmes ; Continuer pouvait ensuite rester sans effet car la base avait déjà enregistré Connexions. Les réponses métier étaient conservées. Correctif : synchroniser l’adresse avec la section et le groupe uniquement après sauvegarde réussie ; appliquer aussi le groupe déjà persisté quand aucune écriture n’est nécessaire. Aucun rechargement de page ni migration. Treize tests ciblés storyboard/boundary et typecheck passent. La reproduction réelle sera rejouée après déploiement.

### Documents et affichage vérifiés

Un fichier texte fictif `document-recette-tablenow.txt` a été ajouté sur Preview : explication stockage privé/sans analyse avant le sélecteur, transfert, confirmation « Document enregistré. Aucune analyse effectuée. », puis document retrouvé après navigation. Il reste dans le compte de recette, aucun fichier existant supprimé. Barre repliée/réouverte et navigation mobile vérifiées. Largeurs navigateur 390 et 820 px sans débordement ; ce ne sont pas des appareils physiques.
