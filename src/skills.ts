import { HeroClass, SkillDefinition } from './types.js';

export const SKILLS: Record<HeroClass, SkillDefinition[]> = {
  berserker: [
    {
      key: 'crushing-slam',
      heroClass: 'berserker',
      label: '粉碎重擊',
      description: '用重武器狠狠砸下去，吃力量倍率。',
      target: 'enemy',
      effectKind: 'damage',
      damageType: 'physical',
      powerMultiplier: 1.75,
      hitBonus: 0.08,
      cooldownTurns: 3
    },
    {
      key: 'iron-bulwark',
      heroClass: 'berserker',
      label: '鋼鐵姿態',
      description: '進入扛線姿態，暫時獲得護盾。',
      target: 'self',
      effectKind: 'shield',
      shieldMultiplier: 1.2,
      cooldownTurns: 4
    }
  ],
  rogue: [
    {
      key: 'shadow-strike',
      heroClass: 'rogue',
      label: '影襲',
      description: '高命中高爆率的一擊。',
      target: 'enemy',
      effectKind: 'damage',
      damageType: 'physical',
      powerMultiplier: 1.45,
      hitBonus: 0.12,
      critBonus: 0.2,
      cooldownTurns: 2
    },
    {
      key: 'evasive-step',
      heroClass: 'rogue',
      label: '閃步',
      description: '快速換位，獲得短暫護盾。',
      target: 'self',
      effectKind: 'shield',
      shieldMultiplier: 0.9,
      cooldownTurns: 3
    }
  ],
  mage: [
    {
      key: 'arcane-burst',
      heroClass: 'mage',
      label: '奧術爆裂',
      description: '高倍率魔法傷害。',
      target: 'enemy',
      effectKind: 'damage',
      damageType: 'magic',
      powerMultiplier: 1.85,
      hitBonus: 0.06,
      cooldownTurns: 3
    },
    {
      key: 'mystic-feast',
      heroClass: 'mage',
      label: '祕術饗宴',
      description: '生成魔法食物，回復生命。',
      target: 'self',
      effectKind: 'heal',
      healMultiplier: 1.1,
      cooldownTurns: 4
    }
  ]
};

export function getSkillsForClass(heroClass: HeroClass): SkillDefinition[] {
  return SKILLS[heroClass] ?? [];
}
