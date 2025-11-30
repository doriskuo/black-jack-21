# 🎮 Blackjack 21 – Full Stack Collaboration (Frontend by Doris · Backend by Iris)

Blackjack 21 是一款由 **前端工程師 Doris** 與 **後端工程師 Iris Tseng**  
共同協作完成的 Blackjack 遊戲。

我（Doris）過去曾進行全端遊戲商城開發與 API 串接，  
但這是我 **第一次與另一位工程師正式協作分工** 的全端專案。

在這個專案中，我負責整個前端 UI / 動畫 / 遊戲流程設計與 API 串接；  
Iris 負責所有後端 Blackjack 遊戲邏輯與 API 設計。

這個作品完整呈現現代「前後端分離」的協作方式，  
也是我首次用真正的後端 API 與他人共同完成一個可玩產品。

---

## ✨ 專案特色

### 🎯 1. 真實前後端協作 · 完整產品流程

- Iris 撰寫後端所有 API 與 Blackjack 遊戲邏輯
- 我負責前端畫面、互動、動畫、流程控制、Token 驗證、資料串接
- 使用明確的前後端分工方式進行協作（符合企業開發模式）

### 🎨 2. 全客製化 UI / Framer-Motion 動畫應用

- 牌堆 hover 高光、浮起動畫
- 卡牌翻面動畫（3D rotateY）
- 籌碼飛行動畫
- Blackjack 閃光特效
- 結算畫面、下注 HUD、再來一局 UI
- 所有視覺與布局皆由我設計與實作

### 🔐 3. Token 驗證流程

- 使用者登入 → 後端回傳 JWT token
- 前端寫入 localStorage
- 後端 API 帶上 `Authorization: Bearer <token>`
- 使用 Zustand 管控 user + token 狀態，並在載入時 rehydrate

### 🃏 4. 完整遊戲流程串接

- 登入
- 建立新遊戲（status: `NEW`）
- 顯示牌堆 → 點擊後進入下注狀態
- 下注（status: `BET`）
- 發牌動畫 + 玩家回合（前端視為玩家操作階段）
- 要牌 / 停牌 / Double
- 結算（status: `STATEMENT` / `GAME_OVER`）
- 再來一局（重新建立新遊戲）

---

## 🧩 使用技術

### Frontend（由 Doris 製作）

- Next.js 16（App Router）
- React Hooks
- TypeScript
- Zustand（狀態管理）
- ZOD 驗證
- Tailwind CSS（樣式）
- Framer Motion（動畫）
- LocalStorage Token 持久化

### Backend（由 Iris Tseng 製作）

- Python / FastAPI（或 Iris 實際使用之框架）
- JWT 驗證
- Blackjack 遊戲邏輯：發牌 / 洗牌 / 要牌 / 停牌 / Double / 結算
- 狀態管理（`NEW` / `BET` / `PLAYER_OPERATION` / `STATEMENT` / `GAME_OVER`）
- 筹碼計算（chips 更新）

---

## 👥 前後端協作說明

雖然我過去有過全端開發與 API 串接經驗，  
但這是我 **第一次與另一位工程師共同協作開發** 的專案。

這次的開發模式完全符合企業的前後端分工方式：

- Iris 提供並維護後端 API
- 我依照 API 規格設計前端畫面與互動流程
- 透過 status（`NEW` / `BET` / `STATEMENT` ...）、chips、cards、value 等欄位來驅動 UI
- 共同 debug 前後端在狀態與流程上的差異

這次協作讓我學會：

- 如何閱讀並依據後端提供的 API 設計前端流程
- 如何處理跨端狀態問題（例如：chips 何時更新、何時 reset）
- 如何在不動後端邏輯的前提下，使用前端調整 UX / 動畫節奏
- 如何用乾淨的 API 串接方式撐起一整個遊戲體驗

這是我非常珍惜的一次 **前後端協作里程碑**。

---

## 📦 專案安裝（Frontend）

\```
git clone <your-repo-url>
cd black-jack-nextproject
npm install
npm run dev
\```

預設執行於：`http://localhost:3000`

---

## 🔌 API 設定（Frontend）

請在專案根目錄新增 `.env.local`：

\```
NEXT_PUBLIC_API_BASE_URL=https://your-backend-api-url
\```

---

## 🚀 部署方式

前端可部署於：

- Vercel（推薦）
- Netlify
- 任何支援 Next.js 的平台

部署前請確認：

- `.env` 中的 `NEXT_PUBLIC_API_BASE_URL` 已指向正確的後端位置
- 後端允許對應網域的 CORS 存取

---

## 🔮 未來功能規劃

- [ ] 分牌（Split）
- [ ] 保險（Insurance）
- [ ] 進階 Double 規則調整
- [ ] 多手牌支援
- [ ] Email 登入驗證 F2A
- [ ] 音效與背景音樂
- [ ] 多人房間模式（多人對戰）
- [ ] 遊戲紀錄與戰績頁
- [ ] 自動洗牌 / 切牌動畫

---

## 🙏 致謝

特別感謝後端工程師 **Iris Tseng** 提供完整 Blackjack 後端邏輯與 API，  
讓本專案可以以真實的前後端協作方式完成。

也感謝 AI 助手 chatGPT-Nova & Grok 協助我在：

- 狀態流設計
- API 串接邏輯
- 動畫細節與除錯  
  過程中提供大量技術與流程上的建議。

---

## 💬 聯絡我

如果你想合作、交流或討論前端開發與作品集：

- GitHub: `https://github.com/doriskuo`

---
