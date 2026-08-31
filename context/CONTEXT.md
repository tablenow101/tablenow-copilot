# Mémoire permanente de TableNow Copilot

Ce dossier est le point d'entrée humain du projet. Il explique ce que TableNow construit, pourquoi, où se trouve chaque vérité et ce qui reste à faire.

## À lire dans cet ordre

1. [`01-foundations/vision.md`](01-foundations/vision.md) — la destination produit.
2. [`01-foundations/non-negotiables.md`](01-foundations/non-negotiables.md) — ce qui ne doit jamais être cassé.
3. [`02-architecture/system-map.md`](02-architecture/system-map.md) — les grandes pièces du système.
4. [`04-data/database-map.md`](04-data/database-map.md) — ce que la base enregistre.
5. [`11-status/current-state.md`](11-status/current-state.md) — l'état réel aujourd'hui.
6. [`11-status/next-actions.md`](11-status/next-actions.md) — la prochaine séquence de travail.

## Carte des dossiers

| Dossier | Question à laquelle il répond |
|---|---|
| `00-source-material` | Qu'a demandé le fondateur et quels mots utilisons-nous ? |
| `01-foundations` | Quelle vision et quelles règles guident TableNow ? |
| `02-architecture` | Comment les composants sont-ils séparés ? |
| `03-product` | Pour qui construisons-nous et quels parcours proposons-nous ? |
| `04-data` | Quelles données existent et qui les possède ? |
| `05-ai-and-automation` | Que peut faire le Copilot et avec quelles limites ? |
| `06-integrations` | Comment TableNow s'adapte aux outils déjà utilisés ? |
| `07-security-privacy` | Comment protégeons-nous les personnes et les restaurants ? |
| `08-deployment-operations` | Où le produit tourne-t-il et comment est-il exploité ? |
| `09-pilot` | Comment ouvrir la version à des restaurateurs sans improviser ? |
| `10-decisions` | Qu'avons-nous décidé et pourquoi ? |
| `11-status` | Qu'est-ce qui est fait, bloqué, autorisé ou suivant ? |

## Règle de vérité

- `context/` explique les décisions en langage simple.
- `docs/` contient les spécifications techniques et juridiques détaillées.
- `services/core-api/migrations/` définit réellement la base de données.
- Le code et les tests tranchent si une documentation est devenue obsolète.

Chaque changement matériel doit mettre à jour ces quatre niveaux lorsque nécessaire.
