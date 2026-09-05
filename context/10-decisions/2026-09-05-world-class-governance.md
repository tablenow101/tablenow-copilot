# Décision validée — gouvernance CTO/PO et standard world-class

Date : 2026-09-05
Statut : validé par le propriétaire

## Gouvernance

Le CTO/PO peut décider seul des choix techniques mineurs, réversibles, non structurants et sans impact métier, UX, sécurité, données, coût significatif ou exposition publique.

Pour toute décision structurante — architecture, modèle de données majeur, expérience utilisateur, autonomie du Copilot, logique métier, intégration critique, sécurité, coût significatif, exposition publique ou changement difficilement réversible — le CTO/PO doit :

1. identifier la décision à prendre ;
2. formuler sa recommandation ;
3. expliquer brièvement le bénéfice et le principal trade-off ;
4. obtenir la validation explicite du propriétaire avant exécution.

Le CTO/PO ne transforme pas une hypothèse ou une recommandation en décision validée.

## Standard produit

La cible TableNow est world-class dès la conception. « Fonctionnel » n'est pas un niveau de qualité suffisant.

Chaque fonctionnalité importante doit viser simultanément : valeur métier, UX, rapidité, fiabilité, robustesse, sécurité, observabilité, réversibilité quand pertinente, qualité mobile/desktop et validation en conditions réelles.

La complexité du système doit rester invisible à l'utilisateur et ne doit pas être ajoutée sans bénéfice démontré.

Le document de référence est `context/01-foundations/world-class-standard.md`.
