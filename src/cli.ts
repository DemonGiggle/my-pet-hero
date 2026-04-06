#!/usr/bin/env node
import { createPet, loadPet, savePet } from './state.js';
import { simulatePet } from './simulate.js';
import { renderStatusCard } from './render.js';
import { feedPet, playWithPet, cleanPet } from './actions.js';
import { SPECIES_LIST } from './species.js';
import { CLASS_LIST, recommendClass } from './classes.js';
import { HeroClass, Species } from './types.js';
import { runCombat, ENEMIES } from './combat.js';
import { SKILLS } from './skills.js';

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

function formatAdventureReport(result: ReturnType<typeof simulatePet>): string[] {
  const adventures = result.pet.hero.adventureLog.slice(-3).reverse();
  if (adventures.length === 0) {
    return ['最近還沒有冒險紀錄。'];
  }

  const lines: string[] = [];
  lines.push(`狀態：Lv${result.pet.hero.level} ${result.pet.species} ${result.pet.hero.classProgress.current}，${result.moodLabel}，目前在迷宮 ${result.pet.hero.dungeon.floor} 層。`);
  lines.push('最近冒險：');

  for (const item of adventures) {
    const base = `- Floor ${item.floor} / ${item.outcome} / EXP +${item.expGained} / Gold +${item.goldGained}`;
    lines.push(base);
    lines.push(`  ${item.text}`);

    if (item.combat) {
      lines.push(`  戰鬥：對上 ${item.combat.enemy.label}，${item.combat.rounds} 回合，結果 ${item.combat.outcome}`);
      if (item.combat.skillsUsed.length > 0) {
        const skillNames = item.combat.skillsUsed.map(skill => skill.skillLabel).join('、');
        lines.push(`  技能：${skillNames}`);
      }
      const turnTexts = item.combat.turns.slice(0, 3).map(turn => turn.text).join(' / ');
      if (turnTexts) {
        lines.push(`  細節：${turnTexts}`);
      }
    }
  }

  return lines;
}

async function printStatus(id: string): Promise<void> {
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  await savePet(result.pet);
  const rendered = await renderStatusCard({ pet: result.pet, summary: result.summary });

  const payload: Record<string, unknown> = {
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
    summary: result.summary,
    mood: result.moodLabel,
    stage: result.stageLabel,
    imagePath: rendered.outputPath,
    needs: result.pet.needs,
    attributes: result.pet.hero.attributes,
    aptitude: result.pet.hero.classProgress.aptitude,
    events: result.events.slice(-5),
    adventures: result.pet.hero.adventureLog.slice(-3)
  };

  if (hasFlag('report')) {
    payload.report = formatAdventureReport(result).join('\n');
  }

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

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (!cmd || cmd === 'help') {
    console.log(`my-pet-hero commands:\n  create --name NAME --species elf|dwarf|human|orc|dragon [--class berserker|rogue|mage]\n  status --id PET_ID [--report]\n  classes\n  skills\n  enemies\n  combat-preview --id PET_ID [--floor N]\n  feed --id PET_ID\n  play --id PET_ID\n  clean --id PET_ID`);
    return;
  }

  if (cmd === 'create') return create();
  if (cmd === 'classes') return printClasses();
  if (cmd === 'skills') return printSkills();
  if (cmd === 'enemies') return printEnemies();
  if (cmd === 'combat-preview') {
    const id = getArg('id');
    if (!id) throw new Error('combat-preview 需要 --id');
    return combatPreview(id);
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
