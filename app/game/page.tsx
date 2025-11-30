"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import { useGameStore } from "@/stores/useGameStore";
import { useUserStore } from "@/stores/useUserStore";
import type { GameResponse, Card as ApiCard } from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://black-jack-21-830z.onrender.com";

// ---------------- UI 用牌型 ----------------
type UICard = {
  rank: string;
  suit: string; // 會被轉成 /cards/... 圖片路徑
  isFaceDown: boolean;
};

type Stage = "READY" | "DEALING" | "PLAYER_TURN" | "RESULT";

type GameResult = {
  outcome: "WIN" | "LOSE" | "PUSH";
  reason?: string;
} | null;

// 後端花色符號（已確認只有這四種）
type SuitSymbol = "♠" | "♥" | "♦" | "♣";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// 後端牌（rank + "♠"）轉成圖片路徑用的格式
function parseCardFromApi(rank: string, suitSymbol: SuitSymbol): UICard {
  const folderMap: Record<SuitSymbol, string> = {
    "♠": "spades",
    "♥": "hearts",
    "♦": "diamonds",
    "♣": "clubs",
  };
  const fileMap: Record<SuitSymbol, string> = {
    "♠": "spade",
    "♥": "heart",
    "♦": "diamond",
    "♣": "club",
  };

  return {
    rank,
    suit: `${folderMap[suitSymbol]}/${fileMap[suitSymbol]}`,
    isFaceDown: true, // 進場動畫預設先背面
  };
}

// 共用 Card 元件
function Card({
  rank,
  suit,
  size = "normal",
}: {
  rank: string;
  suit: string;
  size?: "small" | "normal" | "large";
}) {
  if (!suit) return null;
  const [folder, fileSuit] = suit.split("/");
  const path = `/cards/${folder}/${rank}_${fileSuit}.png`;

  const sizeClass =
    size === "small"
      ? "w-28 h-40"
      : size === "large"
      ? "w-36 h-52"
      : "w-32 h-48";

  return (
    <Image
      src={path}
      alt={`${rank} of ${fileSuit}`}
      fill
      className={`object-cover rounded-2xl shadow-2xl ${sizeClass}`}
      unoptimized
    />
  );
}

// 計算牌點數（只算已翻開）
function calculateHandValue(cards: UICard[]): number | null {
  const ranks = cards.filter((c) => !c.isFaceDown).map((c) => c.rank);
  if (ranks.length === 0) return null;

  let total = 0;
  let aces = 0;

  for (const rank of ranks) {
    if (rank === "A") {
      aces++;
    } else if (["K", "Q", "J"].includes(rank)) {
      total += 10;
    } else {
      total += Number(rank);
    }
  }

  while (aces > 0) {
    if (total + 11 + (aces - 1) <= 21) {
      total += 11;
    } else {
      total += 1;
    }
    aces--;
  }

  return total;
}

// 玩家牌動畫
function PlayerCardView({ card }: { card: UICard }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative w-32 h-48 -ml-10 first:ml-0"
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.div
        animate={{ rotateY: card.isFaceDown ? 0 : 180 }}
        transition={{ duration: 0.6 }}
        style={{ transformStyle: "preserve-3d" }}
        className="w-full h-full"
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <Image
            src="/cards/back.png"
            alt="back"
            fill
            className="object-cover rounded-2xl shadow-2xl"
            unoptimized
          />
        </div>
        <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div className="absolute inset-0 rounded-2xl shadow-2xl ring-1 ring-white/20" />
          <Card rank={card.rank} suit={card.suit} />
        </div>
      </motion.div>
    </motion.div>
  );
}

// 莊家牌動畫
function DealerCardView({ card, index }: { card: UICard; index: number }) {
  const isSecond = index === 1;
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative ${isSecond ? "w-36 h-52 -ml-8" : "w-28 h-40"}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.div
        animate={{ rotateY: card.isFaceDown ? 0 : 180 }}
        transition={{ duration: 0.6 }}
        style={{ transformStyle: "preserve-3d" }}
        className="w-full h-full"
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <Image
            src="/cards/back.png"
            alt="back"
            fill
            className="object-cover rounded-2xl shadow-2xl"
            unoptimized
          />
        </div>
        <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div className="absolute inset-0 rounded-2xl shadow-2xl ring-1 ring-white/10" />
          <Card
            rank={card.rank}
            suit={card.suit}
            size={isSecond ? "large" : "small"}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function GamePage() {
  const [showDeck, setShowDeck] = useState(false);
  const [showChips, setShowChips] = useState(false);

  const [selectedBet, setSelectedBet] = useState<number | null>(null);
  const [isBetting, setIsBetting] = useState(false);
  const [isBlackjack, setIsBlackjack] = useState(false);

  const [playerCards, setPlayerCards] = useState<UICard[]>([]);
  const [dealerCards, setDealerCards] = useState<UICard[]>([]);

  const [playerScore, setPlayerScore] = useState<number | null>(null);
  const [dealerScore, setDealerScore] = useState<number | null>(null);

  const [stage, setStage] = useState<Stage>("READY");
  const [result, setResult] = useState<GameResult>(null);
  const [isPlayerActing, setIsPlayerActing] = useState(false);

  const { user, token, hydrate } = useUserStore();
  const { game, setGame } = useGameStore();
  const tableRef = useRef<HTMLDivElement>(null);

  // 初始化把 token 從 localStorage 載回來（需在 store 有 hydrate）
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 分數隨牌變化
  useEffect(() => {
    const t = setTimeout(
      () => setPlayerScore(calculateHandValue(playerCards)),
      320
    );
    return () => clearTimeout(t);
  }, [playerCards]);

  useEffect(() => {
    const t = setTimeout(
      () => setDealerScore(calculateHandValue(dealerCards)),
      320
    );
    return () => clearTimeout(t);
  }, [dealerCards]);

  // Blackjack 特效（首兩張 21）
  useEffect(() => {
    const openCards = playerCards.filter((c) => !c.isFaceDown);
    if (stage === "PLAYER_TURN" && openCards.length === 2) {
      const value = calculateHandValue(openCards);
      if (value === 21) {
        setIsBlackjack(true);
        const t = setTimeout(() => setIsBlackjack(false), 2400);
        return () => clearTimeout(t);
      }
    }
  }, [playerCards, stage]);

  // 牌堆點擊 → 消失 → 籌碼出場
  const handleClickDeck = () => {
    setShowDeck(false);
    setTimeout(() => setShowChips(true), 480);
  };

  // ---------------- 建立新遊戲（POST /game） ----------------
  // showDeckOnStart: true = 第一次進場 → 顯示牌堆
  // showDeckOnStart: false = 再來一局 → 直接顯示籌碼
  const createNewGame = async (showDeckOnStart: boolean) => {
    try {
      // 清空前一局 UI 狀態（chips 完全交給後端）
      setPlayerCards([]);
      setDealerCards([]);
      setPlayerScore(null);
      setDealerScore(null);
      setSelectedBet(null);
      setResult(null);
      setStage("READY");
      setIsBetting(false);
      setIsPlayerActing(false);
      setIsBlackjack(false);

      if (showDeckOnStart) {
        setShowDeck(true);
        setShowChips(false);
      } else {
        setShowDeck(false);
        setShowChips(true);
      }

      const res = await fetch(`${API_BASE_URL}/game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: user?.full_name || "Player",
        }),
      });

      if (!res.ok) throw new Error("Create game failed");

      const data: GameResponse = (await res.json()) as GameResponse;
      setGame(data);
    } catch (err) {
      console.error(err);
      alert("建立遊戲失敗，請稍後再試看看");
    }
  };

  // ---------------- 下注（POST /game/{id}/bet） ----------------
  const handleBet = async (amount: number) => {
    if (isBetting || selectedBet || !game) return;

    setIsBetting(true);
    setSelectedBet(amount);
    setStage("DEALING");
    setResult(null);
    setPlayerCards([]);
    setDealerCards([]);
    setPlayerScore(null);
    setDealerScore(null);

    // 你的飛籌碼動畫：完整保留
    const chipButton = document.querySelector(
      `[data-chip="${amount}"]`
    ) as HTMLElement | null;

    if (chipButton && tableRef.current) {
      const rect = chipButton.getBoundingClientRect();
      const tableRect = tableRef.current.getBoundingClientRect();

      const flyingChip = document.createElement("div");
      flyingChip.className = "fixed pointer-events-none z-50";
      flyingChip.style.left = `${rect.left + rect.width / 2}px`;
      flyingChip.style.top = `${rect.bottom}px`;
      flyingChip.style.transform = "translate(-50%, -50%)";
      flyingChip.innerHTML = `
        <div class="w-24 h-24 rounded-full bg-yellow-400 shadow-2xl flex items-center justify-center font-black text-3xl text-black border-4 border-yellow-600">
          $${amount}
        </div>
      `;
      document.body.appendChild(flyingChip);

      const endX = tableRect.left + tableRect.width / 2;
      const endY = tableRect.top + tableRect.height / 2;

      flyingChip
        .animate(
          [
            {
              transform: "translate(-50%, -50%) scale(1) rotate(0deg)",
              opacity: 1,
            },
            {
              transform: `translate(${endX - rect.left - rect.width / 2}px, ${
                endY - rect.bottom
              }px) scale(0.4) rotate(360deg)`,
              opacity: 0,
            },
          ],
          { duration: 650, easing: "cubic-bezier(0.2, 0.8, 0.4, 1)" }
        )
        .addEventListener("finish", () => flyingChip.remove());
    }

    // 等籌碼飛完再 call API
    await delay(650);

    try {
      const res = await fetch(`${API_BASE_URL}/game/${game.id}/bet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ bet: amount }),
      });

      if (!res.ok) throw new Error("Bet failed");

      const data: GameResponse = (await res.json()) as GameResponse;
      setGame(data);

      const p = data.player.hands.cards as ApiCard[];
      const d = data.dealer.hands.cards as ApiCard[];

      if (p.length >= 2 && d.length >= 2) {
        const p1 = parseCardFromApi(p[0].rank, p[0].suit as SuitSymbol);
        const p2 = parseCardFromApi(p[1].rank, p[1].suit as SuitSymbol);
        const d1 = parseCardFromApi(d[0].rank, d[0].suit as SuitSymbol);
        const d2 = parseCardFromApi(d[1].rank, d[1].suit as SuitSymbol);

        // 玩家第一張
        setTimeout(() => {
          setPlayerCards([{ ...p1, isFaceDown: true }]);
          setTimeout(() => {
            setPlayerCards((prev) =>
              prev.map((c) => ({ ...c, isFaceDown: false }))
            );
          }, 450);
        }, 0);

        // 莊家第一張（亮牌）
        setTimeout(() => {
          setDealerCards([{ ...d1, isFaceDown: true }]);
          setTimeout(() => {
            setDealerCards((prev) =>
              prev.map((c) => ({ ...c, isFaceDown: false }))
            );
          }, 450);
        }, 900);

        // 玩家第二張
        setTimeout(() => {
          setPlayerCards((prev) => [...prev, { ...p2, isFaceDown: true }]);
          setTimeout(() => {
            setPlayerCards((prev) =>
              prev.map((c, idx) =>
                idx === 1 ? { ...c, isFaceDown: false } : c
              )
            );
          }, 450);
        }, 1800);

        // 莊家第二張（暗牌）
        setTimeout(() => {
          setDealerCards((prev) => [...prev, { ...d2, isFaceDown: true }]);
        }, 2700);

        // 發牌結束 → 進入玩家回合（後端 status=BET，但前端視為玩家回合）
        setTimeout(() => {
          setStage("PLAYER_TURN");
        }, 3200);
      } else {
        // 萬一後端沒回兩張（安全保護）
        setStage("PLAYER_TURN");
      }
    } catch (err) {
      alert("下注失敗，請確認後端是否有啟動");
      console.error(err);
      setStage("READY");
      setSelectedBet(null);
    } finally {
      setIsBetting(false);
    }
  };

  // ---------------- 玩家操作（POST /game/{id}/player_operation） ----------------
  const handlePlayerAction = async (op: "h" | "s" | "d") => {
    if (stage !== "PLAYER_TURN" || isPlayerActing || !game) return;

    setIsPlayerActing(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/game/${game.id}/player_operation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          // 依照原本 API 文件：欄位叫 operation
          body: JSON.stringify({ operation: op }),
        }
      );

      if (!res.ok) throw new Error("Operation failed");

      const data: GameResponse = (await res.json()) as GameResponse;
      setGame(data);

      // 前端目前手上的牌（UI）長度
      const currentPlayerLen = playerCards.length;
      const newPlayerCards = data.player.hands.cards as ApiCard[];

      // 如果後端回傳的牌變多 → 新增一張動畫（要牌 / double）
      if (newPlayerCards.length > currentPlayerLen) {
        const last = newPlayerCards[newPlayerCards.length - 1];
        const newCard = parseCardFromApi(last.rank, last.suit as SuitSymbol);

        setPlayerCards((prev) => [...prev, { ...newCard, isFaceDown: true }]);
        await delay(450);
        setPlayerCards((prev) =>
          prev.map((c, idx) =>
            idx === prev.length - 1 ? { ...c, isFaceDown: false } : c
          )
        );
      }

      // 如果 status 進入 STATEMENT / GAME_OVER → 結算
      if (data.status === "STATEMENT" || data.status === "GAME_OVER") {
        // 直接用後端的最終牌型更新 UI（全部翻開）
        const finalPlayer = (data.player.hands.cards as ApiCard[]).map((c) => ({
          ...parseCardFromApi(c.rank, c.suit as SuitSymbol),
          isFaceDown: false,
        }));
        const finalDealer = (data.dealer.hands.cards as ApiCard[]).map((c) => ({
          ...parseCardFromApi(c.rank, c.suit as SuitSymbol),
          isFaceDown: false,
        }));

        setPlayerCards(finalPlayer);
        setDealerCards(finalDealer);

        await delay(800);

        const pVal = data.player.hands.value;
        const dVal = data.dealer.hands.value;

        let outcome: "WIN" | "LOSE" | "PUSH" = "PUSH";
        let reason = "";

        if (pVal > 21) {
          outcome = "LOSE";
          reason = "玩家爆牌";
        } else if (dVal > 21 && pVal <= 21) {
          outcome = "WIN";
          reason = "莊家爆牌";
        } else if (pVal === dVal) {
          outcome = "PUSH";
          reason = "平手";
        } else if (pVal > dVal) {
          outcome = "WIN";
          reason = "點數較高";
        } else {
          outcome = "LOSE";
          reason = "點數較低";
        }

        setResult({ outcome, reason });
        setStage("RESULT");
      }
    } catch (err) {
      console.error(err);
      alert("操作失敗，請稍後再試");
    } finally {
      setIsPlayerActing(false);
    }
  };

  const handleHit = () => handlePlayerAction("h");
  const handleStand = () => handlePlayerAction("s");
  const handleDouble = () => handlePlayerAction("d");

  // ---------------- 再來一局：重新建立新遊戲（直接籌碼，不再顯示牌堆） ----------------
  const handleReset = async () => {
    await createNewGame(false);
  };

  const bets = [100, 500, 1000, 5000];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0033] via-[#330020] to-[#000000] flex items-center justify-center p-4">
      <motion.div
        ref={tableRef}
        animate={
          isBlackjack
            ? {
                boxShadow: [
                  "0 0 50px #00ffff",
                  "0 0 120px #00ffff, 0 0 180px #ff00ff",
                  "0 0 50px #00ffff",
                ],
              }
            : { boxShadow: "0 0 30px rgba(0, 255, 255, 0.5)" }
        }
        transition={{ duration: 0.8, repeat: 3, repeatType: "reverse" }}
        className="relative w-full max-w-7xl h-[90vh] rounded-3xl overflow-hidden bg-gradient-to-b from-[#0a1a2f] via-[#0f2035] to-[#001122] border-4 border-[#c41e3a]/70 shadow-2xl ring-8 ring-[#00ffff]/50"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-900/30 to-transparent pointer-events-none" />

        {/* 標題 + 玩家資訊 */}
        <div className="absolute top-6 left-8 right-8 flex justify-between items-center z-10">
          <h1 className="text-5xl font-black text-cyan-300 tracking-widest drop-shadow-2xl">
            BLACKJACK 21
          </h1>
          <div className="text-right">
            <p className="text-3xl font-bold text-cyan-300">
              {user?.full_name || "神秘玩家"}
            </p>
            <p className="text-3xl font-black text-yellow-400">
              {game ? `$${game.chips.toLocaleString()}` : "-"}
            </p>
          </div>
        </div>

        {/* 開始遊戲按鈕（第一次進來） */}
        {!game && !showDeck && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <button
              onClick={() => createNewGame(true)}
              className="pointer-events-auto w-120 h-60 rounded-3xl bg-white/12 backdrop-blur-xl border-6 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-500 flex flex-col items-center justify-center gap-6"
            >
              <span className="text-7xl font-black text-white drop-shadow-2xl">
                開始遊戲
              </span>
              <span className="text-3xl text-cyan-300">點擊進入賭場</span>
            </button>
          </div>
        )}

        {/* 牌靴（還沒發牌時顯示，先出現 deck，點擊後才顯示籌碼） */}
        <AnimatePresence>
          {showDeck && playerCards.length === 0 && dealerCards.length === 0 && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] pointer-events-none z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="relative w-48 h-64">
                {Array.from({ length: 60 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 w-40 h-56 rounded-xl shadow-2xl"
                    style={{
                      transform: `translate(${i * 0.12}px, ${
                        i * 0.25
                      }px) rotate(${i * 0.03 - 0.9}deg)`,
                      zIndex: i,
                    }}
                  >
                    <Image
                      src="/cards/back.png"
                      alt="deck"
                      fill
                      className="object-cover rounded-xl"
                      unoptimized
                    />
                  </div>
                ))}

                {/* hover + click 的頂層牌 */}
                <motion.div
                  onClick={handleClickDeck}
                  className="absolute inset-0 w-40 h-56 rounded-xl shadow-2xl cursor-pointer pointer-events-auto z-70"
                  whileHover={{
                    scale: 1.08,
                    y: -24,
                    boxShadow: "0 0 80px rgba(34, 211, 238, 0.9)",
                  }}
                  whileTap={{ scale: 0.97, y: -8 }}
                >
                  <Image
                    src="/cards/back.png"
                    alt="deal"
                    fill
                    className="object-cover rounded-xl"
                    unoptimized
                  />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 莊家區：點數在左，牌在右 */}
        {dealerCards.length > 0 && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-6 ml-20">
            <div className="flex flex-col items-start text-cyan-300 drop-shadow-2xl">
              <span className="text-xs tracking-[0.3em] uppercase">DEALER</span>
              <span className="text-3xl font-black">
                {dealerScore !== null ? dealerScore : "-"}
              </span>
            </div>
            <div className="flex gap-4">
              {dealerCards.map((card, i) => (
                <DealerCardView key={i} card={card} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* 玩家區：點數在左，牌在右 */}
        {playerCards.length > 0 && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-6 -ml-32">
            <div className="flex flex-col items-start text-cyan-300 drop-shadow-2xl">
              <span className="text-xs tracking-[0.3em] uppercase">PLAYER</span>
              <span className="text-3xl font-black">
                {playerScore !== null ? playerScore : "-"}
              </span>
            </div>
            <div className="flex gap-4">
              {playerCards.map((card, i) => (
                <PlayerCardView key={i} card={card} />
              ))}
            </div>
          </div>
        )}

        {/* 玩家下注 HUD（固定顯示在玩家牌右側） */}
        {selectedBet && stage !== "READY" && !result && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-32 left-1/2 translate-x-[350px] flex items-center z-40"
          >
            <div className="px-6 py-3 bg-white/10 backdrop-blur-xl border border-cyan-400/40 rounded-2xl shadow-lg">
              <span className="text-3xl font-black text-cyan-300 drop-shadow-[0_0_6px_#00ffff] tracking-wider">
                BET ${selectedBet.toLocaleString()}
              </span>
            </div>
          </motion.div>
        )}

        {/* 玩家行動按鈕區（Hit / Stand / Double） */}
        <AnimatePresence>
          {stage === "PLAYER_TURN" && !result && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-12 z-40"
            >
              {/* 要牌 */}
              <button
                onClick={handleHit}
                disabled={isBetting || isPlayerActing}
                className="relative px-20 py-8 bg-white/10 backdrop-blur-xl border-4 border-cyan-400/60 rounded-3xl shadow-2xl overflow-hidden group hover:border-cyan-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 text-5xl font-black text-cyan-300 tracking-wider drop-shadow-2xl">
                  要牌
                </span>
                <div className="absolute inset-0 bg-cyan-400/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </button>

              {/* Double */}
              <button
                onClick={handleDouble}
                disabled={
                  isBetting || isPlayerActing || playerCards.length !== 2
                }
                className="relative px-20 py-8 bg-white/10 backdrop-blur-xl border-4 border-yellow-400/60 rounded-3xl shadow-2xl overflow-hidden group hover:border-yellow-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 text-5xl font-black text-yellow-300 tracking-wider drop-shadow-2xl">
                  雙倍
                </span>
                <div className="absolute inset-0 bg-yellow-400/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </button>

              {/* 停牌 */}
              <button
                onClick={handleStand}
                disabled={isBetting || isPlayerActing}
                className="relative px-20 py-8 bg-white/10 backdrop-blur-xl border-4 border-red-500/60 rounded-3xl shadow-2xl overflow-hidden group hover:border-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 text-5xl font-black text-red-400 tracking-wider drop-shadow-2xl">
                  停牌
                </span>
                <div className="absolute inset-0 bg-red-500/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 結算結果 + 再來一局 */}
        {result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/40">
            <div className="px-10 py-6 rounded-3xl bg-black/80 border-4 border-cyan-400 shadow-2xl mb-8">
              <p className="text-5xl font-black text-cyan-300 text-center mb-2">
                {result.outcome === "WIN"
                  ? "你贏了！"
                  : result.outcome === "LOSE"
                  ? "你輸了"
                  : "平手"}
              </p>

              {result.reason && (
                <p className="text-2xl text-yellow-200 text-center">
                  {result.reason}
                </p>
              )}

              <p className="text-xl text-gray-300 text-center mt-2">
                玩家：{playerScore ?? "-"}　/　莊家：{dealerScore ?? "-"}
              </p>
            </div>

            <button
              onClick={handleReset}
              className="px-10 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black text-3xl font-black shadow-2xl transition-transform hover:scale-105"
            >
              再來一局
            </button>
          </div>
        )}

        {/* 籌碼區 */}
        <div
          className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-8 transition-all duration-700 ${
            showChips && !result
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8 pointer-events-none"
          }`}
        >
          {bets.map((amount) => (
            <button
              key={amount}
              data-chip={amount}
              onClick={() => handleBet(amount)}
              disabled={isBetting || stage === "PLAYER_TURN" || !!result}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-xl shadow-2xl transition
                ${
                  isBetting
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-110 hover:-translate-y-4"
                }
                ${
                  selectedBet === amount
                    ? "ring-8 ring-yellow-400 scale-110 shadow-yellow-400/60"
                    : ""
                }
                ${
                  amount === 100 &&
                  "bg-gradient-to-br from-gray-300 to-gray-500 ring-4 ring-gray-600"
                }
                ${
                  amount === 500 &&
                  "bg-gradient-to-br from-red-600 to-red-800 ring-4 ring-red-900"
                }
                ${
                  amount === 1000 &&
                  "bg-gradient-to-br from-green-600 to-green-800 ring-4 ring-green-900"
                }
                ${
                  amount === 5000 &&
                  "bg-gradient-to-br from-purple-700 to-purple-900 ring-4 ring-purple-950"
                }`}
            >
              <div className="absolute inset-3 rounded-full bg-black/40" />
              <span className="relative z-10 drop-shadow-2xl">
                ${amount.toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        {/* 下注中遮罩 */}
        {isBetting && stage === "DEALING" && (
          <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60">
            <div className="text-7xl font-black text-cyan-300 animate-pulse">
              下注中...
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
