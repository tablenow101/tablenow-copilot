# Retour arrière de 014_acceptance_data_origin

Migration additive : toutes les tâches et pièces jointes existantes, ainsi que leurs créations ordinaires, gardent l’origine `business`. Aucun titre, nom, statut ou mot-clé ne classe une ligne. Aucune donnée existante n’est supprimée ou marquée comme recette par cette migration.

Seules les lignes explicitement identifiées par leur ID et leur tenant, avec le restaurant pour les tâches ou l’utilisateur propriétaire pour les pièces jointes, peuvent être marquées `acceptance_test`, après preuve et autorisation sur la Preview dédiée. Ce marquage n’est pas exposé dans l’API métier. Les lectures du cockpit et le contexte courant du Copilot excluent ces lignes ; la modification d’une tâche les refuse comme introuvables. Les pièces jointes marquées sont exclues de la liste, du téléchargement, de l’extraction et des documents sélectionnés pour une nouvelle réponse. Leur suppression métier devient sans effet, comme pour un ID absent, et conserve le contenu chiffré. Les compteurs du cockpit utilisent déjà les listes filtrées. Le quota physique de stockage inclut toujours les fichiers conservés ; le filtrage ne le relâche pas. Les historiques de conversation déjà enregistrés ne sont pas réécrits.

La migration doit précéder le déploiement des nouveaux lecteurs. Aucun SQL de classification ni de retour arrière n’a été exécuté sur une base externe par ce lot.

Un retour au code précédent conserve la colonne mais réexpose les tâches et documents de recette, car l’ancien lecteur ne filtre pas leur origine. Conserver les lecteurs filtrés, ou suspendre l’accès métier pendant la restauration, jusqu’à une décision explicite du propriétaire sur ces lignes. Ne pas transformer silencieusement des lignes `acceptance_test` en `business`.

Si le propriétaire autorise explicitement un retour arrière du schéma : sauvegarder les IDs et leur origine, arrêter les écritures, vérifier qu’aucune ligne `acceptance_test` ne peut être réexposée, revenir au lecteur compatible, puis exécuter :

```sql
ALTER TABLE operational_tasks DROP COLUMN data_origin;
ALTER TABLE onboarding_attachments DROP COLUMN data_origin;
```

Cette suppression retire aussi la contrainte associée et perd le marquage d’origine. Elle n’a pas été exécutée. Ne pas effacer ni réécrire l’entrée d’une migration déjà appliquée ; une réintroduction nécessite une nouvelle migration versionnée.
