#!/usr/bin/env node
import { createPet, loadPet, savePet } from './state.js';
import { simulatePet } from './simulate.js';
import { renderStatusCard } from './render.js';
import { feedPet, playWithPet, cleanPet } from './actions.js';
import { SPECIES_LIST } from './species.js';
import { CLASS_LIST, recommendClass } from './classes.js';
import { HeroClass, Species } from './types.js';
import { runCombat, ENEMIES } from './combat.js';

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'pet';
}

async function printStatus(id: string): Promise<void> {
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  await savePet(result.pet);
  const rendered = await renderStatusCard({ pet: result.pet, summary: result.summary });
  console.log(JSON.stringify({
    id: result.pet.id,
    name: result.pet.name,
    species: result.pet.species,
    heroClass: result.pet.hero.classProgress.current,
    classUnlocked: result.pet.hero.classProgress.unlocked,
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
  }, null, 2));
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

async function combatPreview(id: string): Promise<void> {
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  const floor = Number(getArg('floor') ?? result.pet.hero.dungeon.floor + 1);
  const combat = runCombat(result.pet, floor, new Date().toISOString());
  console.log(JSON.stringify({
    id: result.pet.id,
    floor,
    heroClass: result.pet.hero.classProgress.current,
    enemy: combat.enemy.label,
    outcome: combat.outcome,
    rounds: combat.rounds,
    expGained: combat.expGained,
    goldGained: combat.goldGained,
    healthLoss: combat.healthLoss,
    text: combat.text,
    turns: combat.turns
  }, null, 2));
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (!cmd || cmd === 'help') {
    console.log(`my-pet-hero commands:\n  create --name NAME --species elf|dwarf|human|orc|dragon [--class berserker|rogue|mage]\n  status --id PET_ID\n  classes\n  enemies\n  combat-preview --id PET_ID [--floor N]\n  feed --id PET_ID\n  play --id PET_ID\n  clean --id PET_ID`);
    return;
  }

  if (cmd === 'create') return create();
  if (cmd === 'classes') return printClasses();
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
