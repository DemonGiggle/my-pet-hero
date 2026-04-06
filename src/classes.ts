import { ClassConfig, HeroClass, Species, Attributes } from './types.js';

export const CLASSES: Record<HeroClass, ClassConfig> = {
  berserker: {
    key: 'berserker',
    label: '狂戰士',
    description: '重武器前線戰士，血厚、硬、衝得兇，但面對魔法時比較吃虧。',
    favoredSpecies: ['dwarf', 'human'],
    baseAttributeBias: { strength: 4, vitality: 4, agility: -2, intelligence: -1 },
    speciesAttributeBonus: {
      dwarf: { vitality: 2, strength: 1 },
      human: { strength: 1, vitality: 1, luck: 1 }
    },
    healthModifier: 18,
    physicalResistance: 0.22,
    magicResistance: -0.18,
    controlResistance: 0.35,
    moveSpeedModifier: -0.08,
    attackSpeedModifier: -0.12,
    preferredArmor: ['mail', 'plate'],
    weaponTags: ['two-handed', 'axe', 'sword', 'mace'],
    abilities: ['physical-resistance', 'magic-vulnerability', 'anti-knockdown', 'anti-restrain'],
    gameplayNotes: [
      '可使用雙手武器與多數近戰武器。',
      '血量厚，對物理傷害有抗性，但較怕魔法。',
      '不容易受到絆倒、擊退或限制行動影響。'
    ]
  },
  rogue: {
    key: 'rogue',
    label: '盜賊',
    description: '高機動近身職業，攻擊快、靈巧，善於陷阱與寶箱處理。',
    favoredSpecies: ['human', 'elf', 'dragon'],
    baseAttributeBias: { agility: 5, luck: 2, strength: 1, vitality: -1 },
    speciesAttributeBonus: {
      human: { agility: 1, luck: 1 },
      elf: { agility: 2, intelligence: 1 },
      dragon: { agility: 1, luck: 2 }
    },
    healthModifier: -4,
    physicalResistance: 0.04,
    magicResistance: 0.04,
    controlResistance: 0.08,
    moveSpeedModifier: 0.18,
    attackSpeedModifier: 0.28,
    preferredArmor: ['leather'],
    weaponTags: ['dagger', 'shortblade', 'dual-wield'],
    abilities: ['trap-detection', 'lockpicking', 'stealth'],
    gameplayNotes: [
      '短刃與雙持能力出色。',
      '攻擊速度快，敏捷度高。',
      '可偵測陷阱、開鎖與潛行。'
    ]
  },
  mage: {
    key: 'mage',
    label: '法師',
    description: '以法杖與法術為核心，擅長元素、召喚與心靈控制。',
    favoredSpecies: ['dragon', 'elf'],
    baseAttributeBias: { intelligence: 6, luck: 1, vitality: -2, strength: -2 },
    speciesAttributeBonus: {
      dragon: { intelligence: 2, vitality: 1 },
      elf: { intelligence: 2, agility: 1 }
    },
    healthModifier: -10,
    physicalResistance: -0.08,
    magicResistance: 0.18,
    controlResistance: 0.12,
    moveSpeedModifier: 0,
    attackSpeedModifier: 0.1,
    preferredArmor: ['cloth'],
    weaponTags: ['staff'],
    abilities: ['magic-food', 'alchemy', 'town-portal', 'elemental-magic', 'summoning', 'mind-control'],
    gameplayNotes: [
      '可持法杖並施放高威力元素魔法。',
      '可製作魔法食物與藥水。',
      '可開啟城鎮傳送門，並使用召喚與心控系法術。'
    ]
  }
};

export const CLASS_LIST = Object.values(CLASSES);

function attributeSum(partial: Partial<Attributes> | undefined): number {
  if (!partial) return 0;
  return (partial.strength ?? 0)
    + (partial.agility ?? 0)
    + (partial.intelligence ?? 0)
    + (partial.vitality ?? 0)
    + (partial.luck ?? 0);
}

export function getClassAffinity(heroClass: HeroClass, species: Species): number {
  const config = CLASSES[heroClass];
  const favored = config.favoredSpecies.includes(species) ? 0.12 : 0;
  const speciesBonus = attributeSum(config.speciesAttributeBonus[species]);
  const baseBonus = attributeSum(config.baseAttributeBias) * 0.01;
  return 1 + favored + speciesBonus * 0.025 + baseBonus;
}

export function applyClassAttributeBonus(
  species: Species,
  heroClass: HeroClass,
  base: Attributes
): Attributes {
  const config = CLASSES[heroClass];
  const speciesBonus = config.speciesAttributeBonus[species] ?? {};
  return {
    strength: base.strength + (config.baseAttributeBias.strength ?? 0) + (speciesBonus.strength ?? 0),
    agility: base.agility + (config.baseAttributeBias.agility ?? 0) + (speciesBonus.agility ?? 0),
    intelligence: base.intelligence + (config.baseAttributeBias.intelligence ?? 0) + (speciesBonus.intelligence ?? 0),
    vitality: base.vitality + (config.baseAttributeBias.vitality ?? 0) + (speciesBonus.vitality ?? 0),
    luck: base.luck + (config.baseAttributeBias.luck ?? 0) + (speciesBonus.luck ?? 0)
  };
}

export function recommendClass(species: Species): HeroClass {
  const priority: HeroClass[] = ['berserker', 'rogue', 'mage'];
  return priority
    .map((key) => ({ key, score: getClassAffinity(key, species) }))
    .sort((a, b) => b.score - a.score)[0].key;
}
