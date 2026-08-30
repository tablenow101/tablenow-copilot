-- RLS hides foreign rows; composite foreign keys also prevent tenant-owned rows
-- from referencing a parent that belongs to another tenant.
CREATE UNIQUE INDEX restaurants_tenant_identity ON restaurants (tenant_id, id);
CREATE UNIQUE INDEX memberships_tenant_user_identity ON memberships (tenant_id, user_id);
CREATE UNIQUE INDEX agent_actions_tenant_identity ON agent_actions (tenant_id, id);
CREATE UNIQUE INDEX node_credentials_tenant_identity ON node_credentials (tenant_id, id);
CREATE UNIQUE INDEX restaurant_systems_tenant_restaurant_identity ON restaurant_systems (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX computer_connections_tenant_identity ON computer_connections (tenant_id, id);
CREATE UNIQUE INDEX computer_connections_tenant_restaurant_identity ON computer_connections (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX computer_workflows_tenant_connection_identity ON computer_workflows (tenant_id, connection_id, id);
CREATE UNIQUE INDEX computer_runs_tenant_identity ON computer_runs (tenant_id, id);

ALTER TABLE sessions
  ADD CONSTRAINT sessions_membership_integrity
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE;
ALTER TABLE privacy_preferences
  ADD CONSTRAINT privacy_preferences_membership_integrity
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE;
ALTER TABLE privacy_requests
  ADD CONSTRAINT privacy_requests_membership_integrity
  FOREIGN KEY (tenant_id, requested_by) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE;
ALTER TABLE legal_acceptances
  ADD CONSTRAINT legal_acceptances_membership_integrity
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE;

ALTER TABLE onboarding_profiles
  ADD CONSTRAINT onboarding_profiles_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE SET NULL (restaurant_id);
ALTER TABLE reservations
  ADD CONSTRAINT reservations_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE communications
  ADD CONSTRAINT communications_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE decisions
  ADD CONSTRAINT decisions_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE operational_tasks
  ADD CONSTRAINT operational_tasks_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE team_shifts
  ADD CONSTRAINT team_shifts_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE metrics_daily
  ADD CONSTRAINT metrics_daily_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE agent_actions
  ADD CONSTRAINT agent_actions_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE SET NULL (restaurant_id);
ALTER TABLE sync_inbox
  ADD CONSTRAINT sync_inbox_node_integrity
  FOREIGN KEY (tenant_id, node_id) REFERENCES node_credentials (tenant_id, id) ON DELETE CASCADE;

ALTER TABLE restaurant_systems
  ADD CONSTRAINT restaurant_systems_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE action_routes
  ADD CONSTRAINT action_routes_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT action_routes_primary_system_integrity
  FOREIGN KEY (tenant_id, restaurant_id, primary_system_id)
    REFERENCES restaurant_systems (tenant_id, restaurant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT action_routes_fallback_system_integrity
  FOREIGN KEY (tenant_id, restaurant_id, fallback_system_id)
    REFERENCES restaurant_systems (tenant_id, restaurant_id, id) ON DELETE SET NULL (fallback_system_id);
ALTER TABLE computer_connections
  ADD CONSTRAINT computer_connections_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT computer_connections_system_integrity
  FOREIGN KEY (tenant_id, restaurant_id, system_id)
    REFERENCES restaurant_systems (tenant_id, restaurant_id, id) ON DELETE CASCADE;
ALTER TABLE computer_workflows
  ADD CONSTRAINT computer_workflows_connection_integrity
  FOREIGN KEY (tenant_id, connection_id) REFERENCES computer_connections (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE computer_runs
  ADD CONSTRAINT computer_runs_connection_integrity
  FOREIGN KEY (tenant_id, connection_id) REFERENCES computer_connections (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT computer_runs_workflow_integrity
  FOREIGN KEY (tenant_id, connection_id, workflow_id)
    REFERENCES computer_workflows (tenant_id, connection_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT computer_runs_agent_action_integrity
  FOREIGN KEY (tenant_id, agent_action_id) REFERENCES agent_actions (tenant_id, id) ON DELETE SET NULL (agent_action_id),
  ADD CONSTRAINT computer_runs_node_integrity
  FOREIGN KEY (tenant_id, claimed_by) REFERENCES node_credentials (tenant_id, id) ON DELETE SET NULL (claimed_by);
ALTER TABLE computer_run_events
  ADD CONSTRAINT computer_run_events_run_integrity
  FOREIGN KEY (tenant_id, run_id) REFERENCES computer_runs (tenant_id, id) ON DELETE CASCADE;
