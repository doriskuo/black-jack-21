export const getCardImagePath = (suit: string, rank: string): string => {
  const suitMap: Record<string, string> = {
    "&spades;": "spades",
    "♠": "spades",
    "&hearts;": "hearts",
    "♥": "hearts",
    "&diams;": "diamonds",
    "♦": "diamonds",
    "&clubs;": "clubs",
    "♣": "clubs",
  };

  const folder = suitMap[suit] || "spades"; // 預設黑桃，永遠不會 404
  const fileName = `${rank}_${folder}.png`;

  return `/cards/${folder}/${fileName}`;
};
