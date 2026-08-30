# Modèle de sécurité

TableNow applique plusieurs barrières indépendantes :

- invitation privée et code temporaire ;
- session sécurisée et protection contre les requêtes forgées ;
- rôles et permissions vérifiés par l'API ;
- isolation RLS dans PostgreSQL ;
- relations de base empêchant les références entre organisations ;
- validation stricte de toutes les entrées ;
- validation humaine selon le risque ;
- limitation du budget et du nombre de tentatives ;
- journal d'audit ;
- chiffrement des exports et preuves sensibles.

Si une barrière applicative échoue, la base doit encore empêcher l'accès transversal.
