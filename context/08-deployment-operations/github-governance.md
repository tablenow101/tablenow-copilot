# Gouvernance GitHub

## Source officielle

Le dépôt privé `tablenow101/tablenow-copilot` est l'unique source canonique du code. `main` représente toujours la version intégrable et déployable.

## Chemin d'un changement

1. Une branche courte contient un seul objectif.
2. Une pull request décrit le résultat, les preuves et le retour arrière.
3. GitHub vérifie le code, les tests, le build, PostgreSQL et Docker.
4. Les surfaces sensibles demandent la relecture du propriétaire défini dans `CODEOWNERS`.
5. Le changement est intégré par squash lorsque tous les contrôles sont verts.
6. Vercel construit ensuite la version exacte issue de GitHub.

## Protections

- Les branches ne contiennent aucun secret ni donnée réelle.
- Les dépendances sont contrôlées chaque semaine par Dependabot.
- Les tickets de sécurité passent par une alerte privée.
- Les branches intégrées sont supprimées automatiquement.
- Les réécritures forcées et suppressions de `main` sont interdites.
- Un administrateur conserve une voie de récupération documentée en cas d'incident.

## Responsabilité

Le propriétaire TableNow valide les migrations, le domaine métier, le runtime Copilot, la confidentialité et la configuration GitHub. Cette règle pourra devenir une équipe de relecteurs sans modifier le processus.

