# Cycle de vie des données

1. **Collecte minimale** — TableNow demande uniquement ce qui sert au parcours choisi.
2. **Validation** — l'API contrôle format, rôle, restaurant et état autorisé.
3. **Enregistrement** — PostgreSQL écrit la donnée dans le bon périmètre.
4. **Utilisation** — l'interface et le Copilot accèdent uniquement aux données autorisées.
5. **Historique** — les changements sensibles créent une trace d'audit.
6. **Conservation** — chaque catégorie suit une durée documentée.
7. **Export ou suppression** — une demande RGPD déclenche une tâche suivie et vérifiable.

La grille détaillée se trouve dans [`../../docs/privacy/RETENTION_SCHEDULE.fr.md`](../../docs/privacy/RETENTION_SCHEDULE.fr.md).
