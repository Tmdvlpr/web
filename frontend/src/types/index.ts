export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface User {
  id: number;
  telegram_id: number;
  name: string;
  username: string | null;
  role: "user" | "admin";
}

export interface Booking {
  id: number;
  title: string;
  description: string | null;
  start_time: string; // ISO 8601
  end_time: string;
  user_id: number;
  user: User;
  created_at: string;
  guests: string[];
  recurrence: "none" | "daily" | "weekly" | "custom";
  recurrence_until: string | null;
  recurrence_group_id: number | null;
  recurrence_days: number[];
}

export interface BookingCreate {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  guests?: string[];
  recurrence?: "none" | "daily" | "weekly" | "custom";
  recurrence_until?: string;
  recurrence_days?: number[];
}

export interface BookingUpdate {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  guests?: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface QRSession {
  token: string;
  bot_name: string;
}

export interface QRStatus {
  status: "pending" | "authenticated" | "expired";
  access_token?: string;
  token_type?: string;
}
