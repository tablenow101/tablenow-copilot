# Retour arrière de 015_copilot_data_origin

Migration additive : les conversations et messages existants restent `business`. Aucun titre ni contenu ne détermine leur origine. La migration ne classe, ne réécrit et ne supprime aucune conversation ; 014 reste inchangée.

Après vérification de la provenance et autorisation sur la Preview dédiée, le marquage doit cibler les IDs exacts avec tenant, restaurant et utilisateur. Marquer le run et ses messages ensemble, dans une même transaction, y compris les réponses assistant associées. Les messages historiques sans run nécessitent leurs propres IDs vérifiés ; aucune inférence par mots-clés. Les observations sont conservées et leur accès suit l’origine de leur run.

Les lecteurs métier excluent les runs et messages `acceptance_test`. Une ancienne clé ne relance pas un run classé ; elle ne restitue ni réponse ni rapport. Ajouter une observation à ce run est refusé. Une finalisation déjà en cours ne peut plus écrire de messages métier après le classement de son run. Le rôle SQL du contexte reste restreint : il filtre les messages sans accès supplémentaire aux runs.

Déployer le schéma avant les nouveaux lecteurs. Aucun classement ni rollback cloud n’a été exécuté par ce lot. Un retour à l’ancien lecteur réexposerait les conversations classées : conserver les filtres ou suspendre l’accès pendant la restauration jusqu’à une décision explicite du propriétaire. Ne pas reclasser silencieusement une ligne en `business`.

Si un retour du schéma est explicitement autorisé : sauvegarder le marquage avec les IDs, arrêter les écritures, vérifier qu’aucune donnée de recette ne peut être réexposée, revenir au lecteur compatible, puis exécuter :

```sql
ALTER TABLE copilot_messages DROP COLUMN data_origin;
ALTER TABLE copilot_runs DROP COLUMN data_origin;
```

La suppression perd les origines et retire les contraintes associées, mais garde les messages, rapports, réponses et observations. Ce rollback n’a pas été exécuté. Ne pas modifier le checksum ni effacer le journal d’une migration appliquée ; réintroduire ensuite par une nouvelle migration versionnée.
