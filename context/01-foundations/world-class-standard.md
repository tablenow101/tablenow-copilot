# Standard world-class TableNow

## Cible

TableNow n'est pas considéré réussi parce qu'il fonctionne techniquement. Chaque capacité visible doit viser le niveau des meilleures expériences logicielles mondiales dans son contexte d'usage : rapide, évidente, fiable, calme, cohérente et utile sous pression réelle.

Le produit doit être simple à utiliser sans être simpliste, puissant sans exposer sa complexité, intelligent sans devenir imprévisible et robuste sans imposer de friction inutile.

## Standard de sortie d'une fonctionnalité

Une fonctionnalité importante n'est livrable que si les dimensions suivantes sont simultanément satisfaites :

1. **Valeur métier** — elle résout un vrai problème du restaurant et améliore son fonctionnement réel.
2. **UX** — l'utilisateur comprend immédiatement où il est, ce qu'il peut faire et ce qui vient de se passer.
3. **Vitesse** — aucun délai ou détour évitable ne dégrade un moment opérationnel.
4. **Fiabilité** — l'état affiché correspond à l'état réel ; aucune confirmation n'est donnée sans preuve.
5. **Robustesse** — erreurs réseau, refresh, double action, données partielles et reprise de session sont prévues.
6. **Sécurité et autorité** — la bonne personne décide, avec le bon niveau de contrôle et de traçabilité.
7. **Mobile et desktop** — le parcours est excellent sur les appareils réellement utilisés dans le restaurant.
8. **Observabilité** — une anomalie peut être comprise et diagnostiquée rapidement sans exposer de secrets.
9. **Réversibilité** — les changements importants disposent d'un chemin de retour sûr lorsque c'est applicable.
10. **Test réalité** — le parcours a été exécuté dans une version déployée comme un vrai utilisateur, pas seulement validé par le code.

Aucune de ces dimensions ne peut être sacrifiée durablement au motif qu'une autre est verte.

## Excellence sans lourdeur

Le standard world-class ne signifie pas multiplier les composants, agents, services ou abstractions.

- préférer la solution la plus simple qui satisfait durablement les exigences ;
- ne créer un composant supplémentaire que s'il réduit réellement le risque, la complexité ou le coût futur ;
- garder les systèmes de simulation, test et analyse hors du chemin critique de production ;
- éviter les agents permanents lorsqu'une exécution ponctuelle suffit ;
- conserver une seule source de vérité par domaine ;
- mesurer avant d'ajouter une architecture destinée à un problème hypothétique.

## Benchmark

Quand une décision UX, produit ou technique est structurante et qu'une référence externe pertinente existe, comparer TableNow aux meilleures solutions disponibles et documenter :

- ce qu'elles font mieux ;
- ce qui ne convient pas au contexte restaurant ;
- ce que TableNow doit dépasser ;
- le choix retenu et son trade-off.

Le benchmark n'autorise pas à copier un produit : il sert à empêcher TableNow d'accepter un niveau inférieur à l'état de l'art.

## Critère final

La question n'est pas « est-ce que ça marche ? ».

La question est : **« Est-ce que c'est la manière la plus claire, fiable et naturelle qu'un excellent restaurant devrait vouloir utiliser aujourd'hui ? »**
