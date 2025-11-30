// services/authService.ts
import { apiFetch } from "@/utils/fetcher";

export const authService = {
  async register(data: any) {
    return apiFetch("/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async login(data: any) {
    return apiFetch("/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
