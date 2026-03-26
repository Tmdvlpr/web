import { apiClient } from "./axios";
import type { AdminStats, User } from "../types";

export const usersApi = {
  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>("/api/v1/users/me");
    return res.data;
  },

  search: async (q: string): Promise<User[]> => {
    const res = await apiClient.get<User[]>("/api/v1/users/search", { params: { q } });
    return res.data;
  },

  getFeedToken: async (): Promise<string> => {
    const res = await apiClient.post<{ feed_token: string }>("/api/v1/users/feed-token");
    return res.data.feed_token;
  },

  adminListUsers: async (): Promise<User[]> => {
    const res = await apiClient.get<User[]>("/api/v1/users/admin/users");
    return res.data;
  },

  adminStats: async (): Promise<AdminStats> => {
    const res = await apiClient.get<AdminStats>("/api/v1/users/admin/stats");
    return res.data;
  },
};
