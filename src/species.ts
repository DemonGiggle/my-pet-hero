import { SpeciesConfig, Species } from './types.js';

export const SPECIES: Record<Species, SpeciesConfig> = {
  elf: {
    key: 'elf',
    label: '精靈',
    description: '靈巧、敏感、偏愛安靜與秩序。',
    statBias: { mood: 8, hygiene: 10, hunger: -4, thirst: -2 },
    attributeBias: { agility: 3, intelligence: 2, vitality: -1 },
    decay: { hungerPerHour: 2.2, thirstPerHour: 2.6, energyPerHour: 1.4, hygienePerHour: 1.2, moodDriftPerHour: 0.3 },
    temperament: { curiosity: 0.8, discipline: 0.7, sociability: 0.45 },
    palette: { primary: '#7bd389', secondary: '#d8f3dc', accent: '#2d6a4f', background: '#f1fff5', text: '#1b4332' }
  },
  dwarf: {
    key: 'dwarf',
    label: '矮人',
    description: '耐操、踏實、喜歡把自己照顧得很穩。',
    statBias: { health: 12, energy: 8, mood: -2, thirst: 4 },
    attributeBias: { strength: 2, vitality: 3, agility: -1 },
    decay: { hungerPerHour: 2.8, thirstPerHour: 2.9, energyPerHour: 1.0, hygienePerHour: 1.8, moodDriftPerHour: 0.2 },
    temperament: { discipline: 0.85, appetite: 0.7, playfulness: 0.35 },
    palette: { primary: '#c08552', secondary: '#f2cc8f', accent: '#7f5539', background: '#fff8ef', text: '#5a3e2b' }
  },
  human: {
    key: 'human',
    label: '人類',
    description: '均衡、適應力高，沒有特別偏科。',
    statBias: {},
    attributeBias: { strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1 },
    decay: { hungerPerHour: 2.5, thirstPerHour: 2.8, energyPerHour: 1.8, hygienePerHour: 1.5, moodDriftPerHour: 0.25 },
    temperament: { sociability: 0.6, curiosity: 0.6, discipline: 0.55, playfulness: 0.55, appetite: 0.55 },
    palette: { primary: '#7aa6ff', secondary: '#dfe9ff', accent: '#3b5bdb', background: '#f5f8ff', text: '#1c2a4a' }
  },
  orc: {
    key: 'orc',
    label: '獸人',
    description: '直接、好動、情緒起伏大但恢復快。',
    statBias: { health: 10, mood: 4, hygiene: -8, hunger: 6, thirst: 5 },
    attributeBias: { strength: 4, vitality: 2, intelligence: -1 },
    decay: { hungerPerHour: 3.4, thirstPerHour: 3.5, energyPerHour: 2.2, hygienePerHour: 2.1, moodDriftPerHour: 0.45 },
    temperament: { playfulness: 0.75, appetite: 0.85, discipline: 0.35, sociability: 0.7 },
    palette: { primary: '#6a994e', secondary: '#cfe1b9', accent: '#386641', background: '#f4ffe9', text: '#233d1a' }
  },
  dragon: {
    key: 'dragon',
    label: '龍族',
    description: '高傲、稀有、狀態好的時候非常有存在感。',
    statBias: { health: 14, mood: 6, energy: -6, thirst: -4 },
    attributeBias: { strength: 2, intelligence: 2, vitality: 2, luck: 1 },
    decay: { hungerPerHour: 3.1, thirstPerHour: 2.4, energyPerHour: 2.5, hygienePerHour: 1.1, moodDriftPerHour: 0.35 },
    temperament: { curiosity: 0.7, discipline: 0.45, playfulness: 0.5, appetite: 0.8 },
    palette: { primary: '#8e7dff', secondary: '#ebe7ff', accent: '#5a46d6', background: '#f7f4ff', text: '#2f255c' }
  }
};

export const SPECIES_LIST = Object.values(SPECIES);
