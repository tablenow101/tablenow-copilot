# Frontières des ressources Copilot

| Ressource | Cible | Règle |
|---|---|---|
| Code | Dépôt privé `tablenow101/tablenow-copilot` | Aucune dépendance directe à un autre dépôt produit. |
| Application | Projet Vercel dédié à Copilot | Aucun second backend cloud en parallèle. |
| Données | PostgreSQL Neon dédié par environnement | Une source de vérité, migrations versionnées et aucun double-write. |
| Secrets | Variables chiffrées propres à chaque environnement | Aucun partage, affichage ou commit. |
| Domaine | Domaine Copilot attribué seulement après validation | Aucun changement DNS pendant les tests privés. |

Les ressources de développement, Preview et production sont distinctes. Une Preview ne peut jamais accéder aux données réelles de production.

