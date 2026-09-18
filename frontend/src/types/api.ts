/**
 * Typed API contracts. These mirror the Pydantic schemas in
 * `backend/app/schemas` one-for-one; no response is consumed untyped.
 *
 * All timestamps are naive local wall-clock ISO strings without an offset
 * (`"2026-09-18T03:53:00"`). Never hand them to `new Date()` expecting UTC.
 */

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture_url: string | null;
  created_at: string;
}

export interface SessionState {
  authenticated: boolean;
  user: AuthUser | null;
  google_sign_in_enabled: boolean;
  /** Public OAuth client id, supplied by the server so the browser needs no env. */
  google_client_id: string;
  /** True when the account came from the local dev bypass, not from Google. */
  is_dev_session: boolean;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface SubActivity {
  id: number;
  activity_id: number;
  title: string;
  notes: string | null;
  start_at: string;
  end_at: string;
}

export interface Activity {
  id: number;
  title: string;
  notes: string | null;
  start_at: string;
  end_at: string;
  category_id: number | null;
  category: Category | null;
  sub_activities: SubActivity[];
}

export interface DayTotal {
  date: string;
  tracked_minutes: number;
  activity_count: number;
}

export interface CategoryTotal {
  category_id: number | null;
  category_name: string;
  color: string;
  tracked_minutes: number;
}

export interface MonthStats {
  month: string;
  tracked_minutes: number;
  activity_count: number;
  tracked_days: number;
  busiest_day: string | null;
  per_day: DayTotal[];
  per_category: CategoryTotal[];
}

/* ------------------------------- requests -------------------------------- */

export interface SubActivityInput {
  title: string;
  notes: string | null;
  start_at: string;
  end_at: string;
}

export interface ActivityCreateInput {
  title: string;
  notes: string | null;
  start_at: string;
  end_at: string;
  category_id: number | null;
  sub_activities: SubActivityInput[];
}

export type ActivityUpdateInput = Partial<Omit<ActivityCreateInput, "sub_activities">>;

export type SubActivityUpdateInput = Partial<SubActivityInput>;

export interface CategoryCreateInput {
  name: string;
  color: string;
}

export type CategoryUpdateInput = Partial<CategoryCreateInput>;

/* -------------------------------- errors --------------------------------- */

export interface FieldError {
  field: string;
  message: string;
}

export interface ErrorResponse {
  detail: FieldError[];
}
