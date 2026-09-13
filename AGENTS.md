# Règles permanentes de TableNow Copilot

Avant toute intervention, lire `context/CONTEXT.md`, puis le `CONTEXT.md` du dossier concerné.

## Mémoire canonique du fondateur

Avant tout travail produit, consulter `project_memory.current_records` dans PostgreSQL Copilot : projet `aged-haze-01205441`, branche stable `br-orange-cherry-zadw6u1y`, base `neondb`. Les validations consolidées du 12 septembre 2026 y sont enregistrées ; elles priment sur les anciennes interprétations contradictoires de ce dépôt. Le chemin `00-LIRE-DABORD.md` décrit la structure et le protocole. Chaque validation explicite doit être ajoutée comme nouvelle version, avec source et lien `supersedes`, puis relue avant d'annoncer sa sauvegarde. Ne pas considérer une branche Preview comme la mémoire canonique. En cas d'indisponibilité, signaler la sauvegarde en attente.

Les fichiers de référence sont conservés dans l'archive `TableNow-Memoire.zip`, identifiant durable `libfile_772c0c6074f88191877e4433b3ad9a85`, indexée dans le même registre. Les dossiers et skills décrivent des compétences de conception ; ils ne prouvent pas l'existence d'agents métier déployés.

## Frontières absolues

1. Modifier uniquement ce dépôt et les ressources cloud explicitement dédiées à TableNow Copilot.
2. Ne jamais modifier un autre produit, domaine, dépôt ou système depuis ce dépôt.
3. Ne jamais connecter Copilot à une base, un secret ou un domaine non approuvé.
4. PostgreSQL Copilot est l'unique source de vérité ; aucun double-write n'est autorisé.
5. Toute ressource externe, payante, destructive ou exposée publiquement exige une autorisation explicite du propriétaire.
6. Ne jamais afficher, journaliser ou committer une valeur secrète.

## Manière de travailler

- Expliquer chaque étape au propriétaire en une phrase française courte.
- Signaler immédiatement un blocage avec sa cause exacte et l'action nécessaire.
- Ne jamais présenter une simulation comme une action réelle.
- Maintenir une qualité égale sur ordinateur et mobile.
- Prévoir les restaurants avec logiciel, calendrier, papier, aucun outil ou fonctionnement hybride.
- Préférer les fonctions TableNow et les API officielles ; Computer Use n'est qu'un recours contrôlé.
- Mettre à jour `context/11-status/` et `context/10-decisions/decision-log.md` après toute décision ou modification matérielle.
- Conserver les détails techniques dans `docs/` et la synthèse compréhensible dans `context/`.

## Test produit obligatoire en conditions réelles

- Les tests unitaires, intégration et E2E ne suffisent jamais à valider un parcours utilisateur.
- Après toute modification visible ou opérationnelle, tester le parcours réellement dans un navigateur sur une version déployée ou un environnement équivalent.
- Jouer le rôle du restaurateur ou du membre d'équipe concerné, sans raccourci développeur ni connaissance implicite du système.
- Tester le scénario métier complet, pas uniquement l'écran modifié.
- Vérifier desktop et mobile lorsque le parcours est pertinent sur les deux.
- Capturer les étapes clés, erreurs, blocages, hésitations et incohérences métier.
- Un parcours qui fonctionne techniquement mais dont le modus operandi est mauvais doit être marqué `WRONG_FLOW` et repensé avant livraison.
- Lire et appliquer `context/09-pilot/real-world-user-testing.md` pour le protocole complet.

## Vérification minimale

Avant livraison : vérifier le diff, les tests concernés, les liens de documentation, les secrets, l'isolation des ressources et les parcours ordinateur/mobile touchés.

Pour tout parcours utilisateur modifié, ajouter en plus une preuve de test grandeur nature et son verdict produit.
