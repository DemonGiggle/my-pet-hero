import { readFile, writeFile, mkdir, copyFile, readdir, access, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { SPECIES } from './species.js';
import { applyClassAttributeBonus, recommendClass, getClassAffinity } from './classes.js';
import { clamp, expToNextLevel, randomSeed } from './utils.js';
export const CURRENT_SAVE_VERSION = 7;
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
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..');
export const LEGACY_DATA_DIR = path.join(REPO_ROOT, 'data', 'pets');
export const DEFAULT_DATA_DIR = resolveDefaultDataDir();
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function ensureExpeditionShape(expedition) {
    if (!isRecord(expedition))
        return expedition;
    return {
        ...expedition,
        totalExpGained: typeof expedition.totalExpGained === 'number' ? expedition.totalExpGained : 0,
        totalGoldGained: typeof expedition.totalGoldGained === 'number' ? expedition.totalGoldGained : 0,
        villagePreparation: Array.isArray(expedition.villagePreparation) ? expedition.villagePreparation : [],
        returnSummary: typeof expedition.returnSummary === 'string' ? expedition.returnSummary : undefined,
        completed: typeof expedition.completed === 'boolean' ? expedition.completed : false,
        logs: Array.isArray(expedition.logs) ? expedition.logs : []
    };
}
function migrateSaveData(raw) {
    if (!isRecord(raw)) {
        throw new Error('Invalid save file: expected top-level object.');
    }
    const version = typeof raw.version === 'number' ? raw.version : NaN;
    if (!Number.isInteger(version)) {
        throw new Error('Invalid save file: missing numeric version.');
    }
    if (version < 2) {
        throw new Error(`Unsupported save version ${version}. Supported versions start at 2.`);
    }
    if (version > CURRENT_SAVE_VERSION) {
        throw new Error(`Save version ${version} is newer than supported version ${CURRENT_SAVE_VERSION}.`);
    }
    const originalVersion = version;
    let changed = false;
    const migrated = cloneJson(raw);
    while (migrated.version < CURRENT_SAVE_VERSION) {
        const currentVersion = migrated.version;
        if (currentVersion === 2) {
            const species = migrated.species;
            const currentClass = recommendClass(species);
            const hero = isRecord(migrated.hero) ? migrated.hero : {};
            hero.classProgress = {
                current: currentClass,
                unlocked: [currentClass],
                aptitude: buildAptitude(species)
            };
            migrated.hero = hero;
            migrated.version = 3;
            changed = true;
            continue;
        }
        if (currentVersion === 3) {
            migrated.version = 4;
            changed = true;
            continue;
        }
        if (currentVersion === 4) {
            const hero = isRecord(migrated.hero) ? migrated.hero : {};
            const adventureLog = Array.isArray(hero.adventureLog) ? hero.adventureLog : [];
            hero.adventureLog = adventureLog.map(entry => {
                if (!isRecord(entry))
                    return entry;
                const combat = isRecord(entry.combat) ? entry.combat : undefined;
                if (!combat)
                    return entry;
                const normalizeCombatant = (combatant) => {
                    if (!isRecord(combatant))
                        return combatant;
                    return {
                        ...combatant,
                        shield: typeof combatant.shield === 'number' ? combatant.shield : 0
                    };
                };
                return {
                    ...entry,
                    combat: {
                        ...combat,
                        hero: normalizeCombatant(combat.hero),
                        enemyState: normalizeCombatant(combat.enemyState),
                        turns: Array.isArray(combat.turns)
                            ? combat.turns.map(turn => isRecord(turn) ? { ...turn, skill: turn.skill } : turn)
                            : [],
                        skillsUsed: Array.isArray(combat.skillsUsed) ? combat.skillsUsed : []
                    }
                };
            });
            migrated.hero = hero;
            migrated.version = 5;
            changed = true;
            continue;
        }
        if (currentVersion === 5) {
            migrated.version = 6;
            changed = true;
            continue;
        }
        if (currentVersion === 6) {
            const now = typeof migrated.updatedAt === 'string'
                ? migrated.updatedAt
                : (typeof migrated.createdAt === 'string' ? migrated.createdAt : new Date().toISOString());
            const hero = isRecord(migrated.hero) ? migrated.hero : {};
            const dungeon = isRecord(hero.dungeon) ? hero.dungeon : {};
            const hasCurrentDungeon = isRecord(dungeon.currentDungeon);
            hero.equipment = isRecord(hero.equipment)
                ? {
                    ...hero.equipment,
                    equipped: isRecord(hero.equipment.equipped) ? hero.equipment.equipped : {},
                    inventory: Array.isArray(hero.equipment.inventory) ? hero.equipment.inventory : []
                }
                : {
                    equipped: {},
                    inventory: []
                };
            dungeon.location = dungeon.location === 'dungeon' || dungeon.location === 'village'
                ? dungeon.location
                : (hasCurrentDungeon ? 'dungeon' : 'village');
            dungeon.expeditionHistory = Array.isArray(dungeon.expeditionHistory)
                ? dungeon.expeditionHistory.map(ensureExpeditionShape)
                : [];
            dungeon.currentExpedition = dungeon.currentExpedition ? ensureExpeditionShape(dungeon.currentExpedition) : undefined;
            dungeon.village = isRecord(dungeon.village)
                ? {
                    ...dungeon.village,
                    name: typeof dungeon.village.name === 'string' ? dungeon.village.name : '晨霧村',
                    supplies: isRecord(dungeon.village.supplies)
                        ? {
                            food: typeof dungeon.village.supplies.food === 'number' ? dungeon.village.supplies.food : 3,
                            water: typeof dungeon.village.supplies.water === 'number' ? dungeon.village.supplies.water : 3,
                            herbs: typeof dungeon.village.supplies.herbs === 'number' ? dungeon.village.supplies.herbs : 1
                        }
                        : { food: 3, water: 3, herbs: 1 },
                    lastVisitedAt: typeof dungeon.village.lastVisitedAt === 'string' ? dungeon.village.lastVisitedAt : now
                }
                : {
                    name: '晨霧村',
                    supplies: { food: 3, water: 3, herbs: 1 },
                    lastVisitedAt: now
                };
            const adventureLog = Array.isArray(hero.adventureLog) ? hero.adventureLog : [];
            hero.adventureLog = adventureLog.map(entry => {
                if (!isRecord(entry))
                    return entry;
                const combat = isRecord(entry.combat) ? entry.combat : undefined;
                return {
                    ...entry,
                    rewards: Array.isArray(entry.rewards) ? entry.rewards : undefined,
                    roomSummary: typeof entry.roomSummary === 'string' ? entry.roomSummary : undefined,
                    roomEffect: isRecord(entry.roomEffect) ? entry.roomEffect : undefined,
                    runState: isRecord(entry.runState) ? entry.runState : undefined,
                    combat: combat
                        ? {
                            ...combat,
                            hero: isRecord(combat.hero)
                                ? { ...combat.hero, shield: typeof combat.hero.shield === 'number' ? combat.hero.shield : 0 }
                                : combat.hero,
                            enemyState: isRecord(combat.enemyState)
                                ? { ...combat.enemyState, shield: typeof combat.enemyState.shield === 'number' ? combat.enemyState.shield : 0 }
                                : combat.enemyState,
                            skillsUsed: Array.isArray(combat.skillsUsed) ? combat.skillsUsed : []
                        }
                        : undefined
                };
            });
            hero.dungeon = dungeon;
            migrated.hero = hero;
            migrated.version = 7;
            changed = true;
            continue;
        }
        throw new Error(`Unsupported migration path from version ${currentVersion}.`);
    }
    return {
        migrated: petStateSchema.parse(migrated),
        fromVersion: originalVersion,
        changed
    };
}
async function backupOriginalSave(id, raw, fromVersion, dataDir) {
    const backupDir = path.join(dataDir, 'backups');
    await mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${id}.v${fromVersion}.${timestamp}.json`);
    await writeFile(backupPath, raw, 'utf8');
}
function resolveDefaultDataDir() {
    const envDir = process.env.MY_PET_HERO_DATA_DIR?.trim();
    if (envDir)
        return path.resolve(envDir);
    const xdgStateHome = process.env.XDG_STATE_HOME?.trim();
    if (xdgStateHome)
        return path.resolve(xdgStateHome, 'my-pet-hero', 'pets');
    return path.join(os.homedir(), '.local', 'state', 'my-pet-hero', 'pets');
}
async function pathExists(targetPath) {
    try {
        await access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
async function migrateLegacyPets(dataDir) {
    if (dataDir === LEGACY_DATA_DIR)
        return;
    if (!(await pathExists(LEGACY_DATA_DIR)))
        return;
    await mkdir(dataDir, { recursive: true });
    const legacyFiles = await readdir(LEGACY_DATA_DIR);
    for (const fileName of legacyFiles) {
        if (!fileName.endsWith('.json'))
            continue;
        const legacyPath = path.join(LEGACY_DATA_DIR, fileName);
        const targetPath = path.join(dataDir, fileName);
        if (await pathExists(targetPath))
            continue;
        await copyFile(legacyPath, targetPath);
    }
}
export async function ensureDataDir(dataDir = DEFAULT_DATA_DIR) {
    await migrateLegacyPets(dataDir);
    await mkdir(dataDir, { recursive: true });
    return dataDir;
}
export function petFilePath(id, dataDir = DEFAULT_DATA_DIR) {
    return path.join(dataDir, `${id}.json`);
}
export async function listPetSaves(dataDir = DEFAULT_DATA_DIR) {
    const resolvedDataDir = await ensureDataDir(dataDir);
    const entries = await readdir(resolvedDataDir);
    const pets = [];
    for (const fileName of entries) {
        if (!fileName.endsWith('.json'))
            continue;
        const filePath = path.join(resolvedDataDir, fileName);
        const entryStat = await stat(filePath);
        if (!entryStat.isFile())
            continue;
        try {
            const raw = JSON.parse(await readFile(filePath, 'utf8'));
            pets.push({
                id: fileName.replace(/\.json$/i, ''),
                filePath,
                updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : entryStat.mtime.toISOString(),
                version: typeof raw.version === 'number' ? raw.version : NaN,
                name: typeof raw.name === 'string' ? raw.name : undefined,
                species: typeof raw.species === 'string' ? raw.species : undefined
            });
        }
        catch {
            pets.push({
                id: fileName.replace(/\.json$/i, ''),
                filePath,
                updatedAt: entryStat.mtime.toISOString(),
                version: NaN
            });
        }
    }
    return pets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function loadPet(id, dataDir = DEFAULT_DATA_DIR) {
    const resolvedDataDir = await ensureDataDir(dataDir);
    const filePath = petFilePath(id, resolvedDataDir);
    const raw = await readFile(filePath, 'utf8');
    const { migrated, fromVersion, changed } = migrateSaveData(JSON.parse(raw));
    if (changed) {
        await backupOriginalSave(id, raw, fromVersion, resolvedDataDir);
        await writeFile(filePath, JSON.stringify(migrated, null, 2) + '\n', 'utf8');
    }
    return migrated;
}
export async function savePet(pet, dataDir = DEFAULT_DATA_DIR) {
    const resolvedDataDir = await ensureDataDir(dataDir);
    pet.updatedAt = new Date().toISOString();
    await writeFile(petFilePath(pet.id, resolvedDataDir), JSON.stringify(pet, null, 2) + '\n', 'utf8');
}
function buildAptitude(species) {
    return {
        berserker: Number(getClassAffinity('berserker', species).toFixed(2)),
        rogue: Number(getClassAffinity('rogue', species).toFixed(2)),
        mage: Number(getClassAffinity('mage', species).toFixed(2))
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
        version: CURRENT_SAVE_VERSION,
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
