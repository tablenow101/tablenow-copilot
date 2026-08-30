# Environnements et migrations

## Une vérité par environnement

| Environnement | Utilité | Données autorisées |
|---|---|---|
| Développement | Construire localement | Données fictives uniquement. |
| Preview | Tester une version candidate | Données pilotes isolées et réinitialisables. |
| Production | Utiliser la version validée | Données réelles autorisées du pilote. |

Chaque environnement possède sa propre branche ou base logique, mais un seul backend y fait autorité.

## Migrations

Les fichiers `001`, `002`, `003` sont appliqués dans l'ordre et enregistrés. Une migration déjà exécutée n'est jamais réécrite ; toute évolution ajoute un nouveau fichier numéroté.

Avant production : sauvegarde, migration de preview, tests d'isolation, répétition du retour arrière puis migration de production.
