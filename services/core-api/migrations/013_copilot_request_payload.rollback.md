# Retour arrière de 013_copilot_request_payload

Migration additive : les anciennes lignes conservent `request_payload = NULL`. Les nouvelles lignes enregistrent uniquement les identifiants de documents et le contexte d’interface. L’isolation utilisateur/restaurant existante reste inchangée.

Le retour applicatif à la version précédente ne nécessite pas de supprimer cette colonne : la laisser en place préserve les métadonnées de reprise. Ne pas exécuter de suppression automatique.

Si le propriétaire autorise explicitement un retour arrière du schéma : sauvegarder d’abord les métadonnées, arrêter les écritures de la nouvelle version, déployer le lecteur précédent, puis exécuter :

```sql
ALTER TABLE copilot_runs DROP CONSTRAINT copilot_runs_request_payload_shape;
ALTER TABLE copilot_runs DROP COLUMN request_payload;
```

Cette suppression perd les métadonnées de reprise ajoutées après 013, mais ne modifie ni les messages, ni les réponses, ni les rapports existants. Elle n’a pas été exécutée sur Preview ou production. Pour réinstaller ensuite 013, suivre le protocole du journal de migrations ; ne pas réécrire une migration appliquée.
