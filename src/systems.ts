import { PetState, Attributes, AdventureLog } from './types.js';
import { CLASSES, getClassAffinity } from './classes.js';
import { clamp, expToNextLevel, hashToUnit } from './utils.js';
import { runCombat } from './combat.js';

export function autoRecoverNeeds(pet: PetState, at: string): string[] {
  const notes: string[] = [];
  if (pet.needs.hunger >= 72) {
    pet.needs.hunger = clamp(pet.needs.hunger - 18);
    pet.needs.energy = clamp(pet.needs.energy - 4);
    pet.needs.mood = clamp(pet.needs.mood + 2);
    notes.push('自己去找了點食物吃。');
  }
  if (pet.needs.thirst >= 70) {
    pet.needs.thirst = clamp(pet.needs.thirst - 22);
    pet.needs.mood = clamp(pet.needs.mood + 1);
    notes.push('自己找到水喝，沒有渴太久。');
  }
  if (notes.length > 0) {
    pet.history.push({ at, type: 'self-care', delta: { hunger: -18, thirst: -22, mood: 3, energy: -4 }, text: notes.join('') });
    pet.history = pet.history.slice(-30);
  }
  return notes;
}

export function gainExp(pet: PetState, amount: number): string[] {
  const notes: string[] = [];
  pet.hero.exp += amount;
  while (pet.hero.exp >= pet.hero.expToNext) {
    pet.hero.exp -= pet.hero.expToNext;
    pet.hero.level += 1;
    pet.hero.statPoints += 3;
    pet.hero.expToNext = expToNextLevel(pet.hero.level);
    pet.hero.attributes = applyAutoStatGrowth(pet.hero.attributes, pet.hero.level);
    notes.push(`升到 Lv.${pet.hero.level}`);
  }
  return notes;
}

export function applyAutoStatGrowth(attributes: Attributes, level: number): Attributes {
  return {
    strength: attributes.strength + (level % 2 === 0 ? 1 : 0),
    agility: attributes.agility + 1,
    intelligence: attributes.intelligence + (level % 3 === 0 ? 1 : 0),
    vitality: attributes.vitality + 1,
    luck: attributes.luck + (level % 4 === 0 ? 1 : 0)
  };
}

export function autoDungeonRun(pet: PetState, at: string): AdventureLog | null {
  if (pet.needs.energy < 35 || pet.needs.health < 35) return null;
  const heroClass = CLASSES[pet.hero.classProgress.current];
  const affinity = getClassAffinity(pet.hero.classProgress.current, pet.species);
  const urge = pet.personality.curiosity * 0.5 + pet.personality.playfulness * 0.2 + pet.hero.level * 0.03;
  const roll = hashToUnit(`${pet.seed}:dungeon:${at}`);
  if (roll > Math.min(0.28 + urge, 0.72)) return null;

  const floor = Math.max(1, pet.hero.dungeon.floor + 1);
  const treasureBias = heroClass.abilities.includes('lockpicking') ? 0.12 : 0;
  const treasureRoll = hashToUnit(`${pet.seed}:dungeon:treasure:${at}`);

  let outcome: AdventureLog['outcome'];
  let exp = 0;
  let gold = 0;
  let text = '';
  let combat;

  if (treasureRoll > 0.9 - treasureBias) {
    outcome = 'treasure';
    exp = Math.round((8 + floor * 3) * affinity);
    gold = 14 + floor * 5;
    pet.needs.energy = clamp(pet.needs.energy - (8 + floor));
    pet.needs.hunger = clamp(pet.needs.hunger + (6 + floor));
    pet.needs.thirst = clamp(pet.needs.thirst + (7 + floor));
    pet.needs.mood = clamp(pet.needs.mood + 8);
    pet.needs.health = clamp(pet.needs.health - 1);
    text = `${heroClass.label}型態發揮效果，在迷宮 ${floor} 層撬開寶箱帶回戰利品。`;
  } else {
    combat = runCombat(pet, floor, at);
    outcome = combat.outcome;
    exp = Math.round(combat.expGained * affinity);
    gold = combat.goldGained;
    const healthPercentLoss = (combat.healthLoss / Math.max(1, combat.hero.maxHealth)) * 100;
    pet.needs.health = clamp(pet.needs.health - healthPercentLoss);
    pet.needs.energy = clamp(pet.needs.energy - (10 + floor * 1.6));
    pet.needs.hunger = clamp(pet.needs.hunger + (8 + floor));
    pet.needs.thirst = clamp(pet.needs.thirst + (10 + floor));
    pet.needs.mood = clamp(pet.needs.mood + combat.moodDelta);
    text = combat.text;
  }

  pet.hero.gold += gold;
  gainExp(pet, exp);

  if (outcome === 'win' || outcome === 'treasure') {
    pet.hero.dungeon.floor = floor;
  } else if (outcome === 'defeat') {
    pet.hero.dungeon.floor = Math.max(1, floor - 1);
  } else {
    pet.hero.dungeon.floor = Math.max(1, floor - 1);
  }

  pet.hero.dungeon.deepestFloor = Math.max(pet.hero.dungeon.deepestFloor, floor);
  pet.hero.dungeon.runs += 1;

  const log: AdventureLog = { at, floor, outcome, text, expGained: exp, goldGained: gold, combat };
  pet.hero.adventureLog = [...pet.hero.adventureLog, log].slice(-20);
  return log;
}
