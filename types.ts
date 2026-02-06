
export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER',
  WIN = 'WIN'
}

export enum TargetingPriority {
  FIRST = 'FIRST',
  STRONGEST = 'STRONGEST',
  WEAKEST = 'WEAKEST',
  CLOSEST = 'CLOSEST'
}

export interface TowerConfig {
  id: string;
  name: string;
  cost: number;
  damage: number;
  range: number;
  fireRate: number; // ms
  color: number;
  description: string;
}

export interface TowerInstance {
  id: string;
  x: number;
  y: number;
  config: TowerConfig;
  targetingPriority: TargetingPriority;
  level: number;
}

export interface GameStats {
  gold: number;
  lives: number;
  level: number;
  score: number;
  towerCount: number;
  waveActive: boolean;
  gameSpeed: number;
}

// Fix: Defined the LevelIntel interface used by the Gemini mission briefing service
export interface LevelIntel {
  title: string;
  briefing: string;
}
