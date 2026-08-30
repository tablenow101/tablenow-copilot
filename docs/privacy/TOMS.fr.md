# Mesures techniques et organisationnelles

## Accès et cloisonnement

- invitation uniquement, OTP à durée courte et limitation de débit ;
- session HttpOnly, protection CSRF, contrôle d'origine et cookies `Secure` sous HTTPS ;
- rôles explicites ; validation renforcée des actions IA à risque ;
- PostgreSQL utilisé par un rôle sans privilège d'administration ;
- RLS forcée sur les tables métier et requêtes systématiquement bornées par `tenant_id`.

## Résilience

- conteneurs reproductibles ; PostgreSQL source de vérité ;
- jobs idempotents, verrouillage, tentatives bornées et état d'échec ;
- outbox pour les intégrations ; mode local fonctionnel sans Internet ;
- sauvegarde avant mise à jour/restauration et procédure de test.

## Confidentialité et cycle de vie

- secrets générés hors code et fichiers privés `0600` ;
- TLS requis pour le cloud ; disque chiffré recommandé pour le nœud local ;
- aucun analytics publicitaire ni modèle externe par défaut ;
- exports à permissions restrictives, expiration automatique ;
- anonymisation planifiée, purge des OTP/sessions et rotation des invitations expirées ;
- audit des validations, droits et actions sensibles.

## Organisation

- principe du moindre privilège ; revue trimestrielle des accès ;
- confidentialité contractuelle des personnes autorisées ;
- correctifs et dépendances vérifiés en CI ;
- procédure d'incident, registre de sous-traitants et revue annuelle des risques ;
- tests de restauration et exercices de violation documentés.
