import { create } from "zustand";

export type User = {
  id: number;
  full_name: string;
  email: string;
  gender: "1" | "2";
};

type UserStore = {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void; // ⭐ 加這個
};

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  token: null,

  // 登入：寫入 localStorage + store
  login: (user, token) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
    set({ user, token });
  },

  // 登出
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
    set({ user: null, token: null });
  },

  // ⭐ 讓 GamePage 重整後能把 token 從 localStorage 抓回來
  hydrate: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");

      if (token) {
        set({ token }); // 只要把 token 塞回去即可
      }
    }
  },
}));
