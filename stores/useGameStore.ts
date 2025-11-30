import { create } from "zustand";
import type { GameResponse } from "@/types/api";

type GameStore = {
  game: GameResponse | null;
  setGame: (game: GameResponse) => void;
  resetGame: () => void;
};

export const useGameStore = create<GameStore>((set) => ({
  game: null,
  setGame: (game) => set({ game }),
  resetGame: () => set({ game: null }),
}));
