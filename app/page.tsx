"use client";

import { useState } from "react";
import { LoginModal } from "./components/LoginModal";

export default function HomePage() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#9a1d2a] via-[#4a0d66] to-[#003366] 
                    flex items-center justify-center"
    >
      {/* 原本的首頁內容 */}
      <div className="text-center">
        <h1 className="text-8xl font-black text-white mb-4 tracking-tight">
          21 點
        </h1>
        <p className="text-2xl text-white/80 mb-12">準備好挑戰莊家了嗎？</p>

        {/* 點這個按鈕就開啟 Modal */}
        <button
          onClick={() => setIsLoginOpen(true)}
          className="group relative rounded-2xl 
                    bg-gradient-to-br from-[#002244]/90 via-[#001122]/80 to-[#001133]/90 
                    backdrop-blur-md
                    px-20 py-7 text-4xl font-black text-cyan-300 
                    shadow-2xl 
                    ring-2 ring-[#9a1d2a]/60           /* 血紅外環 */
                    hover:ring-[#c41e3a] hover:ring-4   /* hover 時變粗＋更亮 */
                    hover:text-white 
                    hover:shadow-[#9a1d2a]/40 
                    transition-all duration-500 
                    overflow-hidden"
        >
          {/* 血紅內爆發光（從中心炸開） */}
          <span
            className="absolute inset-0 scale-0 
                   bg-gradient-to-br from-[#9a1d2a]/40 via-[#c41e3a]/20 to-transparent 
                   rounded-2xl 
                   group-hover:scale-150 
                   transition-transform duration-700 ease-out"
          />

          {/* 文字 */}
          <span className="relative z-10 drop-shadow-2xl tracking-tight">
            開始遊戲 →
          </span>
        </button>
      </div>

      {/* 登入框 Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}
