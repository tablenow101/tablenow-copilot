# Carte de la base PostgreSQL — 66 tables

La base est organisée par responsabilités. Toutes les données restaurant sont isolées par `tenant_id`, puis protégées par les règles RLS de PostgreSQL.

## Identité et accès

| Table | Rôle |
|---|---|
| `tenants` | Restaurant indépendant ou groupe de restaurants. |
| `users` | Identité unique d'une personne. |
| `memberships` | Rôle d'une personne dans une organisation. |
| `invitations` | Invitation privée et son statut. |
| `otp_challenges` | Code e-mail haché, limité et temporaire. |
| `sessions` | Connexion active et protection CSRF. |

## Opérations restaurant

| Table | Rôle |
|---|---|
| `restaurants` | Établissements, capacité et fuseau horaire. |
| `onboarding_profiles` | Configuration et priorités recueillies au démarrage. |
| `reservations` | Réservations et leur cycle de service. |
| `communications` | Appels, e-mails, SMS, WhatsApp et web. |
| `decisions` | Décisions ouvertes, approuvées, rejetées ou résolues. |
| `operational_tasks` | Tâches opérationnelles et responsables. |
| `team_shifts` | Services et présence planifiée de l'équipe. |
| `inventory_items` | Quantités, unités et seuils de réapprovisionnement. |
| `metrics_daily` | Mesures quotidiennes de performance. |

## Horaires, services et plan de salle

| Table | Rôle |
|---|---|
| `restaurant_business_hours` | Horaires habituels et périodes de validité. |
| `service_periods` | Modèles de petit-déjeuner, déjeuner, dîner ou service spécial. |
| `service_instances` | Service réel d'une date avec capacité et statut. |
| `restaurant_closures` | Fermetures et exceptions planifiées. |
| `dining_areas` | Salles, terrasses, bars et zones. |
| `dining_tables` | Tables, capacités, accessibilité et position. |
| `table_combinations` | Assemblages de tables autorisés. |
| `table_combination_members` | Tables composant chaque assemblage. |

## Clients, attente et histoire de réservation

| Table | Rôle |
|---|---|
| `guests` | Profil client commun au restaurant ou au groupe. |
| `guest_consents` | Preuve des consentements par finalité et canal. |
| `guest_tags` | Étiquettes contrôlées et signalement des catégories sensibles. |
| `guest_tag_assignments` | Association traçable entre client et étiquette. |
| `waitlist_entries` | Liste d'attente, flexibilité et offre proposée. |
| `reservation_table_assignments` | Placement d'une réservation sur une table et une durée. |
| `reservation_events` | Histoire immuable de chaque réservation. |

## Conversations

| Table | Rôle |
|---|---|
| `communication_threads` | Conversation, priorité, responsable et état. |
| `communication_messages` | Messages entrants, sortants et statut de livraison. |

## Équipe structurée

| Table | Rôle |
|---|---|
| `team_members` | Collaborateurs, rôles et statut. |
| `team_availability` | Disponibilités récurrentes et périodes de validité. |
| `time_off_requests` | Absences demandées, validées ou refusées. |

## Stocks, fournisseurs, commandes et carte

| Table | Rôle |
|---|---|
| `inventory_locations` | Réserves, bars, cuisines, caves et congélateurs. |
| `inventory_balances` | Quantité d'un article par emplacement. |
| `stock_movements` | Réception, consommation, perte, transfert et inventaire. |
| `suppliers` | Fournisseurs et méthode de commande. |
| `supplier_items` | Références, conditionnements, délais et prix fournisseur. |
| `purchase_orders` | Commandes, validation, envoi et réception. |
| `purchase_order_lines` | Articles, quantités et prix de chaque commande. |
| `menu_items` | Carte, prix, disponibilité et allergènes. |
| `menu_item_ingredients` | Consommation théorique de stock par plat. |

## Pilotage et expérience

| Table | Rôle |
|---|---|
| `metric_targets` | Objectifs mesurables par période. |
| `notifications` | Alertes et actions destinées à un utilisateur. |
| `product_feedback` | Retour contextualisé des testeurs. |

## Copilot et fiabilité

| Table | Rôle |
|---|---|
| `agent_actions` | Proposition, risque, validation et résultat de chaque action IA. |
| `agent_usage_daily` | Budget et consommation quotidienne par organisation. |
| `jobs` | Tâches différées avec reprises contrôlées. |
| `outbox_events` | Événements à transmettre une seule fois de façon fiable. |

## Confidentialité et audit

| Table | Rôle |
|---|---|
| `privacy_preferences` | Choix de confidentialité de chaque utilisateur. |
| `privacy_requests` | Accès, export, rectification, suppression, limitation et opposition. |
| `legal_acceptances` | Preuve versionnée des documents acceptés. |
| `audit_events` | Journal horodaté des actions importantes. |

## Systèmes externes et Computer Use

| Table | Rôle |
|---|---|
| `restaurant_systems` | Outils réellement utilisés par chaque restaurant. |
| `action_routes` | Meilleur chemin et solution de secours pour une capacité. |
| `computer_connections` | Connexion isolée à une interface autorisée. |
| `computer_workflows` | Procédure versionnée et testée pour une action. |
| `computer_runs` | Exécution, validation, statut et résultat. |
| `computer_run_events` | Chronologie et preuves de l'exécution. |
| `external_record_links` | Identifiants externes empêchant les doubles imports. |
| `webhook_inbox` | Événements fournisseurs vérifiés et dédupliqués. |
| `sync_conflicts` | Désaccords de données nécessitant une résolution explicite. |

## Mode local et synchronisation future

| Table | Rôle |
|---|---|
| `node_credentials` | Identité révocable d'un exécuteur autorisé. |
| `sync_inbox` | Événements entrants dédupliqués par identifiant. |

## Protections déjà écrites

- relations entre tables empêchant les références entre restaurants ;
- RLS forcée sur toutes les tables métier sensibles ;
- clés d'idempotence contre les doubles actions ;
- contraintes de statut, rôle, quantité, durée et capacité ;
- codes et sessions stockés sous forme hachée ;
- journal d'audit indépendant de l'interface.
- test PostgreSQL embarqué exécutant réellement toutes les migrations.
