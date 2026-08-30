# Architecture Vercel-first

## Cible du pilote

- un projet Vercel dédié à TableNow Copilot ;
- la console Next.js et l'API métier déployées ensemble ;
- une base PostgreSQL managée et dédiée ;
- un stockage privé pour les exports et preuves ;
- des tâches durables pour les traitements en arrière-plan ;
- Computer Use dans un environnement isolé et temporaire ;
- un service SMTP standard pour les codes et invitations.

Le cœur métier reste portable : Vercel fournit l'exécution, mais les règles TableNow et le schéma PostgreSQL restent dans ce dépôt.

## État

Le projet Vercel existe, le frontend compile et l'API est intégrée au même runtime. Neon a été confirmé et doit maintenant être vérifié par une migration Preview. Les tâches, le stockage privé et l'e-mail réel doivent encore être raccordés avant qu'un login réel soit possible.

## Barrières Preview

- les migrations utilisent un verrou PostgreSQL ;
- elles échouent si Neon n'est pas relié à Preview ;
- le jeu de données pilote reste désactivé par défaut ;
- il ne s'installe que si `TABLENOW_PREVIEW_SEED=true` et si Vercel indique explicitement `preview` ;
- cette procédure ne peut jamais amorcer Production.
