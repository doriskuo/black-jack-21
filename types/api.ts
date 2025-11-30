// 後端一張牌的格式
export type Card = {
  rank: string; // "A" / "10" / "K" ...
  suit: string; // "♠" / "♥" / "♦" / "♣"
};

// 一手牌（玩家或莊家）
export type Hand = {
  cards: Card[];
  value: number;
};

// 後端目前可能的狀態（依你提供的回傳整理）
export type GameStatus =
  | "NEW"
  | "BET"
  | "PLAYER_OPERATION"
  | "STATEMENT"
  | "GAME_OVER";

// 後端回傳的遊戲物件
export type GameResponse = {
  id: number;
  name?: string; // 有時在 root 有 name，有時沒有，所以設成可選
  bet: number;
  chips: number;
  status: GameStatus;
  move: string;
  player: {
    name: string;
    hands: Hand;
  };
  dealer: {
    name: string;
    hands: Hand;
  };
};
