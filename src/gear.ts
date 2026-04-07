import { HeroClass, PetState } from './types.js';
import { CLASSES } from './classes.js';
import { clamp, hashToUnit, pickOne } from './utils.js';

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'accessory'] as const;

const SLOT_LABELS = {
  weapon: '武器',
  armor: '防具',
  accessory: '飾品'
} as const;

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic'] as const;

const RARITY_LABEL = {
  common: '普通',
  uncommon: '優秀',
  rare: '稀有',
  epic: '史詩'
} as const;

const SLOT_PREFIX = {
  weapon: ['碎石', '蒼火', '晨霧', '秘銀', '逐風'],
  armor: ['守望', '灰岩', '靜森', '鐵壁', '旅者'],
  accessory: ['星砂', '月影', '琥珀', '祕紋', '回聲']
} as const;

const CLASS_WEAPONS: Record<HeroClass, string[]> = {
  berserker: ['戰斧', '重劍', '戰錘'],
  rogue: ['短刃', '影匕', '迅劍'],
  mage: ['法杖', '符文杖', '奧術枝']
};

const CLASS_ARMORS: Record<HeroClass, string[]> = {
  berserker: ['鎖甲', '重胸甲', '鋼骨護甲'],
  rogue: ['皮甲', '影紋背心', '獵行護衣'],
  mage: ['法袍', '祕術長衣', '星輝披風']
};

const CLASS_ACCESSORIES: Record<HeroClass, string[]> = {
  berserker: ['鬥士墜飾', '戰魂戒', '赤銅護符'],
  rogue: ['潛影戒', '幸運墜鏈', '迅羽別針'],
  mage: ['法印墜飾', '星火戒', '祕銀護符']
};

function rarityFromSeed(seed: string): 'common' | 'uncommon' | 'rare' | 'epic' {
  const roll = hashToUnit(seed);
  if (roll > 0.97) return 'epic';
  if (roll > 0.82) return 'rare';
  if (roll > 0.55) return 'uncommon';
  return 'common';
}

function rarityMultiplier(rarity: 'common' | 'uncommon' | 'rare' | 'epic'): number {
  switch (rarity) {
    case 'epic': return 2.2;
    case 'rare': return 1.7;
    case 'uncommon': return 1.3;
    default: return 1;
  }
}

function newId(seed: string): string {
  return `gear-${Math.round(hashToUnit(seed) * 1_000_000_000)}`;
}

export function computeEquipmentBonuses(pet: PetState) {
  const items = Object.values(pet.hero.equipment.equipped).filter(Boolean);
  return items.reduce((acc, item) => {
    if (!item) return acc;
    acc.maxHealth += item.bonuses.maxHealth ?? 0;
    acc.attack += item.bonuses.attack ?? 0;
    acc.magicAttack += item.bonuses.magicAttack ?? 0;
    acc.defense += item.bonuses.defense ?? 0;
    acc.magicDefense += item.bonuses.magicDefense ?? 0;
    acc.accuracy += item.bonuses.accuracy ?? 0;
    acc.evasion += item.bonuses.evasion ?? 0;
    acc.crit += item.bonuses.crit ?? 0;
    return acc;
  }, {
    maxHealth: 0,
    attack: 0,
    magicAttack: 0,
    defense: 0,
    magicDefense: 0,
    accuracy: 0,
    evasion: 0,
    crit: 0
  });
}

export function gearScore(item: NonNullable<PetState['hero']['equipment']['inventory'][number]>): number {
  return (item.bonuses.maxHealth ?? 0) * 0.7
    + (item.bonuses.attack ?? 0) * 1.1
    + (item.bonuses.magicAttack ?? 0) * 1.1
    + (item.bonuses.defense ?? 0) * 1
    + (item.bonuses.magicDefense ?? 0) * 1
    + (item.bonuses.accuracy ?? 0) * 35
    + (item.bonuses.evasion ?? 0) * 35
    + (item.bonuses.crit ?? 0) * 45;
}

export function maybeGenerateLoot(pet: PetState, floor: number, at: string, roomType?: string) {
  const chanceBase = roomType === 'boss' ? 0.95 : roomType === 'elite' ? 0.68 : roomType === 'treasure' ? 0.76 : 0.42;
  if (hashToUnit(`${pet.seed}:loot-drop:${at}:${floor}:${roomType ?? 'room'}`) > chanceBase) return null;

  const slot = pickOne([...EQUIPMENT_SLOTS], hashToUnit(`${pet.seed}:loot-slot:${at}:${floor}`));
  const rarity = rarityFromSeed(`${pet.seed}:loot-rarity:${at}:${floor}:${slot}`);
  const mult = rarityMultiplier(rarity);
  const heroClass = pet.hero.classProgress.current;
  const baseValue = Math.max(1, Math.round((floor + pet.hero.level) * mult));

  const names = slot === 'weapon' ? CLASS_WEAPONS[heroClass] : slot === 'armor' ? CLASS_ARMORS[heroClass] : CLASS_ACCESSORIES[heroClass];
  const prefix = pickOne([...SLOT_PREFIX[slot]], hashToUnit(`${pet.seed}:loot-prefix:${at}:${slot}`));
  const noun = pickOne([...names], hashToUnit(`${pet.seed}:loot-name:${at}:${slot}`));

  const bonuses = slot === 'weapon'
    ? heroClass === 'mage'
      ? { magicAttack: 4 + baseValue, accuracy: Number((0.01 * mult).toFixed(3)) }
      : { attack: 4 + baseValue, crit: Number((0.008 * mult).toFixed(3)) }
    : slot === 'armor'
      ? { maxHealth: 5 + baseValue * 2, defense: 2 + Math.round(baseValue * 0.7), magicDefense: heroClass === 'mage' ? 2 + Math.round(baseValue * 0.6) : 1 + Math.round(baseValue * 0.35) }
      : heroClass === 'rogue'
        ? { evasion: Number((0.012 * mult).toFixed(3)), crit: Number((0.01 * mult).toFixed(3)), attack: 1 + Math.round(baseValue * 0.3) }
        : heroClass === 'mage'
          ? { magicAttack: 2 + Math.round(baseValue * 0.7), magicDefense: 1 + Math.round(baseValue * 0.4), accuracy: Number((0.008 * mult).toFixed(3)) }
          : { attack: 1 + Math.round(baseValue * 0.4), defense: 1 + Math.round(baseValue * 0.5), maxHealth: 4 + baseValue };

  return {
    id: newId(`${pet.seed}:${at}:${slot}:${rarity}:${floor}`),
    name: `${RARITY_LABEL[rarity]}${prefix}${noun}`,
    slot,
    rarity,
    itemLevel: floor,
    heroClass,
    bonuses,
    source: `${roomType ?? 'room'} floor ${floor}`
  };
}

export function autoEquipLoot(pet: PetState, item: NonNullable<PetState['hero']['equipment']['inventory'][number]>) {
  pet.hero.equipment.inventory.push(item);
  pet.hero.equipment.inventory = pet.hero.equipment.inventory.slice(-40);

  const current = pet.hero.equipment.equipped[item.slot];
  if (!current || gearScore(item) > gearScore(current)) {
    pet.hero.equipment.equipped[item.slot] = item;
    pet.hero.equipment.lastEquippedAt = new Date().toISOString();
    pet.needs.mood = clamp(pet.needs.mood + 3);
    return `換上了新${SLOT_LABELS[item.slot]}「${item.name}」`;
  }
  return `撿到${SLOT_LABELS[item.slot]}「${item.name}」，先收進背包。`;
}

export function formatEquipmentSummary(pet: PetState): string[] {
  return EQUIPMENT_SLOTS.map((slot) => {
    const item = pet.hero.equipment.equipped[slot];
    return `${SLOT_LABELS[slot]}：${item ? item.name : '無'}`;
  });
}
