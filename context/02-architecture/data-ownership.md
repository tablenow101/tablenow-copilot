# Propriété des données

## Règle

PostgreSQL V2 est la source de vérité de TableNow V2. Les services externes reçoivent ou fournissent des données, mais ne définissent jamais seuls l'état métier interne.

| Donnée | Source de vérité |
|---|---|
| Utilisateurs, droits, sessions | TableNow V2 |
| Configuration d'un restaurant | TableNow V2 |
| Décisions et validations Copilot | TableNow V2 |
| Journal et preuves d'action | TableNow V2 |
| Réservation importée | Système choisi par le restaurant, avec référence et statut de synchronisation dans TableNow |
| Réservation saisie nativement | TableNow V2 |
| Document exporté | Stockage privé, référencé depuis TableNow V2 |

Une donnée externe ne doit jamais être écrite simultanément par deux moteurs TableNow.
