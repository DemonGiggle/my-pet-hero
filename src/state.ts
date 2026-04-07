import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { PetState, Species, HeroClass } from './types.js';
import { SPECIES } from './species.js';
import { applyClassAttributeBonus, recommendClass, getClassAffinity } from './classes.js';
import { clamp, expToNextLevel, randomSeed } from './utils.js';

const needsSchema = z.object({
  health: z.number(),
  hunger: z.number(),
  thirst: z.number(),
  mood: z.number(),
  energy: z.number(),
  hygiene: z.number()
});

const personalitySchema = z.object({
  sociability: z.number(),
  curiosity: z.number(),
  discipline: z.number(),
  playfulness: z.number(),
  appetite: z.number()
});

const attributesSchema = z.object({
  strength: z.number(),
  agility: z.number(),
  intelligence: z.number(),
  vitality: z.number(),
  luck: z.number()
});

const heroClassSchema = z.enum(['berserker', 'rogue', 'mage']);
const aptitudeSchema = z.object({
  berserker: z.number(),
  rogue: z.number(),
  mage: z.number()
});
const equipmentBonusesSchema = z.object({
  maxHealth: z.number().optional(),
  attack: z.number().optional(),
  magicAttack: z.number().optional(),
  defense: z.number().optional(),
  magicDefense: z.number().optional(),
  accuracy: z.number().optional(),
  evasion: z.number().optional(),
  crit: z.number().optional()
});
const equipmentItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: z.enum(['weapon', 'armor', 'accessory']),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic']),
  itemLevel: z.number(),
  heroClass: heroClassSchema,
  bonuses: equipmentBonusesSchema,
  source: z.string().optional()
});

const skillUseSchema = z.object({
  round: z.number(),
  actor: z.enum(['hero', 'enemy']),
  skillKey: z.string(),
  skillLabel: z.string(),
  effectKind: z.enum(['damage', 'heal', 'shield', 'buff']),
  damageType: z.enum(['physical', 'magic']).optional(),
  value: z.number(),
  text: z.string()
});

const combatTurnSchema = z.object({
  round: z.number(),
  actor: z.enum(['hero', 'enemy']),
  result: z.enum(['hit', 'crit', 'miss', 'skill']),
  damageType: z.enum(['physical', 'magic']),
  damage: z.number(),
  text: z.string(),
  skill: skillUseSchema.optional()
});

const combatantSchema = z.object({
  name: z.string(),
  maxHealth: z.number(),
  health: z.number(),
  attack: z.number(),
  magicAttack: z.number(),
  defense: z.number(),
  magicDefense: z.number(),
  accuracy: z.number(),
  evasion: z.number(),
  crit: z.number(),
  damageTypeBias: z.enum(['physical', 'magic']),
  shield: z.number().default(0)
});

const enemyTemplateSchema = z.object({
  key: z.string(),
  label: z.string(),
  floorRange: z.tuple([z.number(), z.number()]),
  damageTypeBias: z.enum(['physical', 'magic']),
  baseHealth: z.number(),
  baseAttack: z.number(),
  baseDefense: z.number(),
  baseAccuracy: z.number(),
  baseEvasion: z.number(),
  baseCrit: z.number(),
  aggression: z.number(),
  expReward: z.number(),
  goldReward: z.number(),
  abilities: z.array(z.string()).optional()
});

const combatResultSchema = z.object({
  outcome: z.enum(['win', 'escape', 'defeat']),
  enemy: enemyTemplateSchema,
  hero: combatantSchema,
  enemyState: combatantSchema,
  rounds: z.number(),
  turns: z.array(combatTurnSchema),
  skillsUsed: z.array(skillUseSchema).default([]),
  expGained: z.number(),
  goldGained: z.number(),
  healthLoss: z.number(),
  moodDelta: z.number(),
  text: z.string()
});

const dungeonRoomSchema = z.object({
  id: z.string(),
  type: z.enum(['entrance', 'battle', 'elite', 'treasure', 'event', 'rest', 'shop', 'boss']),
  name: z.string(),
  depth: z.number(),
  enemies: z.array(z.string()).default([]),
  cleared: z.boolean().default(false),
  exits: z.array(z.string()).default([])
});

const dungeonInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  theme: z.string(),
  templateKey: z.string(),
  floor: z.number(),
  rooms: z.array(dungeonRoomSchema),
  currentRoomId: z.string(),
  discoveredRoomIds: z.array(z.string()).default([]),
  clearedRoomIds: z.array(z.string()).default([]),
  seed: z.string(),
  description: z.string().default('')
});

const petStateSchema = z.object({
  version: z.number(),
  id: z.string(),
  name: z.string(),
  species: z.enum(['elf', 'dwarf', 'human', 'orc', 'dragon']),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastSimulatedAt: z.string(),
  ageHours: z.number(),
  seed: z.number(),
  needs: needsSchema,
  personality: personalitySchema,
  hero: z.object({
    level: z.number(),
    exp: z.number(),
    expToNext: z.number(),
    statPoints: z.number(),
    gold: z.number(),
    attributes: attributesSchema,
    equipment: z.object({
      equipped: z.object({
        weapon: equipmentItemSchema.optional(),
        armor: equipmentItemSchema.optional(),
        accessory: equipmentItemSchema.optional()
      }).default({}),
      inventory: z.array(equipmentItemSchema).default([]),
      lastEquippedAt: z.string().optional()
    }).default({ equipped: {}, inventory: [] }),
    dungeon: z.object({
      seed: z.number(),
      floor: z.number(),
      deepestFloor: z.number(),
      runs: z.number(),
      location: z.enum(['village', 'dungeon']).default('village'),
      currentDungeon: dungeonInstanceSchema.optional(),
      currentExpedition: z.object({
        id: z.string(),
        startedAt: z.string(),
        endedAt: z.string().optional(),
        dungeonName: z.string(),
        floor: z.number(),
        status: z.enum(['preparing', 'exploring', 'returned', 'failed']),
        returnMode: z.enum(['portal', 'retreat', 'defeat']).optional(),
        roomsCleared: z.number(),
        totalRooms: z.number(),
        bossDefeated: z.boolean(),
        totalExpGained: z.number().default(0),
        totalGoldGained: z.number().default(0),
        villagePreparation: z.array(z.string()).default([]),
        returnSummary: z.string().optional(),
        completed: z.boolean().default(false),
        logs: z.array(z.any())
      }).optional(),
      expeditionHistory: z.array(z.object({
        id: z.string(),
        startedAt: z.string(),
        endedAt: z.string().optional(),
        dungeonName: z.string(),
        floor: z.number(),
        status: z.enum(['preparing', 'exploring', 'returned', 'failed']),
        returnMode: z.enum(['portal', 'retreat', 'defeat']).optional(),
        roomsCleared: z.number(),
        totalRooms: z.number(),
        bossDefeated: z.boolean(),
        totalExpGained: z.number().default(0),
        totalGoldGained: z.number().default(0),
        villagePreparation: z.array(z.string()).default([]),
        returnSummary: z.string().optional(),
        completed: z.boolean().default(false),
        logs: z.array(z.any())
      })).default([]),
      village: z.object({
        name: z.string().default('晨霧村'),
        supplies: z.object({
          food: z.number().default(3),
          water: z.number().default(3),
          herbs: z.number().default(1)
        }),
        lastVisitedAt: z.string()
      }).default({
        name: '晨霧村',
        supplies: { food: 3, water: 3, herbs: 1 },
        lastVisitedAt: new Date().toISOString()
      })
    }),
    classProgress: z.object({
      current: heroClassSchema,
      unlocked: z.array(heroClassSchema),
      aptitude: aptitudeSchema
    }),
    adventureLog: z.array(z.object({
      at: z.string(),
      floor: z.number(),
      outcome: z.enum(['win', 'escape', 'rest', 'treasure', 'defeat']),
      text: z.string(),
      expGained: z.number(),
      goldGained: z.number(),
      combat: combatResultSchema.optional(),
      dungeonName: z.string().optional(),
      roomName: z.string().optional(),
      roomType: z.enum(['entrance', 'battle', 'elite', 'treasure', 'event', 'rest', 'shop', 'boss']).optional(),
      rewards: z.array(z.string()).optional(),
      roomSummary: z.string().optional(),
      roomEffect: z.object({
        health: z.number().optional(),
        energy: z.number().optional(),
        mood: z.number().optional(),
        hunger: z.number().optional(),
        thirst: z.number().optional()
      }).optional(),
      runState: z.object({
        roomIndex: z.number(),
        roomCount: z.number(),
        clearedRoomIds: z.array(z.string()),
        discoveredRoomIds: z.array(z.string()),
        completedDungeon: z.boolean()
      }).optional()
    }))
  }),
  history: z.array(z.object({
    at: z.string(),
    type: z.string(),
    delta: needsSchema.partial(),
    text: z.string()
  }))
});

export const DEFAULT_DATA_DIR = path.resolve('/home/gigo/.openclaw/projects/my-pet-hero/data/pets');

export function petFilePath(id: string, dataDir = DEFAULT_DATA_DIR): string {
  return path.join(dataDir, `${id}.json`);
}

export async function loadPet(id: string, dataDir = DEFAULT_DATA_DIR): Promise<PetState> {
  const raw = await readFile(petFilePath(id, dataDir), 'utf8');
  return petStateSchema.parse(JSON.parse(raw));
}

export async function savePet(pet: PetState, dataDir = DEFAULT_DATA_DIR): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  pet.updatedAt = new Date().toISOString();
  await writeFile(petFilePath(pet.id, dataDir), JSON.stringify(pet, null, 2) + '\n', 'utf8');
}

function buildAptitude(species: Species): Record<HeroClass, number> {
  return {
    berserker: Number(getClassAffinity('berserker', species).toFixed(2)),
    rogue: Number(getClassAffinity('rogue', species).toFixed(2)),
    mage: Number(getClassAffinity('mage', species).toFixed(2))
  };
}

export function createPet(params: { id: string; name: string; species: Species; heroClass?: HeroClass; now?: string }): PetState {
  const now = params.now ?? new Date().toISOString();
  const speciesConfig = SPECIES[params.species];
  const currentClass = params.heroClass ?? recommendClass(params.species);
  const personality = {
    sociability: speciesConfig.temperament.sociability ?? 0.5,
    curiosity: speciesConfig.temperament.curiosity ?? 0.5,
    discipline: speciesConfig.temperament.discipline ?? 0.5,
    playfulness: speciesConfig.temperament.playfulness ?? 0.5,
    appetite: speciesConfig.temperament.appetite ?? 0.5
  };

  const baseAttributes = {
    strength: 8 + (speciesConfig.attributeBias.strength ?? 0),
    agility: 8 + (speciesConfig.attributeBias.agility ?? 0),
    intelligence: 8 + (speciesConfig.attributeBias.intelligence ?? 0),
    vitality: 8 + (speciesConfig.attributeBias.vitality ?? 0),
    luck: 8 + (speciesConfig.attributeBias.luck ?? 0)
  };

  const finalAttributes = applyClassAttributeBonus(params.species, currentClass, baseAttributes);
  const aptitude = buildAptitude(params.species);

  return {
    version: 7,
    id: params.id,
    name: params.name,
    species: params.species,
    createdAt: now,
    updatedAt: now,
    lastSimulatedAt: now,
    ageHours: 0,
    seed: randomSeed(),
    needs: {
      health: clamp(78 + (speciesConfig.statBias.health ?? 0)),
      hunger: clamp(25 + (speciesConfig.statBias.hunger ?? 0)),
      thirst: clamp(24 + (speciesConfig.statBias.thirst ?? 0)),
      mood: clamp(72 + (speciesConfig.statBias.mood ?? 0)),
      energy: clamp(68 + (speciesConfig.statBias.energy ?? 0)),
      hygiene: clamp(74 + (speciesConfig.statBias.hygiene ?? 0))
    },
    personality,
    hero: {
      level: 1,
      exp: 0,
      expToNext: expToNextLevel(1),
      statPoints: 0,
      gold: 0,
      attributes: finalAttributes,
      equipment: {
        equipped: {
          weapon: undefined,
          armor: undefined,
          accessory: undefined
        },
        inventory: []
      },
      dungeon: {
        seed: randomSeed(),
        floor: 1,
        deepestFloor: 1,
        runs: 0,
        location: 'village',
        expeditionHistory: [],
        village: {
          name: '晨霧村',
          supplies: { food: 3, water: 3, herbs: 1 },
          lastVisitedAt: now
        }
      },
      classProgress: {
        current: currentClass,
        unlocked: [currentClass],
        aptitude
      },
      adventureLog: []
    },
    history: []
  };
}
