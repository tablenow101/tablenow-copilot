# Isolation du déploiement TableNow Copilot

Copilot possède ses propres ressources. Aucun dépôt, projet Vercel, secret, domaine ou base de données ne doit être partagé implicitement avec un autre produit.

| Ressource | Cible Copilot | Règle |
|---|---|---|
| Code | `tablenow101/tablenow-copilot` | Dépôt privé et source canonique |
| Hébergement | Projet Vercel Copilot existant | Console et API dans un seul control plane |
| Données | Base Neon dédiée par environnement | Une source de vérité PostgreSQL |
| Preview | URL Vercel protégée | Données fictives et secrets Preview uniquement |
| Production | Domaine Copilot à attribuer plus tard | Promotion du même artefact vérifié |

## Règles non négociables

1. Development, Preview et Production utilisent des secrets et bases distincts.
2. Le dépôt ne contient aucune valeur secrète ni donnée réelle.
3. Aucun second backend cloud n'écrit en parallèle.
4. Les migrations sont exécutées et testées avant la promotion de l'interface.
5. Les secrets serveur ne portent jamais le préfixe `NEXT_PUBLIC_`.
6. Une version Preview testée est promue ; la production n'est jamais reconstruite à l'aveugle.

## Control plane Copilot

- Framework : Next.js avec l'API métier intégrée au même projet Vercel.
- PostgreSQL : Neon derrière l'adaptateur TableNow.
- Tâches : exécutions durables déclenchées, jamais une boucle serveur cachée.
- Fichiers : stockage objet privé, référencé depuis PostgreSQL.
- Computer Use : bac à sable temporaire appelant uniquement l'API métier.
- Conteneurs : développement, reprise, portabilité et futur mode local ; pas un second backend actif.

Les identifiants techniques de garde-fou `TABLENOW_STACK_ID` et `DATABASE_SCOPE` doivent correspondre à la configuration versionnée du projet. Le build refuse une cible incohérente.

## Promotion d'une version

1. Une branche crée une Preview Vercel.
2. GitHub vérifie typage, tests, PostgreSQL, images Docker et dépendances.
3. La Preview applique les migrations sous verrou et vérifie la disponibilité.
4. Les parcours ordinateur et mobile sont testés sur cette Preview.
5. Le même artefact validé est promu.
6. Les erreurs et temps de réponse sont surveillés après promotion.
7. Un retour vers la version précédente reste immédiatement disponible.
