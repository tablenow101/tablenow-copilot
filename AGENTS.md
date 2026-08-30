# Règles permanentes de TableNow V2

Avant toute intervention, lire `context/CONTEXT.md`, puis le `CONTEXT.md` du dossier concerné.

## Frontières absolues

1. Ne jamais modifier TableNow V1, `app.tablenow.io`, les dépôts historiques ou leur base.
2. Ne jamais modifier le site marketing depuis ce dépôt.
3. Ne jamais connecter V2 à une URL de base, un secret ou un domaine appartenant à V1.
4. PostgreSQL V2 est l'unique source de vérité du produit ; aucun double-write n'est autorisé.
5. Toute ressource externe, payante, destructive ou exposée publiquement exige une autorisation explicite du propriétaire.
6. Ne jamais afficher, journaliser ou committer une valeur secrète.

## Manière de travailler

- Expliquer chaque étape au propriétaire en une phrase française courte.
- Signaler immédiatement un blocage avec sa cause exacte et l'action nécessaire.
- Ne jamais présenter une simulation comme une action réelle.
- Maintenir une qualité égale sur ordinateur et mobile.
- Prévoir les restaurants avec logiciel, calendrier, papier ou fonctionnement hybride.
- Préférer les fonctions TableNow et les API officielles ; Computer Use n'est qu'un recours contrôlé.
- Mettre à jour `context/11-status/` et `context/10-decisions/decision-log.md` après toute décision ou modification matérielle.
- Conserver les détails techniques dans `docs/` et la synthèse compréhensible dans `context/`.

## Vérification minimale

Avant livraison : vérifier le diff, les tests concernés, les liens de documentation, les secrets, l'isolation V1/V2 et les parcours ordinateur/mobile touchés.
