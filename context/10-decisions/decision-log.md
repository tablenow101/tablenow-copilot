# Journal des décisions

| ID | Date | Décision | Pourquoi | Statut |
|---|---|---|---|---|
| D-001 | 2026-08-30 | TableNow Copilot utilise une base PostgreSQL dédiée par environnement. | Éviter les doublons et garder une source de vérité. | Actif |
| D-002 | 2026-08-30 | Le pilote cloud reste sur Vercel, sans nouveau VPS. | Réduire l'exploitation et supprimer le risque de deux backends concurrents. | Actif |
| D-003 | 2026-08-30 | Console et API métier doivent former un seul control plane Copilot. | Une action ne doit avoir qu'un seul chemin d'écriture. | Actif |
| D-004 | 2026-08-30 | Le cœur métier reste portable et PostgreSQL standard. | Pouvoir changer d'hébergeur ou activer un mode local futur. | Actif |
| D-005 | 2026-08-30 | Desktop et mobile partagent les mêmes capacités essentielles. | Les restaurateurs pilotent au bureau comme en service. | Actif |
| D-006 | 2026-08-30 | L'onboarding part de l'équipement réel du restaurant. | Accepter logiciel, calendrier, papier, aucun système et hybride. | Actif |
| D-007 | 2026-08-30 | Computer Use vient après les connexions natives et officielles. | Réduire la fragilité et prouver chaque action. | Actif |
| D-008 | 2026-08-30 | Toute action sensible du Copilot exige une validation humaine. | Garder l'autorité, la sécurité et la responsabilité. | Actif |
| D-009 | 2026-08-30 | Les ressources externes, payantes, destructives ou publiques exigent une autorisation explicite. | Préserver le contrôle du propriétaire. | Actif |
| D-010 | 2026-08-31 | Le dépôt privé `tablenow101/tablenow-copilot` est la source canonique du code. | Sauvegarder, auditer et déployer une seule version officielle. | Actif |
| D-011 | 2026-08-31 | `main` reste déployable et chaque évolution passe les contrôles GitHub avant intégration. | Empêcher qu'une modification cassée atteigne l'environnement partagé. | Actif |
