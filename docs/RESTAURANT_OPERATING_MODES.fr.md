# TableNow pour tous les modes de fonctionnement

TableNow ne prend jamais Zenchef, SevenRooms ou un autre éditeur comme modèle universel. L'onboarding identifie d'abord la réalité du restaurant et construit un chemin d'action par capacité.

| Situation du restaurant | Source de vérité initiale | Méthode principale | Secours |
|---|---|---|---|
| TableNow seul | PostgreSQL TableNow | Fonction native | Validation humaine |
| Zenchef, SevenRooms, TheFork ou autre | Outil choisi par le restaurant | API officielle si disponible | Pilotage d'écran certifié, puis humain |
| Google ou Outlook Calendar | Calendrier choisi | Connecteur calendrier | TableNow + humain |
| Cahier papier | Cahier pendant la transition | Saisie mobile rapide | Photo/import contrôlé + confirmation |
| Mix logiciel et papier | Règle définie à l'onboarding | Route par action | Toujours une procédure humaine |

## Hiérarchie de fiabilité

1. Fonction TableNow native.
2. API officielle documentée.
3. Outil MCP qui appelle l'API TableNow.
4. Connecteur calendrier structuré.
5. Script navigateur déterministe et certifié.
6. Computer Use visuel avec preuves et validation.
7. Procédure manuelle guidée.

Cette hiérarchie est choisie action par action. Un restaurant peut lire ses réservations par API mais demander une validation humaine pour les annulations.

## Ce que signifie « apprendre »

TableNow n'apprend pas librement en cliquant sur le logiciel d'un client. Il observe uniquement les données autorisées, propose un protocole versionné, le teste dans un compte de validation, puis mesure ses résultats. Toute nouvelle interface ou version d'interface repasse en validation avant les actions d'écriture.

## Certification d'une intégration

Une intégration n'est déclarée fonctionnelle qu'après :

- un compte de test autorisé par le restaurant ou l'éditeur ;
- une liste exacte des domaines et actions permises ;
- des tests lecture, création, modification, annulation et reprise sur erreur ;
- des captures avant/après chiffrées ;
- des tests ordinateur et mobile pour la validation humaine ;
- une procédure manuelle de secours ;
- une surveillance des changements d'interface.

Sans ces éléments, l'interface apparaît comme « à configurer » ou « limitée », jamais comme « prête ».

