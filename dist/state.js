import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { SPECIES } from './species.js';
import { applyClassAttributeBonus, recommendClass } from './classes.js';
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
        dungeon: z.object({
            seed: z.number(),
            floor: z.number(),
            deepestFloor: z.number(),
            runs: z.number()
        }),
        classProgress: z.object({
            current: heroClassSchema,
            unlocked: z.array(heroClassSchema),
            aptitude: aptitudeSchema
        }),
        adventureLog: z.array(z.object({
            at: z.string(),
            floor: z.number(),
            outcome: z.enum(['win', 'escape', 'rest', 'treasure']),
            text: z.string(),
            expGained: z.number(),
            goldGained: z.number()
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
export function petFilePath(id, dataDir = DEFAULT_DATA_DIR) {
    return path.join(dataDir, `${id}.json`);
}
export async function loadPet(id, dataDir = DEFAULT_DATA_DIR) {
    const raw = await readFile(petFilePath(id, dataDir), 'utf8');
    return petStateSchema.parse(JSON.parse(raw));
}
export async function savePet(pet, dataDir = DEFAULT_DATA_DIR) {
    await mkdir(dataDir, { recursive: true });
    pet.updatedAt = new Date().toISOString();
    await writeFile(petFilePath(pet.id, dataDir), JSON.stringify(pet, null, 2) + '\n', 'utf8');
}
function buildAptitude(species) {
    const recommended = recommendClass(species);
    return {
        berserker: recommended === 'berserker' ? 1.15 : 1,
        rogue: recommended === 'rogue' ? 1.15 : 1,
        mage: recommended === 'mage' ? 1.15 : 1
    };
}
export function createPet(params) {
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
        version: 3,
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
            dungeon: {
                seed: randomSeed(),
                floor: 1,
                deepestFloor: 1,
                runs: 0
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
