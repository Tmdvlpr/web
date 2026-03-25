import { apiClient } from "./axios";
import type { User } from "../types";

export const usersApi = {
  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>("/api/v1/users/me");
    return res.data;
  },

  search: async (q: string): Promise<User[]> => {
    const res = await apiClient.get<User[]>("/api/v1/users/search", { params: { q } });
    return res.data;
  },
};
