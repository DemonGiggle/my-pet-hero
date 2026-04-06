export type Species = 'elf' | 'dwarf' | 'human' | 'orc' | 'dragon';

export type NeedKey = 'health' | 'hunger' | 'thirst' | 'mood' | 'energy' | 'hygiene';
export type AttributeKey = 'strength' | 'agility' | 'intelligence' | 'vitality' | 'luck';

export interface Needs {
  health: number;
  hunger: number;
  thirst: number;
  mood: number;
  energy: number;
  hygiene: number;
}

export interface Attributes {
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  luck: number;
}

export interface Personality {
  sociability: number;
  curiosity: number;
  discipline: number;
  playfulness: number;
  appetite: number;
}

export interface SpeciesConfig {
  key: Species;
  label: string;
  description: string;
  statBias: Partial<Needs>;
  attributeBias: Partial<Attributes>;
  decay: {
    hungerPerHour: number;
    thirstPerHour: number;
    energyPerHour: number;
    hygienePerHour: number;
    moodDriftPerHour: number;
  };
  temperament: Partial<Personality>;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

export interface PetEvent {
  at: string;
  type: string;
  delta: Partial<Needs>;
  text: string;
}

export interface AdventureLog {
  at: string;
  floor: number;
  outcome: 'win' | 'escape' | 'rest' | 'treasure';
  text: string;
  expGained: number;
  goldGained: number;
}

export interface DungeonProgress {
  seed: number;
  floor: number;
  deepestFloor: number;
  runs: number;
}

export interface HeroProgress {
  level: number;
  exp: number;
  expToNext: number;
  statPoints: number;
  gold: number;
  attributes: Attributes;
  dungeon: DungeonProgress;
  adventureLog: AdventureLog[];
}

export interface PetState {
  version: number;
  id: string;
  name: string;
  species: Species;
  createdAt: string;
  updatedAt: string;
  lastSimulatedAt: string;
  ageHours: number;
  seed: number;
  needs: Needs;
  personality: Personality;
  hero: HeroProgress;
  history: PetEvent[];
}

export interface SimulationResult {
  pet: PetState;
  events: PetEvent[];
  summary: string;
  moodLabel: string;
  stageLabel: string;
}

export interface RenderResult {
  outputPath: string;
}

export interface StatusSnapshot {
  now: string;
  summary: string;
  moodLabel: string;
  stageLabel: string;
  imagePath: string;
  pet: PetState;
  events: PetEvent[];
}
