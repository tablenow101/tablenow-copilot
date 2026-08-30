# Porte de sortie pilote TableNow V2

Une version n'est partageable avec des restaurateurs que lorsque chaque ligne obligatoire est prouvée sur l'environnement qui sera réellement utilisé. Un résumé de génération ou un build local ne remplace jamais un test du parcours public.

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
| Résilience | Erreurs API, lenteur, double clic, reprise worker et perte réseau | Tests de panne contrôlés |

## Sécurité et données

| Contrôle | Condition de passage |
|---|---|
| Séparation | Nouveau dépôt, nouveau projet Vercel, nouvelle base et nouveaux secrets V2 |
| Isolation | Tests PostgreSQL RLS réussis avec PostgreSQL 17 réel |
| Secrets | Aucun secret dans Git, variables chiffrées et rotation documentée |
| Accès | Rôles minimaux, CSRF, sessions sécurisées et limitation de débit |
| RGPD | Documents versionnés, consentements, export, rectification, limitation et effacement |
| Sauvegardes | Sauvegarde chiffrée restaurée lors d'un exercice réel |
| Journal | Toute action sensible contient auteur, périmètre, accord et résultat |
| Dépendances | Aucune vulnérabilité connue de niveau élevé ou critique |

## Activation externe obligatoire

Les éléments suivants ne peuvent pas être certifiés uniquement depuis le code :

1. autoriser le connecteur GitHub sur l'organisation TableNow et créer le dépôt privé `tablenow-platform` ;
2. provisionner un hôte V2 séparé pour PostgreSQL, l'API, le worker, MCP et le runner ;
3. configurer un SMTP TableNow et vérifier la délivrabilité des codes ;
4. compléter l'identité juridique et faire valider les documents applicables ;
5. attribuer `copilot.tablenow.io` au nouveau projet Vercel uniquement ;
6. fournir des comptes de test autorisés pour chaque intégration tierce à certifier ;
7. exécuter les parcours publics ordinateur et mobile, puis corriger jusqu'à zéro blocage critique ;
8. effectuer une restauration de sauvegarde et un retour à la version précédente.

`scripts/start-cloud.sh` refuse un SMTP factice, un code d'accès fixe ou une configuration Docker invalide avant d'exposer le service.

## Décision de publication

- **Bloqué** : une exigence de sécurité, d'accès ou de persistance échoue.
- **Pilote limité** : le produit fonctionne, mais une intégration tierce reste clairement marquée « à configurer ».
- **Pilote prêt** : tous les contrôles génériques sont réussis et les limites tierces sont explicites.
- **Intégration certifiée** : les scénarios de l'éditeur concerné réussissent sur un compte autorisé et sa version réelle.

Le terme « 100 % fonctionnel » signifie ici : aucun parcours promis ne bloque dans le périmètre testé. Il ne signifie jamais qu'une interface tierce inconnue ou modifiée est garantie sans nouvelle certification.
