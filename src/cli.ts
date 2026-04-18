#!/usr/bin/env node
import {
  checkpointHistoryPayload,
  equipInventoryItem,
  executeChatCommand,
  getInventoryPayload,
  getMutationPayload,
  getSavesPayload,
  getStatusPayload,
  resolvePetId,
  sellInventoryItem
} from './app.js';
import { CURRENT_SAVE_VERSION, DEFAULT_DATA_DIR, createPet, listPetSaves, loadPet, petFilePath, savePet } from './state.js';
import { loadGameConfig } from './config.js';
import { simulatePet } from './simulate.js';
import { renderStatusCard } from './render.js';
import { SPECIES_LIST } from './species.js';
import { CLASS_LIST, recommendClass } from './classes.js';
import { HeroClass, Species, PetState } from './types.js';
import { runCombat, ENEMIES } from './combat.js';
import { SKILLS } from './skills.js';
import { autoDungeonRun } from './systems.js';
import { formatEquipmentSummary } from './gear.js';
import { renderDungeonMinimap } from './dungeons.js';

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'pet';
}

function clonePet<T extends PetState>(pet: T): T {
  return JSON.parse(JSON.stringify(pet)) as T;
}
async function printStatus(idArg?: string): Promise<void> {
  console.log(JSON.stringify(await getStatusPayload(idArg, hasFlag('report')), null, 2));
}

async function mutate(idArg: string | undefined, action: 'feed' | 'play' | 'clean'): Promise<void> {
  console.log(JSON.stringify(await getMutationPayload(idArg, action), null, 2));
}

async function create(): Promise<void> {
  const name = getArg('name');
  const species = getArg('species') as Species | undefined;
  const heroClass = getArg('class') as HeroClass | undefined;
  if (!name || !species) {
    throw new Error(`create 需要 --name 與 --species，可用種族: ${SPECIES_LIST.map(s => s.key).join(', ')}`);
  }
  const pet = createPet({ id: slugify(name), name, species, heroClass });
  await savePet(pet);
  const rendered = await renderStatusCard({ pet, summary: `${pet.name} 成為新的勇者` });
  console.log(JSON.stringify({
    id: pet.id,
    name: pet.name,
    species: pet.species,
    heroClass: pet.hero.classProgress.current,
    recommendedClass: recommendClass(pet.species),
    skills: SKILLS[pet.hero.classProgress.current],
    level: pet.hero.level,
    attributes: pet.hero.attributes,
    aptitude: pet.hero.classProgress.aptitude,
    equipment: pet.hero.equipment,
    equipmentSummary: formatEquipmentSummary(pet),
    imagePath: rendered.outputPath,
    needs: pet.needs
  }, null, 2));
}

function printClasses(): void {
  console.log(JSON.stringify(CLASS_LIST, null, 2));
}

function printEnemies(): void {
  console.log(JSON.stringify(ENEMIES, null, 2));
}

function printSkills(): void {
  console.log(JSON.stringify(SKILLS, null, 2));
}

async function printSaves(): Promise<void> {
  console.log(JSON.stringify({ dataDir: DEFAULT_DATA_DIR, ...await getSavesPayload() }, null, 2));
}

async function printDoctor(idArg?: string): Promise<void> {
  const saves = await listPetSaves();
  const requestedId = idArg ?? (saves.length === 1 ? saves[0].id : undefined);
  const { config, configPath } = loadGameConfig();
  const payload: Record<string, unknown> = {
    currentSaveVersion: CURRENT_SAVE_VERSION,
    dataDir: DEFAULT_DATA_DIR,
    saveCount: saves.length,
    defaultHeroId: saves.length === 1 ? saves[0].id : null,
    runtimeConfig: {
      configPath: configPath ?? null,
      cadence: config.cadence,
      envOverrides: {
        simulationBucketMinutes: process.env.MY_PET_HERO_SIM_BUCKET_MINUTES ?? null,
        villageActivityBucketMinutes: process.env.MY_PET_HERO_VILLAGE_BUCKET_MINUTES ?? null
      }
    },
    migrationPolicy: {
      supportedFrom: [2, 3, 4, 5, 6, 7],
      target: CURRENT_SAVE_VERSION,
      behavior: 'loadPet 會自動升級舊存檔、備份原始 JSON、再覆寫成最新 schema。',
      rejects: '版本小於 2 或高於目前版本的存檔會拒絕載入。'
    }
  };

  if (requestedId) {
    const pet = await loadPet(requestedId);
    payload.pet = {
      id: pet.id,
      filePath: petFilePath(pet.id),
      version: pet.version,
      name: pet.name,
      species: pet.species,
      heroClass: pet.hero.classProgress.current,
      location: pet.hero.dungeon.location,
      expeditionHistoryCount: pet.hero.dungeon.expeditionHistory.length,
      inventoryCount: pet.hero.equipment.inventory.length
    };
  }

  console.log(JSON.stringify(payload, null, 2));
}

async function dungeonPreview(idArg?: string): Promise<void> {
  const id = await resolvePetId(idArg);
  const pet = await loadPet(id);
  const previewPet = clonePet(pet);
  const at = getArg('at') ?? new Date().toISOString();
  const floorArg = getArg('floor');
  const repeat = Math.max(1, Number(getArg('repeat') ?? '1'));
  if (floorArg) {
    const floor = Number(floorArg);
    previewPet.hero.dungeon.floor = Math.max(1, floor - 1);
  }
  if (hasFlag('force-ready')) {
    previewPet.needs.health = Math.max(previewPet.needs.health, 78);
    previewPet.needs.energy = Math.max(previewPet.needs.energy, 76);
    previewPet.needs.hunger = Math.min(previewPet.needs.hunger, 34);
    previewPet.needs.thirst = Math.min(previewPet.needs.thirst, 30);
  }

  const before = JSON.parse(JSON.stringify({
    floor: previewPet.hero.dungeon.floor,
    runs: previewPet.hero.dungeon.runs,
    needs: previewPet.needs
  }));
  const logs = [];
  for (let i = 0; i < repeat; i++) {
    const runAt = new Date(new Date(at).getTime() + i * 60_000).toISOString();
    const log = autoDungeonRun(previewPet, runAt);
    if (!log) break;
    logs.push(log);
  }

  console.log(JSON.stringify({
    id: previewPet.id,
    requestedAt: at,
    forcedReady: hasFlag('force-ready'),
    repeat,
    triggered: logs.length > 0,
    before,
    logs,
    currentDungeon: previewPet.hero.dungeon.currentDungeon
      ? {
          ...previewPet.hero.dungeon.currentDungeon,
          minimap: renderDungeonMinimap(previewPet.hero.dungeon.currentDungeon)
        }
      : null,
    currentExpedition: previewPet.hero.dungeon.currentExpedition ?? null,
    expeditionHistory: previewPet.hero.dungeon.expeditionHistory,
    after: {
      floor: previewPet.hero.dungeon.floor,
      runs: previewPet.hero.dungeon.runs,
      needs: previewPet.needs,
      location: previewPet.hero.dungeon.location
    }
  }, null, 2));
}

async function combatPreview(idArg?: string): Promise<void> {
  const id = await resolvePetId(idArg);
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  const floor = Number(getArg('floor') ?? result.pet.hero.dungeon.floor + 1);
  const combat = runCombat(result.pet, floor, new Date().toISOString());
  console.log(JSON.stringify({
    id: result.pet.id,
    floor,
    heroClass: result.pet.hero.classProgress.current,
    skills: SKILLS[result.pet.hero.classProgress.current],
    enemy: combat.enemy.label,
    outcome: combat.outcome,
    rounds: combat.rounds,
    expGained: combat.expGained,
    goldGained: combat.goldGained,
    healthLoss: combat.healthLoss,
    text: combat.text,
    skillsUsed: combat.skillsUsed,
    turns: combat.turns
  }, null, 2));
}

async function printInventory(idArg?: string): Promise<void> {
  console.log(JSON.stringify(await getInventoryPayload(idArg), null, 2));
}

async function printEquipResult(idArg: string | undefined, itemId: string): Promise<void> {
  console.log(JSON.stringify(await equipInventoryItem(idArg, itemId), null, 2));
}

async function printSellResult(idArg: string | undefined, itemId: string): Promise<void> {
  console.log(JSON.stringify(await sellInventoryItem(idArg, itemId), null, 2));
}

async function printCheckpoint(idArg?: string): Promise<void> {
  console.log(JSON.stringify(await checkpointHistoryPayload(idArg), null, 2));
}

async function printChatCommand(): Promise<void> {
  const rawInput = getArg('input') || process.argv.slice(3).join(' ').trim() || '';
  console.log(JSON.stringify(await executeChatCommand(rawInput), null, 2));
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (!cmd || cmd === 'help') {
    console.log(`my-pet-hero commands:\n  create --name NAME --species elf|dwarf|human|orc|dragon [--class berserker|rogue|mage]\n  status [--id PET_ID] [--report]\n  status 讀取目前狀態並輸出；status --report 會額外推進 simulation、寫回存檔，並輸出更完整的 report\n  inventory [--id PET_ID]\n  equip [--id PET_ID] --item ITEM_ID\n  sell [--id PET_ID] --item ITEM_ID\n  saves\n  doctor [--id PET_ID]\n  classes\n  skills\n  enemies\n  combat-preview [--id PET_ID] [--floor N]\n  dungeon-preview [--id PET_ID] [--floor N] [--at ISO] [--repeat N] [--force-ready]\n  feed [--id PET_ID]\n  play [--id PET_ID]\n  clean [--id PET_ID]\n  checkpoint [--id PET_ID]\n  chat --input \"/pet status\"\n\nconfig:\n  my-pet-hero.config.json -> { \"cadence\": { \"simulationBucketMinutes\": 5, \"villageActivityBucketMinutes\": 5 } }\n  env overrides -> MY_PET_HERO_CONFIG, MY_PET_HERO_SIM_BUCKET_MINUTES, MY_PET_HERO_VILLAGE_BUCKET_MINUTES`);
    return;
  }

  if (cmd === 'create') return create();
  if (cmd === 'classes') return printClasses();
  if (cmd === 'skills') return printSkills();
  if (cmd === 'enemies') return printEnemies();
  if (cmd === 'saves') return printSaves();
  if (cmd === 'doctor') return printDoctor(getArg('id'));
  if (cmd === 'inventory') return printInventory(getArg('id'));
  if (cmd === 'chat') return printChatCommand();
  if (cmd === 'combat-preview') return combatPreview(getArg('id'));
  if (cmd === 'dungeon-preview') return dungeonPreview(getArg('id'));
  if (cmd === 'checkpoint' || cmd === 'keep' || cmd === 'archive') return printCheckpoint(getArg('id'));
  if (cmd === 'equip') {
    const itemId = getArg('item');
    if (!itemId) throw new Error('equip 需要 --item');
    return printEquipResult(getArg('id'), itemId);
  }
  if (cmd === 'sell') {
    const itemId = getArg('item');
    if (!itemId) throw new Error('sell 需要 --item');
    return printSellResult(getArg('id'), itemId);
  }
  if (cmd === 'status') return printStatus(getArg('id'));
  if (cmd === 'feed' || cmd === 'play' || cmd === 'clean') return mutate(getArg('id'), cmd);
  throw new Error(`未知指令: ${cmd}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
