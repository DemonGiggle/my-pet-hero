#!/usr/bin/env node
import { createPet, loadPet, savePet } from './state.js';
import { simulatePet } from './simulate.js';
import { renderStatusCard } from './render.js';
import { feedPet, playWithPet, cleanPet } from './actions.js';
import { SPECIES_LIST } from './species.js';
import { CLASS_LIST, recommendClass } from './classes.js';
import { HeroClass, Species, PetState } from './types.js';
import { runCombat, ENEMIES } from './combat.js';
import { SKILLS } from './skills.js';
import { autoDungeonRun } from './systems.js';
import { describeItem, equipItemById, formatEquipmentSummary, listInventory, sellItemById } from './gear.js';

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

function formatExpeditionSummary(expedition: PetState['hero']['dungeon']['expeditionHistory'][number]): string[] {
  const title = expedition.completed
    ? `【探險結算】${expedition.dungeonName} / 第 ${expedition.floor} 層`
    : `【進行中探險】${expedition.dungeonName} / 第 ${expedition.floor} 層`;
  const lines = [
    title,
    `結果：${expedition.status}${expedition.returnMode ? ` / ${expedition.returnMode}` : ''}`,
    `進度：${expedition.roomsCleared}/${expedition.totalRooms} 房`,
    `收益：EXP +${expedition.totalExpGained} / Gold +${expedition.totalGoldGained}`,
    `Boss：${expedition.bossDefeated ? '已擊破' : '未擊破'}`,
    `完成度：${expedition.completed ? '本次探險已完整結束' : '仍在探索中'}`
  ];
  if (expedition.villagePreparation.length > 0) lines.push(`村莊整備：${expedition.villagePreparation.join('、')}`);
  if (expedition.returnSummary) lines.push(`回村整理：${expedition.returnSummary}`);
  if (expedition.logs.length > 0) {
    lines.push('本次歷程：');
    for (const item of expedition.logs) {
      const roomLabel = item.roomName ?? item.roomType ?? 'unknown';
      lines.push(`• ${roomLabel}，${item.outcome}，EXP +${item.expGained}，Gold +${item.goldGained}`);
      lines.push(`  ${item.text}`);
    }
  }
  return lines;
}

function formatAdventureReport(result: ReturnType<typeof simulatePet>): string[] {
  const adventures = result.pet.hero.adventureLog.slice(-3).reverse();
  if (adventures.length === 0) return ['最近還沒有冒險紀錄。'];

  const lines: string[] = [];
  const dungeonInfo = result.pet.hero.dungeon.currentDungeon
    ? `，正在探索 ${result.pet.hero.dungeon.currentDungeon.name}`
    : '';
  const locationText = result.pet.hero.dungeon.location === 'village'
    ? `目前在村莊 ${result.pet.hero.dungeon.village.name}。`
    : `目前在迷宮 ${result.pet.hero.dungeon.floor} 層${dungeonInfo}。`;
  lines.push(`狀態：Lv${result.pet.hero.level} ${result.pet.species} ${result.pet.hero.classProgress.current}，${result.moodLabel}，${locationText}`);
  lines.push('最近冒險：');

  lines.push(`裝備：${formatEquipmentSummary(result.pet).join(' / ')}`);

  if (result.pet.hero.dungeon.currentExpedition) {
    lines.push(`當前探險：${result.pet.hero.dungeon.currentExpedition.dungeonName}，${result.pet.hero.dungeon.currentExpedition.roomsCleared}/${result.pet.hero.dungeon.currentExpedition.totalRooms} 房。`);
    lines.push(...formatExpeditionSummary(result.pet.hero.dungeon.currentExpedition as PetState['hero']['dungeon']['expeditionHistory'][number]).map(line => `  ${line}`));
  } else if (result.pet.hero.dungeon.expeditionHistory.length > 0) {
    const latest = result.pet.hero.dungeon.expeditionHistory[result.pet.hero.dungeon.expeditionHistory.length - 1];
    lines.push(`上一趟探險：${latest.dungeonName}，結果 ${latest.status}${latest.returnMode ? ` / ${latest.returnMode}` : ''}。`);
    lines.push(...formatExpeditionSummary(latest).map(line => `  ${line}`));
  }

  for (const item of adventures) {
    const place = item.dungeonName ? ` / ${item.dungeonName} / ${item.roomName ?? item.roomType ?? 'unknown'}` : '';
    const progress = item.runState ? ` / ${item.runState.roomIndex}-${item.runState.roomCount}` : '';
    lines.push(`- Floor ${item.floor}${place}${progress} / ${item.outcome} / EXP +${item.expGained} / Gold +${item.goldGained}`);
    lines.push(`  ${item.text}`);
    if (item.roomSummary) lines.push(`  房型：${item.roomSummary}`);
    if (item.rewards && item.rewards.length > 0) lines.push(`  收益：${item.rewards.join('、')}`);

    if (item.combat) {
      lines.push(`  戰鬥：對上 ${item.combat.enemy.label}，${item.combat.rounds} 回合，結果 ${item.combat.outcome}`);
      if (item.combat.skillsUsed.length > 0) {
        lines.push(`  技能：${item.combat.skillsUsed.map(skill => skill.skillLabel).join('、')}`);
      }
      const turnTexts = item.combat.turns.slice(0, 3).map(turn => turn.text).join(' / ');
      if (turnTexts) lines.push(`  細節：${turnTexts}`);
    }
  }

  return lines;
}

async function printStatus(id: string): Promise<void> {
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  await savePet(result.pet);
  const rendered = await renderStatusCard({ pet: result.pet, summary: result.summary });
  const currentDungeon = result.pet.hero.dungeon.currentDungeon;
  const currentRoom = currentDungeon?.rooms.find(room => room.id === currentDungeon.currentRoomId);

  const payload: Record<string, unknown> = {
    location: result.pet.hero.dungeon.location,
    village: result.pet.hero.dungeon.village,
    currentExpedition: result.pet.hero.dungeon.currentExpedition ?? null,
    expeditionHistory: result.pet.hero.dungeon.expeditionHistory.slice(-3),
    id: result.pet.id,
    name: result.pet.name,
    species: result.pet.species,
    heroClass: result.pet.hero.classProgress.current,
    classUnlocked: result.pet.hero.classProgress.unlocked,
    skills: SKILLS[result.pet.hero.classProgress.current],
    level: result.pet.hero.level,
    exp: result.pet.hero.exp,
    expToNext: result.pet.hero.expToNext,
    gold: result.pet.hero.gold,
    dungeonFloor: result.pet.hero.dungeon.floor,
    deepestFloor: result.pet.hero.dungeon.deepestFloor,
    currentDungeon: currentDungeon
      ? {
          id: currentDungeon.id,
          name: currentDungeon.name,
          theme: currentDungeon.theme,
          description: currentDungeon.description,
          currentRoomId: currentDungeon.currentRoomId,
          discoveredRoomIds: currentDungeon.discoveredRoomIds,
          clearedRoomIds: currentDungeon.clearedRoomIds,
          rooms: currentDungeon.rooms,
          currentRoom
        }
      : null,
    summary: result.summary,
    mood: result.moodLabel,
    stage: result.stageLabel,
    imagePath: rendered.outputPath,
    needs: result.pet.needs,
    attributes: result.pet.hero.attributes,
    equipment: result.pet.hero.equipment,
    equipmentSummary: formatEquipmentSummary(result.pet),
    aptitude: result.pet.hero.classProgress.aptitude,
    events: result.events.slice(-5),
    adventures: result.pet.hero.adventureLog.slice(-3)
  };

  if (hasFlag('report')) payload.report = formatAdventureReport(result).join('\n');
  console.log(JSON.stringify(payload, null, 2));
}

async function mutate(id: string, action: 'feed' | 'play' | 'clean'): Promise<void> {
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  let actionText = '';
  if (action === 'feed') actionText = feedPet(result.pet);
  if (action === 'play') actionText = playWithPet(result.pet);
  if (action === 'clean') actionText = cleanPet(result.pet);
  await savePet(result.pet);
  const rendered = await renderStatusCard({ pet: result.pet, summary: actionText });
  console.log(JSON.stringify({
    id: result.pet.id,
    action,
    heroClass: result.pet.hero.classProgress.current,
    summary: actionText,
    imagePath: rendered.outputPath,
    needs: result.pet.needs,
    attributes: result.pet.hero.attributes,
    equipment: result.pet.hero.equipment,
    equipmentSummary: formatEquipmentSummary(result.pet),
    level: result.pet.hero.level,
    exp: result.pet.hero.exp,
    expToNext: result.pet.hero.expToNext
  }, null, 2));
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
  const rendered = await renderStatusCard({ pet, summary: `${pet.name}成為新的寵物勇者。` });
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

async function dungeonPreview(id: string): Promise<void> {
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
    currentDungeon: previewPet.hero.dungeon.currentDungeon ?? null,
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

async function combatPreview(id: string): Promise<void> {
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

async function printInventory(id: string): Promise<void> {
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  await savePet(result.pet);
  console.log(JSON.stringify({
    id: result.pet.id,
    heroClass: result.pet.hero.classProgress.current,
    gold: result.pet.hero.gold,
    equipmentSummary: formatEquipmentSummary(result.pet),
    inventory: result.pet.hero.equipment.inventory,
    inventoryLines: listInventory(result.pet)
  }, null, 2));
}

async function equipInventoryItem(id: string, itemId: string): Promise<void> {
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  const summary = equipItemById(result.pet, itemId);
  await savePet(result.pet);
  console.log(JSON.stringify({
    id: result.pet.id,
    summary,
    equippedItem: describeItem(result.pet.hero.equipment.inventory.find((item) => item.id === itemId)!),
    equipment: result.pet.hero.equipment,
    equipmentSummary: formatEquipmentSummary(result.pet),
    gold: result.pet.hero.gold
  }, null, 2));
}

async function sellInventoryItem(id: string, itemId: string): Promise<void> {
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  const summary = sellItemById(result.pet, itemId);
  await savePet(result.pet);
  console.log(JSON.stringify({
    id: result.pet.id,
    summary,
    gold: result.pet.hero.gold,
    equipment: result.pet.hero.equipment,
    equipmentSummary: formatEquipmentSummary(result.pet),
    inventoryLines: listInventory(result.pet)
  }, null, 2));
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (!cmd || cmd === 'help') {
    console.log(`my-pet-hero commands:\n  create --name NAME --species elf|dwarf|human|orc|dragon [--class berserker|rogue|mage]\n  status --id PET_ID [--report]\n  inventory --id PET_ID\n  equip --id PET_ID --item ITEM_ID\n  sell --id PET_ID --item ITEM_ID\n  classes\n  skills\n  enemies\n  combat-preview --id PET_ID [--floor N]\n  dungeon-preview --id PET_ID [--floor N] [--at ISO] [--repeat N] [--force-ready]\n  feed --id PET_ID\n  play --id PET_ID\n  clean --id PET_ID`);
    return;
  }

  if (cmd === 'create') return create();
  if (cmd === 'classes') return printClasses();
  if (cmd === 'inventory') {
    const id = getArg('id');
    if (!id) throw new Error('inventory 需要 --id');
    return printInventory(id);
  }
  if (cmd === 'skills') return printSkills();
  if (cmd === 'enemies') return printEnemies();
  if (cmd === 'combat-preview') {
    const id = getArg('id');
    if (!id) throw new Error('combat-preview 需要 --id');
    return combatPreview(id);
  }
  if (cmd === 'dungeon-preview') {
    const id = getArg('id');
    if (!id) throw new Error('dungeon-preview 需要 --id');
    return dungeonPreview(id);
  }
  if (cmd === 'equip') {
    const id = getArg('id');
    const itemId = getArg('item');
    if (!id || !itemId) throw new Error('equip 需要 --id 與 --item');
    return equipInventoryItem(id, itemId);
  }
  if (cmd === 'sell') {
    const id = getArg('id');
    const itemId = getArg('item');
    if (!id || !itemId) throw new Error('sell 需要 --id 與 --item');
    return sellInventoryItem(id, itemId);
  }
  const id = getArg('id');
  if (!id) throw new Error(`${cmd} 需要 --id`);
  if (cmd === 'status') return printStatus(id);
  if (cmd === 'feed' || cmd === 'play' || cmd === 'clean') return mutate(id, cmd);
  throw new Error(`未知指令: ${cmd}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
