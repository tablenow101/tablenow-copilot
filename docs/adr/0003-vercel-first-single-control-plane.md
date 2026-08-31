# ADR 0003 — Vercel-first et control plane Copilot unique

- Statut : accepté
- Date : 2026-08-30

## Contexte

Le pilote doit être simple à exploiter, ne pas créer deux backends concurrents et conserver la possibilité d'un mode local futur.

## Décision

Le pilote cloud utilise Vercel pour la console, l'API et les traitements déclenchés, avec une base PostgreSQL managée dédiée par environnement. Un seul chemin métier peut écrire dans cette base.

Computer Use s'exécute dans un environnement isolé à la demande. Les conteneurs restent supportés pour le développement, la portabilité, la reprise et un futur TableNow Node ; ils ne forment pas un second backend cloud actif pendant le pilote.

Le domaine métier, les contrats et les migrations restent indépendants des SDK d'hébergement. Les intégrations cloud sont implémentées derrière les adaptateurs du projet.

## Conséquences

- pas de nouveau VPS pour le pilote ;
- pas de double-write ni de synchronisation entre deux backends cloud ;
- adaptation du serveur Fastify à une entrée Vercel unique ;
- remplacement du stockage fichier cloud par un stockage objet privé ;
- remplacement de la boucle worker permanente par des tâches durables déclenchées ;
- PostgreSQL standard reste la source de vérité ;
- le mode local futur exige une ADR séparée sur la synchronisation et les conflits.
