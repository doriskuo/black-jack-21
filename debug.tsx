"use client";

import { useEffect, useState, useRef } from "react";
import { useGameStore } from "@/stores/useGameStore";
import { useUserStore } from "@/stores/useUserStore";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// --- Payout 計算邏輯 ---
// game：目前 Zustand game store 內容
// result：已經算好的勝負結果 { outcome: "WIN" | "LOSE" | "PUSH", reason?: string }

function calculatePayout(game: any, result: any) {
  if (!game || !game.player || typeof game.player.chips !== "number") {
    return game; // 保護，避免 null
  }

  const bet = game.player.bet ?? 0;
  let chips = game.player.chips;

  if (result.outcome === "WIN") {
    chips += bet; // 勝利贏回 bet
  } else if (result.outcome === "LOSE") {
    chips -= bet; // 失敗扣掉 bet
  } else if (result.outcome === "PUSH") {
    // PUSH → 籌碼不變
    chips = chips;
  }

  return {
    ...game,
    player: {
      ...game.player,
      chips,
    },
  };
}

type UICard = {
  rank: string;
  suit: string;
  isFaceDown: boolean; // true = 背面朝上（還沒翻）
};

type Stage = "READY" | "DEALING" | "PLAYER_TURN" | "DEALER_TURN" | "RESULT";

type GameResult = {
  outcome: "WIN" | "LOSE" | "PUSH";
  reason?: string;
} | null;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// 簡單 mock 的要牌 / 莊家補牌牌庫
const mockPlayerDeck = ["5♣", "9♦", "2♠", "3♥", "7♣", "4♦"];
const mockDealerDeck = ["3♣", "4♦", "9♥", "2♠", "6♦"];

// 共用的 Card 元件：給玩家 / 莊家牌都用
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

// 計算牌點數（只計算已翻開的牌）
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

// 玩家牌：進場 + 翻牌
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

// 莊家牌：第二張稍大、微疊
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
  const [isDealerActing, setIsDealerActing] = useState(false);

  const { user } = useUserStore();
  const { game, setGame } = useGameStore();
  const tableRef = useRef<HTMLDivElement>(null);

  // mock 抽牌索引（要牌 / 莊家自動補牌）
  const playerDrawIndexRef = useRef(0);
  const dealerDrawIndexRef = useRef(0);

  useEffect(() => {
    if (!game) {
      setGame({
        id: 1,
        status: "NEW",
        player: { chips: 10000, cards: [], bet: 0 },
        dealer: { chips: 999999, cards: [] },
      });
    }
  }, [game, setGame]);

  // 點數隨牌翻開即時更新（加一點延遲，讓數字跟在翻牌後面出現）
  useEffect(() => {
    const t = setTimeout(() => {
      setPlayerScore(calculateHandValue(playerCards));
    }, 320);
    return () => clearTimeout(t);
  }, [playerCards]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDealerScore(calculateHandValue(dealerCards));
    }, 320);
    return () => clearTimeout(t);
  }, [dealerCards]);

  // 玩家前兩張翻開且 21 → Blackjack 特效
  useEffect(() => {
    const openCards = playerCards.filter((c) => !c.isFaceDown);
    if (openCards.length === 2) {
      const value = calculateHandValue(openCards);
      if (value === 21) {
        setIsBlackjack(true);
        const t = setTimeout(() => setIsBlackjack(false), 2400);
        return () => clearTimeout(t);
      }
    }
  }, [playerCards]);

  // 玩家爆牌 → 直接進入結果階段（目前只在 PLAYER_TURN 期間判斷）
  useEffect(() => {
    if (
      stage === "PLAYER_TURN" &&
      playerScore !== null &&
      playerScore > 21 &&
      !result
    ) {
      const outcome: GameResult = { outcome: "LOSE", reason: "爆牌" };
      setResult(outcome);

      // --- 賠付 ---
      if (game) {
        const updatedGame = calculatePayout(game, outcome);
        setGame(updatedGame);
      }

      setStage("RESULT");
    }
  }, [playerScore, stage, result, game, setGame]);

  const parseCard = (card: string): { rank: string; suit: string } => {
    const rank = card.slice(0, -1);
    const suitSymbol = card.slice(-1);
    const folderMap: Record<string, string> = {
      "♠": "spades",
      "♥": "hearts",
      "♦": "diamonds",
      "♣": "clubs",
    };
    const fileMap: Record<string, string> = {
      "♠": "spade",
      "♥": "heart",
      "♦": "diamond",
      "♣": "club",
    };
    return {
      rank,
      suit: `${folderMap[suitSymbol]}/${fileMap[suitSymbol]}`,
    };
  };

  const drawNextPlayerCard = () => {
    const idx = playerDrawIndexRef.current % mockPlayerDeck.length;
    playerDrawIndexRef.current += 1;
    return mockPlayerDeck[idx];
  };

  const drawNextDealerCard = () => {
    const idx = dealerDrawIndexRef.current % mockDealerDeck.length;
    dealerDrawIndexRef.current += 1;
    return mockDealerDeck[idx];
  };

  const handleBet = async (amount: number) => {
    if (isBetting || !game || selectedBet) return;

    setIsBetting(true);
    setSelectedBet(amount);
    setStage("DEALING");
    setResult(null);
    playerDrawIndexRef.current = 0;
    dealerDrawIndexRef.current = 0;

    // 1. 只記錄下注金額（不扣錢）
    setGame({
      ...game,
      player: { ...game.player, bet: amount },
      status: "BET" as const,
    });

    // 2. 籌碼飛進桌面動畫
    const chipButton = document.querySelector(
      `[data-chip="${amount}"]`
    ) as HTMLElement;

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

    // 短暫等待，不會讓牌在黑幕下偷偷運作
    await delay(650);

    // 模擬後端發回第一輪牌
    const mockResponse = {
      id: game.id,
      status: "BET" as const,
      player: {
        chips: game.player.chips,
        bet: amount,
        cards: ["A♥", "K♠"],
      },
      dealer: { chips: game.dealer.chips, cards: ["10♦", "7♣"] },
    };

    setGame(mockResponse);
    setPlayerCards([]);
    setDealerCards([]);

    const p1 = mockResponse.player.cards[0];
    const d1 = mockResponse.dealer.cards[0];
    const p2 = mockResponse.player.cards[1];
    const d2 = mockResponse.dealer.cards[1];

    // 玩家第一張
    setTimeout(() => {
      setPlayerCards([{ ...parseCard(p1), isFaceDown: true }]);
      setTimeout(() => {
        setPlayerCards((prev) =>
          prev.map((c) => ({ ...c, isFaceDown: false }))
        );
      }, 450);
    }, 0);

    // 莊家第一張
    setTimeout(() => {
      setDealerCards([{ ...parseCard(d1), isFaceDown: true }]);
      setTimeout(() => {
        setDealerCards((prev) =>
          prev.map((c) => ({ ...c, isFaceDown: false }))
        );
      }, 450);
    }, 900);

    // 玩家第二張
    setTimeout(() => {
      setPlayerCards((prev) => [
        ...prev,
        { ...parseCard(p2), isFaceDown: true },
      ]);
      setTimeout(() => {
        setPlayerCards((prev) =>
          prev.map((c, idx) => (idx === 1 ? { ...c, isFaceDown: false } : c))
        );
      }, 450);
    }, 1800);

    // 莊家第二張（暗牌）
    setTimeout(() => {
      setDealerCards((prev) => [
        ...prev,
        { ...parseCard(d2), isFaceDown: true },
      ]);
    }, 2700);

    // 發牌結束後，進入玩家回合
    setTimeout(() => {
      setStage("PLAYER_TURN");
    }, 3200);

    setIsBetting(false);
  };

  const handleHit = async () => {
    if (
      stage !== "PLAYER_TURN" ||
      isBetting ||
      isPlayerActing ||
      isDealerActing
    )
      return;

    setIsPlayerActing(true);

    const newCardStr = drawNextPlayerCard();
    const { rank, suit } = parseCard(newCardStr);

    // 新牌先以背面進場
    setPlayerCards((prev) => [...prev, { rank, suit, isFaceDown: true }]);

    // 延遲再翻面
    await delay(450);
    setPlayerCards((prev) =>
      prev.map((c) => (c.isFaceDown ? { ...c, isFaceDown: false } : c))
    );

    await delay(150); // 讓點數跟翻面更順一點
    setIsPlayerActing(false);
  };

  // 共用：莊家回合（停牌 或 Double 之後都會跑這裡）
  const runDealerTurn = async (playerCardsSnapshot: UICard[]) => {
    setStage("DEALER_TURN");
    setIsDealerActing(true);

    // 先把莊家現在的牌 clone 一份在本地，方便計算與控制順序
    let localDealerCards: UICard[] = dealerCards.map((c) => ({ ...c }));

    // 1) 翻開所有暗牌（特別是第二張）
    localDealerCards = localDealerCards.map((c) => ({
      ...c,
      isFaceDown: false,
    }));
    setDealerCards(localDealerCards);
    await delay(650);

    let dealerValue = calculateHandValue(localDealerCards) ?? 0;
    const playerValue =
      calculateHandValue(playerCardsSnapshot.filter((c) => !c.isFaceDown)) ?? 0;

    // 2) 自動補牌：莊家 < 17 一直補
    while (dealerValue < 17) {
      const newCardStr = drawNextDealerCard();
      const parsed = parseCard(newCardStr);

      // 新牌背面先進來
      localDealerCards = [...localDealerCards, { ...parsed, isFaceDown: true }];
      setDealerCards(localDealerCards);
      await delay(450);

      // 翻面
      localDealerCards = localDealerCards.map((c, idx) =>
        idx === localDealerCards.length - 1 ? { ...c, isFaceDown: false } : c
      );
      setDealerCards(localDealerCards);
      await delay(450);

      dealerValue = calculateHandValue(localDealerCards) ?? dealerValue;
    }

    // 3) 決定勝負
    let outcome: "WIN" | "LOSE" | "PUSH";
    let reason = "";

    if (dealerValue > 21 && playerValue <= 21) {
      outcome = "WIN";
      reason = "莊家爆牌";
    } else if (playerValue > 21 && dealerValue <= 21) {
      outcome = "LOSE";
      reason = "玩家爆牌";
    } else if (playerValue === dealerValue) {
      outcome = "PUSH";
      reason = "平手";
    } else if (playerValue > dealerValue) {
      outcome = "WIN";
      reason = "點數較高";
    } else {
      outcome = "LOSE";
      reason = "點數較低";
    }

    setResult({ outcome, reason });
    // 結算籌碼
    const updatedGame = calculatePayout(game, { outcome, reason });
    setGame(updatedGame);

    setStage("RESULT");
    setIsDealerActing(false);
  };

  // Double：只能在第一回合（兩張牌）使用，bet * 2，抽一張後直接進入莊家回合
  const handleDouble = async () => {
    if (
      stage !== "PLAYER_TURN" ||
      isBetting ||
      isPlayerActing ||
      isDealerActing
    )
      return;
    if (!game) return;

    // 只能在「第一回合」：玩家剛好兩張明牌
    const openCards = playerCards.filter((c) => !c.isFaceDown);
    if (openCards.length !== 2) return;

    const currentBet = game.player.bet || selectedBet || 0;
    const newBet = currentBet * 2;

    // 檢查籌碼是否足夠做 Double
    if (newBet > game.player.chips) {
      alert("籌碼不足，不能雙倍！");
      return;
    }

    setIsPlayerActing(true);

    // 更新下注（mock 階段只更新 bet，不扣 chips）
    setGame({
      ...game,
      player: { ...game.player, bet: newBet },
    });
    setSelectedBet(newBet);

    // 在本地維護一份玩家牌的 snapshot，避免 setState 非同步問題
    let localPlayerCards: UICard[] = playerCards.map((c) => ({ ...c }));

    const newCardStr = drawNextPlayerCard();
    const { rank, suit } = parseCard(newCardStr);

    // 新牌先以背面進場
    localPlayerCards = [...localPlayerCards, { rank, suit, isFaceDown: true }];
    setPlayerCards(localPlayerCards);

    await delay(450);

    // 翻面最新那張牌
    localPlayerCards = localPlayerCards.map((c, idx) =>
      idx === localPlayerCards.length - 1 ? { ...c, isFaceDown: false } : c
    );
    setPlayerCards(localPlayerCards);

    await delay(150);

    setIsPlayerActing(false);

    // Double 抽完一張後必須停牌 → 直接進入莊家回合
    await runDealerTurn(localPlayerCards);
  };

  const handleStand = async () => {
    if (
      stage !== "PLAYER_TURN" ||
      isBetting ||
      isPlayerActing ||
      isDealerActing
    )
      return;

    // 拍一份玩家牌的 snapshot 給莊家回合用
    const playerSnapshot = playerCards.map((c) => ({ ...c }));
    await runDealerTurn(playerSnapshot);
  };

  const handleReset = () => {
    // 清空 UI 牌組與分數
    setPlayerCards([]);
    setDealerCards([]);
    setPlayerScore(null);
    setDealerScore(null);

    // 下注與結果
    setSelectedBet(null);
    setResult(null);

    // 流程狀態
    setStage("READY");
    setIsBetting(false);
    setIsPlayerActing(false);
    setIsDealerActing(false);
    setIsBlackjack(false); // ⭐ 新增：避免 blackjack 特效殘留

    // 抽牌索引重置（mock deck）
    playerDrawIndexRef.current = 0;
    dealerDrawIndexRef.current = 0;

    // 重設 store 的 game
    if (game) {
      setGame({
        ...game,
        status: "NEW",
        player: { ...game.player, bet: 0 },
      });
    }

    // 重新顯示籌碼選擇
    setShowChips(true);
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
              ${game?.player.chips?.toLocaleString() || "10,000"}
            </p>
          </div>
        </div>

        {/* 開始遊戲按鈕 */}
        {game?.status === "NEW" && !showChips && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <button
              onClick={() => setShowChips(true)}
              className="pointer-events-auto w-120 h-60 rounded-3xl bg-white/12 backdrop-blur-xl border-6 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-500 flex flex-col items-center justify-center gap-6"
            >
              <span className="text-7xl font-black text-white drop-shadow-2xl">
                開始遊戲
              </span>
              <span className="text-3xl text-cyan-300">點擊進入遊戲大廳</span>
            </button>
          </div>
        )}

        {/* 牌靴 */}
        <AnimatePresence>
          {showChips &&
            game?.status === "NEW" &&
            playerCards.length === 0 &&
            dealerCards.length === 0 && (
              <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] pointer-events-none z-20">
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

                  <motion.div
                    className="absolute inset-0 w-40 h-56 rounded-xl shadow-2xl cursor-pointer pointer-events-auto z-70"
                    whileHover={{
                      scale: 1.08,
                      y: -24,
                      boxShadow: "0 0 80px rgba(34, 211, 238, 0.9)",
                    }}
                    whileTap={{ scale: 1.02 }}
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
              {/* 要牌 / 雙倍 / 停牌 */}
              <button
                onClick={handleHit}
                disabled={isBetting || isPlayerActing || isDealerActing}
                className="relative px-20 py-8 bg-white/10 backdrop-blur-xl border-4 border-cyan-400/60 rounded-3xl shadow-2xl overflow-hidden group hover:border-cyan-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 text-5xl font-black text-cyan-300 tracking-wider drop-shadow-2xl">
                  要牌
                </span>
                <div className="absolute inset-0 bg-cyan-400/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </button>

              {/* Double 按鈕（第一次行動限定） */}
              <button
                onClick={handleDouble}
                disabled={
                  isBetting ||
                  isPlayerActing ||
                  isDealerActing ||
                  playerCards.length !== 2
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
                disabled={isBetting || isPlayerActing || isDealerActing}
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
