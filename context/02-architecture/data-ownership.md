# Propriété des données

## Règle

PostgreSQL Copilot est la source de vérité de TableNow. Les services externes reçoivent ou fournissent des données, mais ne définissent jamais seuls l'état métier interne.

| Donnée | Source de vérité |
|---|---|
| Utilisateurs, droits, sessions | TableNow Copilot |
| Configuration d'un restaurant | TableNow Copilot |
| Décisions et validations Copilot | TableNow Copilot |
| Journal et preuves d'action | TableNow Copilot |
| Réservation importée | Système choisi par le restaurant, avec référence et statut de synchronisation dans TableNow |
| Réservation saisie nativement | TableNow Copilot |
| Document exporté | Stockage privé, référencé depuis TableNow Copilot |

Une donnée externe ne doit jamais être écrite simultanément par deux moteurs TableNow.
