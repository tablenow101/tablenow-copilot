# MCP

MCP est une porte standardisée par laquelle un agent peut demander à TableNow d'utiliser un outil.

## Règle centrale

Un outil MCP appelle toujours l'API métier TableNow. Il ne lit ni ne modifie directement PostgreSQL.

Chaque outil possède : un contrat d'entrée, une permission, un niveau de risque, une règle de validation, une clé anti-doublon et une sortie vérifiable.

La spécification détaillée se trouve dans [`../../docs/MCP_AND_HARNESS.md`](../../docs/MCP_AND_HARNESS.md).
