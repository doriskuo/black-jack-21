"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginSchema,
  registerSchema,
  type RegisterForm,
} from "@/schemas/authSchema";

import { useUserStore } from "@/stores/useUserStore";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type Mode = "login" | "register";

export function LoginModal({ isOpen, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const router = useRouter();
  const { login } = useUserStore();

  // login form
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // register form
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      gender: "1",
      password: "",
      confirmPassword: "",
    },
  });

  // ESC close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  /** -----------------------------------------------------
   *  🔥 最關鍵：真正呼叫後端 + 注入 token
   * ----------------------------------------------------- */
  const onLoginSubmit = loginForm.handleSubmit(async (data) => {
    try {
      const res = await authService.login(data);

      console.log("後端回傳登入資料：", res);

      const { token, user } = res;

      if (!token) {
        throw new Error("後端沒有回傳 token");
      }

      // 儲存 token + user
      login(
        {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          gender: user.gender === 1 ? "1" : "2",
        },
        token
      );

      alert("登入成功！");
      onClose();
      router.push("/game");
    } catch (err) {
      console.error(err);
      alert("登入失敗，請確認帳密");
    }
  });

  /** -----------------------------------------------------
   *  🔥 註冊（你可選：註冊後自動登入 or 不登入）
   *    目前設計：註冊成功後自動登入
   * ----------------------------------------------------- */
  const onRegisterSubmit = registerForm.handleSubmit(async (data) => {
    try {
      const res = await authService.register(data);

      console.log("後端回傳註冊資料：", res);

      const { token, user } = res;

      if (!token) {
        alert("註冊成功！請重新登入");
        setMode("login");
        return;
      }

      // 自動登入
      login(
        {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          gender: user.gender === 1 ? "1" : "2",
        },
        token
      );

      alert("註冊成功！已自動登入");
      onClose();
      router.push("/game");
    } catch (err) {
      console.error(err);
      alert("註冊失敗！");
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-all"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: -30 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="relative w-full max-w-md mx-4 max-h-[90vh] rounded-3xl 
              border border-[#c41e3a]/40 shadow-2xl ring-2 ring-[#00ffff]/40 scroll-smooth"
      >
        <div className="absolute inset-0 rounded-3xl bg-white/8 backdrop-blur-2xl" />
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#c41e3a]/20 via-[#4a0d66]/10 to-transparent opacity-80 pointer-events-none" />
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-tl from-[#00ffff]/12 to-transparent opacity-60 pointer-events-none" />

        <div className="relative overflow-y-auto max-h-[90vh]">
          <div className="px-10 md:px-12 py-10">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-white/60 hover:text-white text-3xl transition"
            >
              ✕
            </button>

            <h2 className="mb-8 text-center text-4xl font-black text-cyan-300 tracking-tight">
              {mode === "login" ? "歡迎回來" : "創建帳號"}
            </h2>

            {/* ------------------------------------------------------
                登入表單
            ------------------------------------------------------- */}
            {mode === "login" && (
              <form onSubmit={onLoginSubmit} className="space-y-6">
                <div>
                  <input
                    {...loginForm.register("email")}
                    type="email"
                    placeholder="Email"
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-white 
                           placeholder-white/50 backdrop-blur-md
                           focus:border-[#00ffff]/80 focus:outline-none 
                           focus:ring-4 focus:ring-[#00ffff]/60 
                           focus:ring-offset-2 focus:ring-offset-[#002244]/50
                           transition-all duration-300"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="mt-1 text-red-400 text-sm">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <input
                    {...loginForm.register("password")}
                    type="password"
                    placeholder="密碼"
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-white 
                           placeholder-white/50 backdrop-blur-md
                           focus:border-[#00ffff]/80 focus:outline-none 
                           focus:ring-4 focus:ring-[#00ffff]/60 
                           focus:ring-offset-2 focus:ring-offset-[#002244]/50
                           transition-all duration-300"
                  />
                  {loginForm.formState.errors.password && (
                    <p className="mt-1 text-red-400 text-sm">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="group relative w-full overflow-hidden rounded-xl 
                          bg-gradient-to-br from-[#002244]/90 via-[#001122]/80 to-[#001133]/90 
                          backdrop-blur-md px-8 py-5 text-xl font-black text-cyan-300 
                          shadow-2xl ring-2 ring-[#9a1d2a]/60 
                          hover:ring-[#c41e3a] hover:ring-4 hover:text-white 
                          hover:shadow-[#9a1d2a]/40 transition-all duration-500"
                >
                  <span
                    className="absolute inset-0 scale-0 bg-gradient-to-br from-[#9a1d2a]/40 via-[#c41e3a]/20 to-transparent 
                               rounded-xl group-hover:scale-150 transition-transform duration-700 ease-out"
                  />
                  <span className="relative z-10 drop-shadow-2xl">登入 →</span>
                </button>

                <p className="text-center text-sm text-white/60">
                  還沒有帳號？
                  <span
                    onClick={() => setMode("register")}
                    className="text-cyan-300 hover:text-white hover:underline cursor-pointer transition ml-1"
                  >
                    立即註冊
                  </span>
                </p>
              </form>
            )}

            {/* ------------------------------------------------------
                註冊表單
            ------------------------------------------------------- */}
            {mode === "register" && (
              <form onSubmit={onRegisterSubmit} className="space-y-5">
                <div>
                  <input
                    {...registerForm.register("full_name")}
                    type="text"
                    placeholder="姓名"
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-white placeholder-white/50"
                  />
                  {registerForm.formState.errors.full_name && (
                    <p className="mt-1 text-red-400 text-sm">
                      {registerForm.formState.errors.full_name.message}
                    </p>
                  )}
                </div>

                <div>
                  <input
                    {...registerForm.register("email")}
                    type="email"
                    placeholder="Email"
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-white placeholder-white/50"
                  />
                  {registerForm.formState.errors.email && (
                    <p className="mt-1 text-red-400 text-sm">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <select
                    {...registerForm.register("gender")}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-white"
                  >
                    <option value="1">男</option>
                    <option value="2">女</option>
                  </select>
                </div>

                <div>
                  <input
                    {...registerForm.register("password")}
                    type="password"
                    placeholder="密碼（至少8碼）"
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-white placeholder-white/50"
                  />
                </div>

                <div>
                  <input
                    {...registerForm.register("confirmPassword")}
                    type="password"
                    placeholder="確認密碼"
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-white placeholder-white/50"
                  />
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-4 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      {...registerForm.register("ageConfirmed")}
                      className="w-5 h-5 rounded border-white/30 bg-white/10"
                    />
                    <span className="text-white/90 text-lg">我已年滿18歲</span>
                  </label>

                  <label className="flex items-start gap-4 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      {...registerForm.register("termsConfirmed")}
                      className="w-5 h-5 rounded border-white/30 bg-white/10"
                    />
                    <span className="text-white/70 text-sm leading-relaxed">
                      您需要年滿18歲才能進入遊戲
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="group relative w-full overflow-hidden rounded-xl 
                          bg-gradient-to-br from-[#002244]/90 via-[#001122]/80 to-[#001133]/90 
                          backdrop-blur-md px-8 py-5 text-xl font-black text-cyan-300 shadow-2xl"
                >
                  <span className="relative z-10 drop-shadow-2xl">註冊 →</span>
                </button>

                <p className="text-center text-sm text-white/60">
                  已有帳號？
                  <span
                    onClick={() => setMode("login")}
                    className="text-cyan-300 hover:text-white hover:underline cursor-pointer ml-1"
                  >
                    立即登入
                  </span>
                </p>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
