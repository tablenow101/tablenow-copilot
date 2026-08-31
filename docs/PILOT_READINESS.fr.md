# Porte de sortie pilote TableNow Copilot

Une version n'est partageable avec des restaurateurs que lorsque chaque exigence obligatoire est prouvée sur l'environnement réellement utilisé. Un résumé de génération ou un build local ne remplace jamais un parcours cloud testé.

## Qualité produit

| Contrôle | Exigence | Preuve attendue |
|---|---|---|
| Accès privé | E-mail réel, code à usage unique, expiration, renvoi et déconnexion | Test navigateur + e-mail reçu |
| Onboarding universel | TableNow seul, logiciel, calendrier, papier et hybride | Test de chaque branche |
| Multi-établissements | Vue groupe, filtre par adresse et fuseau horaire local | Tests automatisés + navigateur |
| Saisie manuelle | Réservation, tâche, planning et stock depuis ordinateur et mobile | Création, relecture et modification persistées |
| Navigation | Chaque lien, bouton, filtre, modal et retour d'erreur a un résultat visible | Audit d'interactions sur toutes les routes |
| Copilot | Analyse sourcée, périmètre restaurant, proposition et validation humaine | Test autorisé avec journal d'audit |
| Computer Use | Domaine autorisé, preuve, annulation et échec fermé | Compte tiers de test autorisé |
| Responsive | 360, 390, 768, 1024, 1440 et grand écran | Captures et parcours tactiles réels |
| Accessibilité | Clavier, focus, libellés, contraste, réduction des animations | Revue automatisée et manuelle |
| Résilience | Erreurs API, lenteur, double clic, reprise et perte réseau | Tests de panne contrôlés |

## Sécurité et données

| Contrôle | Condition de passage |
|---|---|
| Ressources | Dépôt, projet Vercel, base et secrets dédiés à Copilot |
| Isolation | Tests PostgreSQL RLS réussis sur la version réellement déployée |
| Secrets | Aucun secret dans Git, variables chiffrées et rotation documentée |
| Accès | Rôles minimaux, CSRF, sessions sécurisées et limitation de débit |
| RGPD | Documents versionnés, consentements, export, rectification, limitation et effacement |
| Sauvegardes | Sauvegarde chiffrée restaurée lors d'un exercice réel |
| Journal | Toute action sensible contient auteur, périmètre, accord et résultat |
| Dépendances | Aucune vulnérabilité connue de niveau élevé ou critique |

## Activations externes obligatoires

1. relier le dépôt privé au projet Vercel Copilot existant ;
2. vérifier les migrations et l'isolation sur la base Neon Preview ;
3. configurer un domaine d'envoi TableNow et tester la délivrabilité des codes ;
4. raccorder le stockage privé, les tâches durables et les sauvegardes ;
5. compléter l'identité juridique et faire valider les documents applicables ;
6. fournir un compte de test autorisé pour chaque intégration tierce à certifier ;
7. exécuter tous les parcours ordinateur et mobile, puis corriger jusqu'à zéro blocage critique ;
8. effectuer une restauration de sauvegarde et un retour à la version précédente.

## Décision de publication

- **Bloqué** : une exigence de sécurité, d'accès ou de persistance échoue.
- **Pilote limité** : le produit fonctionne, mais une intégration tierce reste clairement marquée « à configurer ».
- **Pilote prêt** : tous les contrôles génériques réussissent et les limites tierces sont explicites.
- **Intégration certifiée** : les scénarios de l'éditeur concerné réussissent sur un compte autorisé et sa version réelle.

« Fonctionnel à 100 % » signifie qu'aucun parcours promis ne bloque dans le périmètre testé. Une interface tierce inconnue ou modifiée doit toujours être certifiée à nouveau.
