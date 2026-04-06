import { PetState, Attributes, AdventureLog } from './types.js';
import { CLASSES, getClassAffinity } from './classes.js';
import { clamp, expToNextLevel, hashToUnit } from './utils.js';

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
  const power = pet.hero.attributes.strength * 1.15
    + pet.hero.attributes.agility * (1 + heroClass.attackSpeedModifier)
    + pet.hero.attributes.intelligence * (heroClass.key === 'mage' ? 1.45 : 1)
    + pet.hero.attributes.vitality * 1.12
    + pet.hero.level * 3
    + affinity * 3;
  const difficulty = 14 + floor * 4 + hashToUnit(`${pet.seed}:dungeon:diff:${at}`) * 10;
  let outcome: AdventureLog['outcome'] = 'win';
  if (power + hashToUnit(`${pet.seed}:dungeon:combat:${at}`) * 18 < difficulty) outcome = 'escape';
  else if (hashToUnit(`${pet.seed}:dungeon:treasure:${at}`) > 0.82 || heroClass.abilities.includes('lockpicking')) outcome = 'treasure';

  const exp = Math.round((outcome === 'win' ? 10 + floor * 4 : outcome === 'treasure' ? 8 + floor * 3 : 4 + floor * 2) * affinity);
  const gold = outcome === 'treasure' ? 12 + floor * 5 : outcome === 'win' ? 6 + floor * 2 : 2 + floor;

  pet.needs.energy = clamp(pet.needs.energy - (10 + floor * 1.5 - heroClass.moveSpeedModifier * 5));
  pet.needs.hunger = clamp(pet.needs.hunger + (8 + floor));
  pet.needs.thirst = clamp(pet.needs.thirst + (10 + floor));
  pet.needs.mood = clamp(pet.needs.mood + (outcome === 'escape' ? -4 : 6));
  pet.needs.health = clamp(pet.needs.health - (outcome === 'escape' ? 8 : 2) + heroClass.physicalResistance * 6 + heroClass.controlResistance * 2);
  pet.hero.gold += gold;
  gainExp(pet, exp);
  pet.hero.dungeon.floor = outcome === 'escape' ? Math.max(1, floor - 1) : floor;
  pet.hero.dungeon.deepestFloor = Math.max(pet.hero.dungeon.deepestFloor, floor);
  pet.hero.dungeon.runs += 1;

  const text =
    outcome === 'treasure'
      ? `${heroClass.label}型態發揮效果，闖到迷宮 ${floor} 層並帶回寶物。`
      : outcome === 'win'
        ? `${heroClass.label}風格順利發揮，闖過迷宮 ${floor} 層。`
        : `在迷宮 ${floor} 層感覺不妙，及時撤退。`;

  const log: AdventureLog = { at, floor, outcome, text, expGained: exp, goldGained: gold };
  pet.hero.adventureLog = [...pet.hero.adventureLog, log].slice(-20);
  return log;
}
