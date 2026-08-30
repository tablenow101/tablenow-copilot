-- Complete operating model for service, guests, communications, team,
-- inventory, procurement and provider-neutral integrations.

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_source_check;
ALTER TABLE reservations
  ADD CONSTRAINT reservations_source_check
  CHECK (source IN ('manual', 'phone', 'web', 'copilot', 'integration', 'calendar', 'paper', 'import'));

ALTER TABLE communications DROP CONSTRAINT IF EXISTS communications_channel_check;
ALTER TABLE communications
  ADD CONSTRAINT communications_channel_check
  CHECK (channel IN ('phone', 'email', 'sms', 'whatsapp', 'web', 'instagram', 'messenger', 'google', 'other'));

CREATE TABLE restaurant_business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at time,
  closes_at time,
  is_closed boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  CHECK (is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL))
);
CREATE UNIQUE INDEX restaurant_business_hours_unique
  ON restaurant_business_hours (restaurant_id, weekday, coalesce(valid_from, '-infinity'::date));

CREATE TABLE service_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  default_capacity integer NOT NULL CHECK (default_capacity > 0),
  default_turn_minutes integer NOT NULL DEFAULT 120 CHECK (default_turn_minutes BETWEEN 15 AND 720),
  booking_interval_minutes integer NOT NULL DEFAULT 15 CHECK (booking_interval_minutes BETWEEN 5 AND 180),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name, weekday, starts_at)
);

CREATE TABLE service_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  service_period_id uuid,
  service_date date NOT NULL,
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (restaurant_id, service_date, name)
);
CREATE INDEX service_instances_date ON service_instances (tenant_id, restaurant_id, service_date, status);

CREATE TABLE restaurant_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'calendar', 'integration', 'copilot')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX restaurant_closures_period ON restaurant_closures (tenant_id, restaurant_id, starts_at, ends_at);

CREATE TABLE dining_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES dining_areas(id) ON DELETE CASCADE,
  name text NOT NULL,
  minimum_party_size integer NOT NULL DEFAULT 1 CHECK (minimum_party_size > 0),
  maximum_party_size integer NOT NULL CHECK (maximum_party_size > 0),
  shape text NOT NULL DEFAULT 'rectangle' CHECK (shape IN ('rectangle', 'round', 'square', 'bar', 'other')),
  position_x numeric(8,3),
  position_y numeric(8,3),
  rotation_degrees numeric(6,2) NOT NULL DEFAULT 0,
  accessible boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (maximum_party_size >= minimum_party_size),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE table_combinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  minimum_party_size integer NOT NULL CHECK (minimum_party_size > 0),
  maximum_party_size integer NOT NULL CHECK (maximum_party_size >= minimum_party_size),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE table_combination_members (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  combination_id uuid NOT NULL REFERENCES table_combinations(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (combination_id, table_id)
);

CREATE TABLE guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  home_restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  display_name text NOT NULL,
  email text,
  normalized_email text,
  phone text,
  normalized_phone text,
  preferred_language text NOT NULL DEFAULT 'fr' CHECK (preferred_language IN ('fr', 'en', 'other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'anonymized')),
  visit_count integer NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  no_show_count integer NOT NULL DEFAULT 0 CHECK (no_show_count >= 0),
  last_visit_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guests_email_lookup ON guests (tenant_id, normalized_email) WHERE normalized_email IS NOT NULL;
CREATE INDEX guests_phone_lookup ON guests (tenant_id, normalized_phone) WHERE normalized_phone IS NOT NULL;

CREATE TABLE guest_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('booking', 'service', 'marketing', 'loyalty', 'model_improvement')),
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone', 'none')),
  status text NOT NULL CHECK (status IN ('granted', 'denied', 'withdrawn')),
  source text NOT NULL,
  proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guest_id, purpose, channel)
);

CREATE TABLE guest_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE guest_tag_assignments (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES guest_tags(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guest_id, tag_id)
);

CREATE TABLE waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_phone text,
  party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 100),
  desired_at timestamptz NOT NULL,
  flexible_minutes integer NOT NULL DEFAULT 0 CHECK (flexible_minutes BETWEEN 0 AND 1440),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'booked', 'expired', 'cancelled')),
  notes text,
  offered_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX waitlist_service ON waitlist_entries (tenant_id, restaurant_id, desired_at, status);

ALTER TABLE reservations
  ADD COLUMN guest_id uuid,
  ADD COLUMN service_instance_id uuid,
  ADD COLUMN source_system_id uuid,
  ADD COLUMN expected_duration_minutes integer NOT NULL DEFAULT 120 CHECK (expected_duration_minutes BETWEEN 15 AND 720),
  ADD COLUMN special_requests text,
  ADD COLUMN cancellation_reason text,
  ADD COLUMN arrived_at timestamptz,
  ADD COLUMN seated_at timestamptz,
  ADD COLUMN completed_at timestamptz;

CREATE TABLE reservation_table_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'seated', 'released', 'cancelled')),
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (reservation_id, table_id)
);
CREATE INDEX reservation_table_timeline
  ON reservation_table_assignments (tenant_id, restaurant_id, table_id, starts_at, ends_at)
  WHERE status IN ('planned', 'seated');

CREATE TABLE reservation_events (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated', 'confirmed', 'reminded', 'arrived', 'seated', 'completed', 'cancelled', 'no_show', 'note')),
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'guest', 'integration', 'copilot', 'system')),
  actor_id text,
  previous_state jsonb,
  new_state jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservation_events_timeline ON reservation_events (tenant_id, reservation_id, occurred_at);

CREATE TABLE communication_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('phone', 'email', 'sms', 'whatsapp', 'web', 'instagram', 'messenger', 'google', 'other')),
  external_thread_id text,
  subject text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_guest', 'waiting_team', 'resolved', 'archived')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX communication_threads_queue
  ON communication_threads (tenant_id, restaurant_id, status, priority, last_message_at DESC);
CREATE UNIQUE INDEX communication_threads_external
  ON communication_threads (tenant_id, restaurant_id, channel, external_thread_id)
  WHERE external_thread_id IS NOT NULL;

CREATE TABLE communication_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES communication_threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
  sender_label text,
  recipient_label text,
  body text NOT NULL,
  body_format text NOT NULL DEFAULT 'text' CHECK (body_format IN ('text', 'html', 'structured')),
  delivery_status text NOT NULL DEFAULT 'received' CHECK (delivery_status IN ('draft', 'queued', 'sent', 'delivered', 'read', 'received', 'failed')),
  external_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX communication_messages_timeline ON communication_messages (tenant_id, thread_id, created_at);
CREATE UNIQUE INDEX communication_messages_external
  ON communication_messages (tenant_id, restaurant_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

ALTER TABLE communications
  ADD COLUMN thread_id uuid,
  ADD COLUMN guest_id uuid,
  ADD COLUMN reservation_id uuid;

CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  email text,
  phone text,
  role_title text NOT NULL,
  employment_type text NOT NULL DEFAULT 'employee' CHECK (employment_type IN ('employee', 'contractor', 'temporary', 'owner')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'inactive', 'departed')),
  hired_at date,
  left_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (left_at IS NULL OR hired_at IS NULL OR left_at >= hired_at)
);
CREATE INDEX team_members_active ON team_members (tenant_id, restaurant_id, status, display_name);

CREATE TABLE team_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  available_from time,
  available_until time,
  unavailable boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (unavailable OR (available_from IS NOT NULL AND available_until IS NOT NULL)),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

ALTER TABLE team_shifts ADD COLUMN team_member_id uuid;

CREATE TABLE inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'storage' CHECK (kind IN ('storage', 'bar', 'kitchen', 'cellar', 'freezer', 'other')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE inventory_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  counted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventory_item_id, location_id)
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  ordering_method text NOT NULL DEFAULT 'email' CHECK (ordering_method IN ('email', 'phone', 'web', 'api', 'manual')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE supplier_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  supplier_sku text,
  order_unit text NOT NULL,
  units_per_order numeric(12,3) NOT NULL DEFAULT 1 CHECK (units_per_order > 0),
  last_unit_price numeric(12,4) CHECK (last_unit_price IS NULL OR last_unit_price >= 0),
  currency char(3) NOT NULL DEFAULT 'EUR',
  lead_time_days integer NOT NULL DEFAULT 1 CHECK (lead_time_days BETWEEN 0 AND 365),
  minimum_order_quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (minimum_order_quantity > 0),
  preferred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, inventory_item_id)
);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('receipt', 'consumption', 'waste', 'adjustment', 'transfer_in', 'transfer_out', 'count')),
  quantity_delta numeric(12,3) NOT NULL CHECK (quantity_delta <> 0),
  unit_cost numeric(12,4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  reason text,
  reference_type text,
  reference_id text,
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_timeline ON stock_movements (tenant_id, restaurant_id, inventory_item_id, occurred_at DESC);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'sent', 'partially_received', 'received', 'cancelled')),
  expected_at timestamptz,
  sent_at timestamptz,
  received_at timestamptz,
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency char(3) NOT NULL DEFAULT 'EUR',
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  received_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit text NOT NULL,
  unit_price numeric(12,4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (received_quantity <= quantity)
);

CREATE TABLE menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency char(3) NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'unavailable', 'retired')),
  allergens text[] NOT NULL DEFAULT '{}',
  preparation_minutes integer CHECK (preparation_minutes IS NULL OR preparation_minutes BETWEEN 0 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE menu_item_ingredients (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  waste_factor numeric(5,2) NOT NULL DEFAULT 0 CHECK (waste_factor BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (menu_item_id, inventory_item_id)
);

CREATE TABLE metric_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  target_value numeric(14,4) NOT NULL,
  period text NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  valid_from date NOT NULL,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  UNIQUE (restaurant_id, metric_key, period, valid_from)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'dismissed')),
  action_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_inbox ON notifications (tenant_id, user_id, status, created_at DESC);

CREATE TABLE product_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route text,
  category text NOT NULL CHECK (category IN ('bug', 'confusion', 'idea', 'praise', 'critical')),
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'qualified', 'planned', 'delivered', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE external_record_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES restaurant_systems(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  external_id text NOT NULL,
  external_version text,
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_id, resource_type, external_id),
  UNIQUE (system_id, resource_type, resource_id)
);

CREATE TABLE webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES restaurant_systems(id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'ignored', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (system_id, external_event_id)
);
CREATE INDEX webhook_inbox_ready ON webhook_inbox (tenant_id, status, received_at) WHERE status IN ('received', 'failed');

CREATE TABLE sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  system_id uuid REFERENCES restaurant_systems(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  local_state jsonb NOT NULL,
  remote_state jsonb NOT NULL,
  resolution text CHECK (resolution IN ('keep_local', 'keep_remote', 'merged', 'discarded')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sync_conflicts_open ON sync_conflicts (tenant_id, restaurant_id, status, created_at DESC);

-- Audit data is tenant-owned whenever tenant_id is present. Platform-wide
-- events with a NULL tenant remain visible only through explicit platform access.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_events
  USING (tenant_id = app_current_tenant() OR app_platform_access())
  WITH CHECK (tenant_id = app_current_tenant() OR app_platform_access());

-- Composite identities used to prove that every reference stays in one tenant
-- and, where applicable, one restaurant.
CREATE UNIQUE INDEX service_periods_tenant_restaurant_identity ON service_periods (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX service_instances_tenant_restaurant_identity ON service_instances (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX dining_areas_tenant_restaurant_identity ON dining_areas (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX dining_tables_tenant_restaurant_identity ON dining_tables (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX table_combinations_tenant_restaurant_identity ON table_combinations (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX guests_tenant_identity ON guests (tenant_id, id);
CREATE UNIQUE INDEX guest_tags_tenant_identity ON guest_tags (tenant_id, id);
CREATE UNIQUE INDEX reservations_tenant_restaurant_identity ON reservations (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX communication_threads_tenant_restaurant_identity ON communication_threads (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX team_members_tenant_restaurant_identity ON team_members (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX inventory_items_tenant_restaurant_identity ON inventory_items (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX inventory_locations_tenant_restaurant_identity ON inventory_locations (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX suppliers_tenant_identity ON suppliers (tenant_id, id);
CREATE UNIQUE INDEX purchase_orders_tenant_restaurant_identity ON purchase_orders (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX menu_items_tenant_restaurant_identity ON menu_items (tenant_id, restaurant_id, id);

ALTER TABLE restaurant_business_hours
  ADD CONSTRAINT restaurant_business_hours_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE service_periods
  ADD CONSTRAINT service_periods_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE service_instances
  ADD CONSTRAINT service_instances_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT service_instances_period_integrity
  FOREIGN KEY (tenant_id, restaurant_id, service_period_id)
    REFERENCES service_periods (tenant_id, restaurant_id, id) ON DELETE SET NULL (service_period_id);
ALTER TABLE restaurant_closures
  ADD CONSTRAINT restaurant_closures_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT restaurant_closures_creator_integrity
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (created_by);
ALTER TABLE dining_areas
  ADD CONSTRAINT dining_areas_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE dining_tables
  ADD CONSTRAINT dining_tables_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT dining_tables_area_integrity
  FOREIGN KEY (tenant_id, restaurant_id, area_id)
    REFERENCES dining_areas (tenant_id, restaurant_id, id) ON DELETE CASCADE;
ALTER TABLE table_combinations
  ADD CONSTRAINT table_combinations_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE table_combination_members
  ADD CONSTRAINT table_combination_members_combination_integrity
  FOREIGN KEY (tenant_id, restaurant_id, combination_id)
    REFERENCES table_combinations (tenant_id, restaurant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT table_combination_members_table_integrity
  FOREIGN KEY (tenant_id, restaurant_id, table_id)
    REFERENCES dining_tables (tenant_id, restaurant_id, id) ON DELETE CASCADE;

ALTER TABLE guests
  ADD CONSTRAINT guests_home_restaurant_integrity
  FOREIGN KEY (tenant_id, home_restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE SET NULL (home_restaurant_id);
ALTER TABLE guest_consents
  ADD CONSTRAINT guest_consents_guest_integrity
  FOREIGN KEY (tenant_id, guest_id) REFERENCES guests (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE guest_tag_assignments
  ADD CONSTRAINT guest_tag_assignments_guest_integrity
  FOREIGN KEY (tenant_id, guest_id) REFERENCES guests (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT guest_tag_assignments_tag_integrity
  FOREIGN KEY (tenant_id, tag_id) REFERENCES guest_tags (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT guest_tag_assignments_actor_integrity
  FOREIGN KEY (tenant_id, assigned_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (assigned_by);
ALTER TABLE waitlist_entries
  ADD CONSTRAINT waitlist_entries_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT waitlist_entries_guest_integrity
  FOREIGN KEY (tenant_id, guest_id) REFERENCES guests (tenant_id, id) ON DELETE SET NULL (guest_id);

ALTER TABLE reservations
  ADD CONSTRAINT reservations_guest_integrity
  FOREIGN KEY (tenant_id, guest_id) REFERENCES guests (tenant_id, id) ON DELETE SET NULL (guest_id),
  ADD CONSTRAINT reservations_service_integrity
  FOREIGN KEY (tenant_id, restaurant_id, service_instance_id)
    REFERENCES service_instances (tenant_id, restaurant_id, id) ON DELETE SET NULL (service_instance_id),
  ADD CONSTRAINT reservations_source_system_integrity
  FOREIGN KEY (tenant_id, restaurant_id, source_system_id)
    REFERENCES restaurant_systems (tenant_id, restaurant_id, id) ON DELETE SET NULL (source_system_id);
ALTER TABLE reservation_table_assignments
  ADD CONSTRAINT reservation_table_assignments_reservation_integrity
  FOREIGN KEY (tenant_id, restaurant_id, reservation_id)
    REFERENCES reservations (tenant_id, restaurant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT reservation_table_assignments_table_integrity
  FOREIGN KEY (tenant_id, restaurant_id, table_id)
    REFERENCES dining_tables (tenant_id, restaurant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT reservation_table_assignments_actor_integrity
  FOREIGN KEY (tenant_id, assigned_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (assigned_by);
ALTER TABLE reservation_events
  ADD CONSTRAINT reservation_events_reservation_integrity
  FOREIGN KEY (tenant_id, restaurant_id, reservation_id)
    REFERENCES reservations (tenant_id, restaurant_id, id) ON DELETE CASCADE;

ALTER TABLE communication_threads
  ADD CONSTRAINT communication_threads_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT communication_threads_guest_integrity
  FOREIGN KEY (tenant_id, guest_id) REFERENCES guests (tenant_id, id) ON DELETE SET NULL (guest_id),
  ADD CONSTRAINT communication_threads_reservation_integrity
  FOREIGN KEY (tenant_id, restaurant_id, reservation_id)
    REFERENCES reservations (tenant_id, restaurant_id, id) ON DELETE SET NULL (reservation_id),
  ADD CONSTRAINT communication_threads_assignee_integrity
  FOREIGN KEY (tenant_id, assigned_to) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (assigned_to);
ALTER TABLE communication_messages
  ADD CONSTRAINT communication_messages_thread_integrity
  FOREIGN KEY (tenant_id, restaurant_id, thread_id)
    REFERENCES communication_threads (tenant_id, restaurant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT communication_messages_creator_integrity
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (created_by);
CREATE UNIQUE INDEX communications_tenant_identity ON communications (tenant_id, id);
ALTER TABLE communications
  ADD CONSTRAINT communications_thread_integrity
  FOREIGN KEY (tenant_id, restaurant_id, thread_id)
    REFERENCES communication_threads (tenant_id, restaurant_id, id) ON DELETE SET NULL (thread_id),
  ADD CONSTRAINT communications_guest_integrity
  FOREIGN KEY (tenant_id, guest_id) REFERENCES guests (tenant_id, id) ON DELETE SET NULL (guest_id),
  ADD CONSTRAINT communications_reservation_integrity
  FOREIGN KEY (tenant_id, restaurant_id, reservation_id)
    REFERENCES reservations (tenant_id, restaurant_id, id) ON DELETE SET NULL (reservation_id);

ALTER TABLE team_members
  ADD CONSTRAINT team_members_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT team_members_membership_integrity
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (user_id);
ALTER TABLE team_availability
  ADD CONSTRAINT team_availability_member_integrity
  FOREIGN KEY (tenant_id, restaurant_id, team_member_id)
    REFERENCES team_members (tenant_id, restaurant_id, id) ON DELETE CASCADE;
ALTER TABLE time_off_requests
  ADD CONSTRAINT time_off_requests_member_integrity
  FOREIGN KEY (tenant_id, restaurant_id, team_member_id)
    REFERENCES team_members (tenant_id, restaurant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT time_off_requests_decider_integrity
  FOREIGN KEY (tenant_id, decided_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (decided_by);
ALTER TABLE team_shifts
  ADD CONSTRAINT team_shifts_member_integrity
  FOREIGN KEY (tenant_id, restaurant_id, team_member_id)
    REFERENCES team_members (tenant_id, restaurant_id, id) ON DELETE SET NULL (team_member_id);

ALTER TABLE inventory_locations
  ADD CONSTRAINT inventory_locations_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE inventory_balances
  ADD CONSTRAINT inventory_balances_item_integrity
  FOREIGN KEY (tenant_id, restaurant_id, inventory_item_id)
    REFERENCES inventory_items (tenant_id, restaurant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT inventory_balances_location_integrity
  FOREIGN KEY (tenant_id, restaurant_id, location_id)
    REFERENCES inventory_locations (tenant_id, restaurant_id, id) ON DELETE CASCADE;
ALTER TABLE supplier_items
  ADD CONSTRAINT supplier_items_supplier_integrity
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT supplier_items_inventory_integrity
  FOREIGN KEY (tenant_id, restaurant_id, inventory_item_id)
    REFERENCES inventory_items (tenant_id, restaurant_id, id) ON DELETE CASCADE;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_item_integrity
  FOREIGN KEY (tenant_id, restaurant_id, inventory_item_id)
    REFERENCES inventory_items (tenant_id, restaurant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_location_integrity
  FOREIGN KEY (tenant_id, restaurant_id, location_id)
    REFERENCES inventory_locations (tenant_id, restaurant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_actor_integrity
  FOREIGN KEY (tenant_id, recorded_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (recorded_by);
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT purchase_orders_supplier_integrity
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT purchase_orders_creator_integrity
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (created_by),
  ADD CONSTRAINT purchase_orders_approver_integrity
  FOREIGN KEY (tenant_id, approved_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (approved_by);
ALTER TABLE purchase_order_lines
  ADD CONSTRAINT purchase_order_lines_order_integrity
  FOREIGN KEY (tenant_id, restaurant_id, purchase_order_id)
    REFERENCES purchase_orders (tenant_id, restaurant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT purchase_order_lines_item_integrity
  FOREIGN KEY (tenant_id, restaurant_id, inventory_item_id)
    REFERENCES inventory_items (tenant_id, restaurant_id, id) ON DELETE RESTRICT;
ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE menu_item_ingredients
  ADD CONSTRAINT menu_item_ingredients_menu_integrity
  FOREIGN KEY (tenant_id, restaurant_id, menu_item_id)
    REFERENCES menu_items (tenant_id, restaurant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT menu_item_ingredients_inventory_integrity
  FOREIGN KEY (tenant_id, restaurant_id, inventory_item_id)
    REFERENCES inventory_items (tenant_id, restaurant_id, id) ON DELETE RESTRICT;

ALTER TABLE metric_targets
  ADD CONSTRAINT metric_targets_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT notifications_membership_integrity
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE;
ALTER TABLE product_feedback
  ADD CONSTRAINT product_feedback_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE SET NULL (restaurant_id),
  ADD CONSTRAINT product_feedback_membership_integrity
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE;

ALTER TABLE external_record_links
  ADD CONSTRAINT external_record_links_system_integrity
  FOREIGN KEY (tenant_id, restaurant_id, system_id)
    REFERENCES restaurant_systems (tenant_id, restaurant_id, id) ON DELETE CASCADE;
ALTER TABLE webhook_inbox
  ADD CONSTRAINT webhook_inbox_system_integrity
  FOREIGN KEY (tenant_id, restaurant_id, system_id)
    REFERENCES restaurant_systems (tenant_id, restaurant_id, id) ON DELETE CASCADE;
ALTER TABLE sync_conflicts
  ADD CONSTRAINT sync_conflicts_restaurant_integrity
  FOREIGN KEY (tenant_id, restaurant_id) REFERENCES restaurants (tenant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT sync_conflicts_system_integrity
  FOREIGN KEY (tenant_id, restaurant_id, system_id)
    REFERENCES restaurant_systems (tenant_id, restaurant_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT sync_conflicts_resolver_integrity
  FOREIGN KEY (tenant_id, resolved_by) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (resolved_by);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'restaurant_business_hours', 'service_periods', 'service_instances', 'restaurant_closures',
    'dining_areas', 'dining_tables', 'table_combinations', 'table_combination_members',
    'guests', 'guest_consents', 'guest_tags', 'guest_tag_assignments', 'waitlist_entries',
    'reservation_table_assignments', 'reservation_events', 'communication_threads',
    'communication_messages', 'team_members', 'team_availability', 'time_off_requests',
    'inventory_locations', 'inventory_balances', 'suppliers', 'supplier_items', 'stock_movements',
    'purchase_orders', 'purchase_order_lines', 'menu_items', 'menu_item_ingredients', 'metric_targets',
    'notifications', 'product_feedback', 'external_record_links', 'webhook_inbox', 'sync_conflicts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_current_tenant() OR app_platform_access()) WITH CHECK (tenant_id = app_current_tenant() OR app_platform_access())',
      table_name
    );
  END LOOP;
END $$;

CREATE TRIGGER restaurant_business_hours_updated_at BEFORE UPDATE ON restaurant_business_hours FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER service_periods_updated_at BEFORE UPDATE ON service_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER service_instances_updated_at BEFORE UPDATE ON service_instances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dining_areas_updated_at BEFORE UPDATE ON dining_areas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dining_tables_updated_at BEFORE UPDATE ON dining_tables FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER table_combinations_updated_at BEFORE UPDATE ON table_combinations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER guest_consents_updated_at BEFORE UPDATE ON guest_consents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER guest_tags_updated_at BEFORE UPDATE ON guest_tags FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER waitlist_entries_updated_at BEFORE UPDATE ON waitlist_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reservation_table_assignments_updated_at BEFORE UPDATE ON reservation_table_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER communication_threads_updated_at BEFORE UPDATE ON communication_threads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER team_availability_updated_at BEFORE UPDATE ON team_availability FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER time_off_requests_updated_at BEFORE UPDATE ON time_off_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER inventory_locations_updated_at BEFORE UPDATE ON inventory_locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER inventory_balances_updated_at BEFORE UPDATE ON inventory_balances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER supplier_items_updated_at BEFORE UPDATE ON supplier_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER purchase_order_lines_updated_at BEFORE UPDATE ON purchase_order_lines FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER metric_targets_updated_at BEFORE UPDATE ON metric_targets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER product_feedback_updated_at BEFORE UPDATE ON product_feedback FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER external_record_links_updated_at BEFORE UPDATE ON external_record_links FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sync_conflicts_updated_at BEFORE UPDATE ON sync_conflicts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
