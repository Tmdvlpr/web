import axios from "axios";
import type { Booking, BookingCreate, BookingUpdate, QRSession, QRStatus, TelegramUser, TokenResponse, User } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  loginWithTelegram: async (data: TelegramUser): Promise<TokenResponse> => {
    const res = await apiClient.post<TokenResponse>("/auth/telegram", data);
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>("/auth/me");
    return res.data;
  },
  createQRSession: async (): Promise<QRSession> => {
    const res = await apiClient.post<QRSession>("/auth/qr");
    return res.data;
  },
  pollQRSession: async (token: string): Promise<QRStatus> => {
    const res = await apiClient.get<QRStatus>(`/auth/qr/${token}`);
    return res.data;
  },
  getUsers: async (): Promise<User[]> => {
    const res = await apiClient.get<User[]>("/auth/users");
    return res.data;
  },
};

export const bookingsApi = {
  getActive: async (): Promise<Booking[]> => {
    const res = await apiClient.get<Booking[]>("/bookings/active");
    return res.data;
  },
  getByDate: async (date: string): Promise<Booking[]> => {
    const res = await apiClient.get<Booking[]>("/bookings", { params: { date } });
    return res.data;
  },
  create: async (payload: BookingCreate): Promise<Booking[]> => {
    const res = await apiClient.post<Booking[]>("/bookings", payload);
    return res.data;
  },
  update: async (id: number, payload: BookingUpdate): Promise<Booking> => {
    const res = await apiClient.patch<Booking>(`/bookings/${id}`, payload);
    return res.data;
  },
  delete: async (id: number, deleteSeries = false): Promise<void> => {
    await apiClient.delete(`/bookings/${id}`, { params: deleteSeries ? { delete_series: true } : {} });
  },
  exportHistory: async (): Promise<void> => {
    const res = await apiClient.get("/bookings/export", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meetaholic_history_${new Date().toISOString().slice(0, 10)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },
};
