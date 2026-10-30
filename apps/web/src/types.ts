// Monline record types for Monline

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  language?: string;
  main_currency?: string;
  totp_enabled?: boolean;
  totp_configured?: boolean;
  color_theme?: string;
  custom_theme_colors?: Record<string, string>;
  custom_css?: string;
  dark_theme_mode?: number; // 0=light, 1=dark, 2=auto
  monthly_price?: boolean;
  show_original_price?: boolean;
  show_currency_code?: boolean;
  hide_disabled?: boolean;
  disabled_to_bottom?: boolean;
  subscription_progress?: boolean;
  mobile_navigation?: boolean;
  remove_background?: boolean;
  convert_currency?: boolean;
  budget?: number;
  payment_tracking?: boolean;
}

export interface PaymentRecord {
  id: string;
  subscription_id: string;
  /** Name and currency for a payment without a subscription. */
  name?: string;
  currency?: string;
  logo?: string;
  category?: string;
  payment_method?: string;
  payer?: string;
  expand?: {
    currency?: Currency;
    category?: Category;
    payment_method?: PaymentMethod;
    payer?: Household;
  };
  user: string;
  due_date: string; // YYYY-MM-DD
  scheduled_date?: string; // Original occurrence before moving its calendar date
  paid_at?: string; // ISO datetime
  auto_paid?: boolean;
  amount?: number;
  notes?: string;
  proof?: string; // filename
  statement_sources?: string[];
}

/** One logged change to a subscription, as written by the backend hooks. */
export type SubscriptionHistoryEventType =
  "created" | "price_changed" | "cycle_changed" | "currency_changed" | "paused" | "resumed";

export interface SubscriptionHistoryEvent {
  id: string;
  event_type: SubscriptionHistoryEventType;
  /** YYYY-MM-DD the change applies from. */
  effective_date: string;
  old_price: number;
  new_price: number;
  old_cycle: string;
  new_cycle: string;
  old_frequency: number;
  new_frequency: number;
  old_currency: string;
  new_currency: string;
  /** "backfilled" on events the upgrade migration synthesised. */
  note?: string;
  created?: string;
}

export interface SubscriptionHistoryTotals {
  /** Start of the price timeline; empty when the subscription has no history. */
  since: string;
  until: string;
  /** Replay of the billing schedule against the price timeline. */
  estimated_total: number;
  estimated_payments: number;
  last_estimated_date: string;
  /** Payments the user confirmed through payment tracking. */
  paid_total: number;
  paid_payments: number;
  last_paid_date: string;
}

export interface SubscriptionHistory {
  subscription: {
    id: string;
    name: string;
    record_type: "expense" | "credit";
    currency: string;
    currency_symbol: string;
    cycle: string;
    frequency: number;
    price: number;
  };
  events: SubscriptionHistoryEvent[];
  timeline: Array<{
    from: string;
    price: number;
    cycleName: string;
    frequency: number;
  }>;
  totals: SubscriptionHistoryTotals;
}

export interface Subscription {
  is_shared?: boolean;
  calendar_projection_hidden?: boolean;
  /** Original billing day, preserved when shorter months clamp the due date. */
  billing_anchor_day?: number;
  id: string;
  /** Present only on the display model of an independent payment. */
  standalone_payment_id?: string;
  name: string;
  logo?: string;
  price: number;
  currency: string;
  frequency: number;
  cycle: string;
  next_payment: string;
  auto_renew: boolean;
  start_date: string;
  /** Has been linked to an imported bank statement. */
  statement_imported?: boolean;
  payment_method?: string;
  payer?: string;
  category?: string;
  notes?: string;
  url?: string;
  notify: boolean;
  notify_days_before: number;
  inactive: boolean;
  auto_mark_paid?: boolean;
  cancellation_date?: string;
  /** Inclusive date of the last scheduled payment. */
  end_date?: string;
  /** Total number of scheduled payments; zero/absent means unlimited. */
  payment_limit?: number;
  /** Scheduled payments elapsed for a finite (count- or date-limited) subscription. */
  payments_completed?: number;
  replacement_subscription?: string;
  user: string;
  /** Missing on legacy records; an absent value is always treated as expense. */
  record_type?: "expense" | "credit";
  // Expanded relations
  expand?: {
    currency?: Currency;
    cycle?: Cycle;
    category?: Category;
    payment_method?: PaymentMethod;
    payer?: Household;
  };
}

export interface Currency {
  id: string;
  name: string;
  code: string;
  symbol: string;
  rate: number;
  is_main: boolean;
  user: string;
}

export interface Category {
  id: string;
  name: string;
  translation_key?: string;
  user: string;
}

export interface PaymentMethod {
  finance_card?: string;
  id: string;
  name: string;
  icon?: string;
  order?: number;
  is_main?: boolean;
  user: string;
}

export interface Household {
  account_id?: string;
  account_email?: string;
  account_name?: string;
  account_confirmed?: boolean;
  invitation_status?: "confirmed" | "pending" | "expired" | "delivery_failed" | "not_requested";
  id: string;
  name: string;
  user: string;
  is_main?: boolean;
}

export interface Cycle {
  id: string;
  name: "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Half-Yearly" | "Yearly" | "One-Time";
}

export interface Frequency {
  id: string;
  name: string;
  cycle: string;
  value: number;
}

export interface NotificationReminder {
  days: number; // 0 = on payment day, 1 = 1 day before, etc.
  hour: number; // 0–23
}

export type NotificationEvent = "payment" | "cancellation";
export interface NotificationTemplate {
  title?: string;
  message?: string;
  html?: string;
}
export type NotificationTemplates = Record<
  string,
  Partial<Record<NotificationEvent, NotificationTemplate>>
>;

export interface NotificationsConfig {
  template_language?: string;
  localized_templates?: Record<string, NotificationTemplates>;
  templates?: NotificationTemplates;
  template_defaults?: Record<NotificationEvent, NotificationTemplate>;
  available_channels?: Record<string, boolean>;
  id: string;
  user: string;
  reminders?: NotificationReminder[];
  // Email
  email_enabled?: boolean;
  email_to?: string;
  // Discord
  discord_enabled?: boolean;
  discord_webhook_url?: string;
  // Telegram
  telegram_enabled?: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  // Gotify
  gotify_enabled?: boolean;
  gotify_url?: string;
  gotify_token?: string;
  // Pushover
  pushover_enabled?: boolean;
  pushover_user_key?: string;
  pushover_api_token?: string;
  // ntfy
  ntfy_enabled?: boolean;
  ntfy_url?: string;
  ntfy_topic?: string;
  ntfy_username?: string;
  ntfy_password?: string;
  ntfy_auth_token?: string;
  // Pushplus
  pushplus_enabled?: boolean;
  pushplus_token?: string;
  // Mattermost
  mattermost_enabled?: boolean;
  mattermost_webhook_url?: string;
  // Webhook
  webhook_enabled?: boolean;
  webhook_url?: string;
  // Serverchan
  serverchan_enabled?: boolean;
  serverchan_send_key?: string;
}

export interface FixerSettings {
  id: string;
  user: string;
  enabled: boolean;
  api_key?: string;
  api_key_configured?: boolean;
  provider: "fixer" | "apilayer";
  base_currency?: string;
}

export interface AdminSettings {
  id: string;
  open_registrations: boolean;
  max_users?: number;
  require_email_validation?: boolean;
  server_url?: string;
  disable_login: boolean;
  update_notification: boolean;
  oidc_enabled?: boolean;
  oidc_provider_name?: string;
  oidc_display_name?: string;
  oidc_client_id?: string;
  oidc_client_secret?: string;
  oidc_client_secret_configured?: boolean;
  oidc_issuer_url?: string;
  oidc_redirect_url?: string;
  oidc_redirect_uri?: string;
  oidc_scopes?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_email?: string;
  smtp_from_name?: string;
  smtp_encryption?: string;
  smtp_enabled?: boolean;
}

export interface YearlyCost {
  id: string;
  user: string;
  year: number;
  month: number;
  total: number;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export type ApiKeyPermission =
  | "subscriptions:read"
  | "subscriptions:write"
  | "calendar:read"
  | "statistics:read"
  | "categories:read"
  | "categories:write"
  | "payment_methods:read"
  | "payment_methods:write"
  | "household:read"
  | "household:write"
  | "currencies:read"
  | "currencies:write";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: ApiKeyPermission[];
  last_used_at: string | null;
  created: string;
}

/** Returned only once, immediately after creation */
export interface ApiKeyCreated extends ApiKey {
  key: string;
}

export type SortOption = "name" | "price" | "date" | "status";
export type FilterState = {
  category: string[];
  member: string[];
  payment: string[];
  state: "all" | "active" | "inactive";
};

export type SettingsSearch = { tab?: string };
