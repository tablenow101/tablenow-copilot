# Non-négociables

- V1 reste intacte jusqu'à une migration séparée, répétée et réversible.
- Le site marketing reste un projet séparé de V1 et de V2.
- V2 possède une base PostgreSQL indépendante et unique par environnement.
- Aucun double-write entre deux backends n'est autorisé pendant le pilote.
- Les secrets ne sont jamais copiés depuis V1, affichés ou commités.
- Chaque restaurant est isolé techniquement des autres.
- Les actions financières, juridiques, sociales ou destructives exigent une validation humaine.
- Une action Copilot inconnue échoue en mode fermé : elle est bloquée, pas devinée.
- Les parcours critiques sont testés sur ordinateur et mobile avant promotion.
- Les restaurants sans logiciel disposent d'un parcours complet, pas d'un mode secondaire.
- Toute dépense, exposition publique, suppression ou modification externe exige l'accord explicite du propriétaire.
