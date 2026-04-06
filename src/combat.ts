import { CLASSES, getClassAffinity } from './classes.js';
import { getSkillsForClass } from './skills.js';
import {
  CombatResult,
  CombatTurnLog,
  CombatantSnapshot,
  DamageType,
  EnemyTemplate,
  PetState,
  SkillDefinition,
  SkillUseLog
} from './types.js';
import { clamp, hashToUnit } from './utils.js';

export const ENEMIES: EnemyTemplate[] = [
  {
    key: 'slime',
    label: '史萊姆',
    floorRange: [1, 3],
    damageTypeBias: 'physical',
    baseHealth: 20,
    baseAttack: 8,
    baseDefense: 4,
    baseAccuracy: 0.78,
    baseEvasion: 0.04,
    baseCrit: 0.03,
    aggression: 0.5,
    expReward: 7,
    goldReward: 4
  },
  {
    key: 'goblin-scout',
    label: '哥布林斥候',
    floorRange: [1, 5],
    damageTypeBias: 'physical',
    baseHealth: 24,
    baseAttack: 10,
    baseDefense: 5,
    baseAccuracy: 0.82,
    baseEvasion: 0.1,
    baseCrit: 0.06,
    aggression: 0.72,
    expReward: 9,
    goldReward: 6,
    abilities: ['ambush']
  },
  {
    key: 'skeletal-guard',
    label: '骷髏守衛',
    floorRange: [2, 6],
    damageTypeBias: 'physical',
    baseHealth: 32,
    baseAttack: 12,
    baseDefense: 8,
    baseAccuracy: 0.76,
    baseEvasion: 0.05,
    baseCrit: 0.05,
    aggression: 0.68,
    expReward: 12,
    goldReward: 7
  },
  {
    key: 'void-apprentice',
    label: '虛空學徒',
    floorRange: [3, 8],
    damageTypeBias: 'magic',
    baseHealth: 28,
    baseAttack: 13,
    baseDefense: 5,
    baseAccuracy: 0.79,
    baseEvasion: 0.08,
    baseCrit: 0.09,
    aggression: 0.75,
    expReward: 14,
    goldReward: 10,
    abilities: ['spell-burst']
  },
  {
    key: 'cave-drake',
    label: '洞窟幼龍',
    floorRange: [5, 10],
    damageTypeBias: 'physical',
    baseHealth: 44,
    baseAttack: 16,
    baseDefense: 10,
    baseAccuracy: 0.81,
    baseEvasion: 0.09,
    baseCrit: 0.1,
    aggression: 0.82,
    expReward: 20,
    goldReward: 15,
    abilities: ['fear']
  }
];

function chooseEnemy(floor: number, seed: string): EnemyTemplate {
  const candidates = ENEMIES.filter((enemy) => floor >= enemy.floorRange[0] && floor <= enemy.floorRange[1]);
  const pool = candidates.length > 0 ? candidates : ENEMIES;
  const idx = Math.min(pool.length - 1, Math.floor(hashToUnit(seed) * pool.length));
  return pool[idx];
}

function buildHeroSnapshot(pet: PetState): CombatantSnapshot {
  const heroClass = CLASSES[pet.hero.classProgress.current];
  const affinity = getClassAffinity(pet.hero.classProgress.current, pet.species);
  const maxHealth = Math.round(54 + pet.hero.attributes.vitality * 4 + pet.hero.level * 5 + heroClass.healthModifier);
  return {
    name: pet.name,
    maxHealth,
    health: Math.round(maxHealth * (pet.needs.health / 100)),
    attack: Math.round(pet.hero.attributes.strength * 2.1 + pet.hero.level * 2 + affinity * 3),
    magicAttack: Math.round(pet.hero.attributes.intelligence * 2.4 + pet.hero.level * 2 + affinity * 3),
    defense: Math.round(pet.hero.attributes.vitality * 1.6 + pet.hero.level + heroClass.physicalResistance * 14),
    magicDefense: Math.round(pet.hero.attributes.intelligence * 1.25 + pet.hero.level + heroClass.magicResistance * 14),
    accuracy: clamp(0.74 + pet.hero.attributes.agility * 0.012 + pet.hero.attributes.luck * 0.004 + heroClass.attackSpeedModifier * 0.1, 0.55, 0.97),
    evasion: clamp(0.05 + pet.hero.attributes.agility * 0.008 + heroClass.moveSpeedModifier * 0.15, 0.02, 0.35),
    crit: clamp(0.04 + pet.hero.attributes.luck * 0.006 + heroClass.attackSpeedModifier * 0.04, 0.03, 0.35),
    damageTypeBias: pet.hero.classProgress.current === 'mage' ? 'magic' : 'physical',
    shield: 0
  };
}

function buildEnemySnapshot(enemy: EnemyTemplate, floor: number): CombatantSnapshot {
  const scale = 1 + (floor - 1) * 0.16;
  const maxHealth = Math.round(enemy.baseHealth * scale);
  return {
    name: enemy.label,
    maxHealth,
    health: maxHealth,
    attack: Math.round(enemy.baseAttack * scale),
    magicAttack: Math.round((enemy.baseAttack + (enemy.damageTypeBias === 'magic' ? 4 : 0)) * scale),
    defense: Math.round(enemy.baseDefense * scale),
    magicDefense: Math.round((enemy.baseDefense + (enemy.damageTypeBias === 'magic' ? 2 : 0)) * scale),
    accuracy: clamp(enemy.baseAccuracy + floor * 0.005, 0.55, 0.95),
    evasion: clamp(enemy.baseEvasion + floor * 0.004, 0.02, 0.28),
    crit: clamp(enemy.baseCrit + floor * 0.003, 0.02, 0.22),
    damageTypeBias: enemy.damageTypeBias,
    shield: 0
  };
}

function applyDamage(target: CombatantSnapshot, damage: number): number {
  const absorbed = Math.min(target.shield, damage);
  target.shield = Math.max(0, target.shield - absorbed);
  const finalDamage = Math.max(0, damage - absorbed);
  target.health = Math.max(0, target.health - finalDamage);
  return finalDamage;
}

function rollAttack(
  actor: CombatantSnapshot,
  target: CombatantSnapshot,
  actorKind: 'hero' | 'enemy',
  round: number,
  seed: string,
  overrides?: Partial<{ damageType: DamageType; powerMultiplier: number; hitBonus: number; critBonus: number; }>
): CombatTurnLog {
  const hitRoll = hashToUnit(`${seed}:${actorKind}:hit:${round}`);
  const critRoll = hashToUnit(`${seed}:${actorKind}:crit:${round}`);
  const variance = 0.85 + hashToUnit(`${seed}:${actorKind}:var:${round}`) * 0.35;
  const damageType: DamageType = overrides?.damageType ?? actor.damageTypeBias;
  const hitChance = clamp(actor.accuracy + (overrides?.hitBonus ?? 0) - target.evasion + 0.08, 0.2, 0.99);

  if (hitRoll > hitChance) {
    return {
      round,
      actor: actorKind,
      result: 'miss',
      damageType,
      damage: 0,
      text: actorKind === 'hero' ? `${actor.name} 這一下揮空了。` : `${actor.name} 的攻擊落空。`
    };
  }

  const isCrit = critRoll < clamp(actor.crit + (overrides?.critBonus ?? 0), 0.03, 0.6);
  const attackStat = damageType === 'magic' ? actor.magicAttack : actor.attack;
  const defenseStat = damageType === 'magic' ? target.magicDefense : target.defense;
  const raw = Math.max(1, attackStat * variance * (overrides?.powerMultiplier ?? 1) - defenseStat * 0.72);
  const resolvedDamage = Math.max(1, Math.round(raw * (isCrit ? 1.65 : 1)));
  const damage = applyDamage(target, resolvedDamage);

  return {
    round,
    actor: actorKind,
    result: isCrit ? 'crit' : 'hit',
    damageType,
    damage,
    text: isCrit
      ? `${actor.name} 打出暴擊，造成 ${damage} 點${damageType === 'magic' ? '魔法' : '物理'}傷害。`
      : `${actor.name} 造成 ${damage} 點${damageType === 'magic' ? '魔法' : '物理'}傷害。`
  };
}

function shouldUseSkill(skill: SkillDefinition, hero: CombatantSnapshot, enemy: CombatantSnapshot, round: number, seed: string): boolean {
  const desire = hashToUnit(`${seed}:skill:${skill.key}:${round}`);
  if (skill.effectKind === 'heal') return hero.health / hero.maxHealth < 0.58 && desire > 0.28;
  if (skill.effectKind === 'shield') return hero.shield < 6 && enemy.health > 0 && desire > 0.35;
  return desire > 0.42;
}

function useSkill(
  skill: SkillDefinition,
  hero: CombatantSnapshot,
  enemy: CombatantSnapshot,
  round: number,
  seed: string
): CombatTurnLog {
  if (skill.effectKind === 'heal') {
    const heal = Math.max(4, Math.round(hero.magicAttack * (skill.healMultiplier ?? 1)));
    hero.health = Math.min(hero.maxHealth, hero.health + heal);
    const used: SkillUseLog = {
      round,
      actor: 'hero',
      skillKey: skill.key,
      skillLabel: skill.label,
      effectKind: 'heal',
      value: heal,
      text: `${hero.name} 使用 ${skill.label}，回復 ${heal} 生命。`
    };
    return {
      round,
      actor: 'hero',
      result: 'skill',
      damageType: hero.damageTypeBias,
      damage: 0,
      text: used.text,
      skill: used
    };
  }

  if (skill.effectKind === 'shield') {
    const shield = Math.max(4, Math.round((hero.defense + hero.magicDefense) * 0.5 * (skill.shieldMultiplier ?? 1)));
    hero.shield += shield;
    const used: SkillUseLog = {
      round,
      actor: 'hero',
      skillKey: skill.key,
      skillLabel: skill.label,
      effectKind: 'shield',
      value: shield,
      text: `${hero.name} 使用 ${skill.label}，獲得 ${shield} 點護盾。`
    };
    return {
      round,
      actor: 'hero',
      result: 'skill',
      damageType: hero.damageTypeBias,
      damage: 0,
      text: used.text,
      skill: used
    };
  }

  const attackTurn = rollAttack(hero, enemy, 'hero', round, `${seed}:${skill.key}`, {
    damageType: skill.damageType ?? hero.damageTypeBias,
    powerMultiplier: skill.powerMultiplier ?? 1,
    hitBonus: skill.hitBonus ?? 0,
    critBonus: skill.critBonus ?? 0
  });
  const used: SkillUseLog = {
    round,
    actor: 'hero',
    skillKey: skill.key,
    skillLabel: skill.label,
    effectKind: 'damage',
    damageType: attackTurn.damageType,
    value: attackTurn.damage,
    text: `${hero.name} 使用 ${skill.label}。${attackTurn.text}`
  };
  return {
    ...attackTurn,
    result: 'skill',
    text: used.text,
    skill: used
  };
}

export function runCombat(pet: PetState, floor: number, at: string): CombatResult {
  const enemy = chooseEnemy(floor, `${pet.seed}:enemy:${at}:${floor}`);
  const hero = buildHeroSnapshot(pet);
  const enemyState = buildEnemySnapshot(enemy, floor);
  const turns: CombatTurnLog[] = [];
  const skillsUsed: SkillUseLog[] = [];
  const maxRounds = 6;
  const skillCooldowns = new Map<string, number>();
  const heroSkills = getSkillsForClass(pet.hero.classProgress.current).filter((skill) => (skill.minLevel ?? 1) <= pet.hero.level);

  for (let round = 1; round <= maxRounds; round++) {
    let heroTurn: CombatTurnLog;
    const availableSkills = heroSkills.filter((skill) => (skillCooldowns.get(skill.key) ?? 0) <= round);
    const chosenSkill = availableSkills.find((skill) => shouldUseSkill(skill, hero, enemyState, round, `${pet.seed}:${at}:${enemy.key}`));

    if (chosenSkill) {
      heroTurn = useSkill(chosenSkill, hero, enemyState, round, `${pet.seed}:${at}:${enemy.key}`);
      skillCooldowns.set(chosenSkill.key, round + chosenSkill.cooldownTurns);
      if (heroTurn.skill) skillsUsed.push(heroTurn.skill);
    } else {
      heroTurn = rollAttack(hero, enemyState, 'hero', round, `${pet.seed}:${at}:${enemy.key}`);
    }

    turns.push(heroTurn);
    if (enemyState.health <= 0) {
      const expGained = enemy.expReward + floor * 2 + skillsUsed.length;
      const goldGained = enemy.goldReward + Math.max(0, Math.round(floor * 1.5));
      const healthLoss = hero.maxHealth - hero.health;
      return {
        outcome: 'win',
        enemy,
        hero,
        enemyState,
        rounds: round,
        turns,
        skillsUsed,
        expGained,
        goldGained,
        healthLoss,
        moodDelta: 7,
        text: `${pet.name} 打倒了 ${enemy.label}。`
      };
    }

    const enemyTurn = rollAttack(enemyState, hero, 'enemy', round, `${pet.seed}:${at}:${enemy.key}`);
    turns.push(enemyTurn);
    if (hero.health <= 0) {
      const healthLoss = hero.maxHealth;
      return {
        outcome: 'defeat',
        enemy,
        hero,
        enemyState,
        rounds: round,
        turns,
        skillsUsed,
        expGained: Math.max(1, Math.round(enemy.expReward * 0.35)),
        goldGained: 0,
        healthLoss,
        moodDelta: -12,
        text: `${pet.name} 被 ${enemy.label} 擊退了。`
      };
    }
  }

  const healthRatio = hero.health / hero.maxHealth;
  const outcome = healthRatio < 0.28 ? 'escape' : 'win';
  return {
    outcome,
    enemy,
    hero,
    enemyState,
    rounds: maxRounds,
    turns,
    skillsUsed,
    expGained: outcome === 'win' ? enemy.expReward + floor + skillsUsed.length : Math.max(2, Math.round(enemy.expReward * 0.5)),
    goldGained: outcome === 'win' ? enemy.goldReward + floor : Math.max(0, Math.round(enemy.goldReward * 0.35)),
    healthLoss: hero.maxHealth - hero.health,
    moodDelta: outcome === 'win' ? 5 : -3,
    text: outcome === 'win'
      ? `${pet.name} 和 ${enemy.label} 纏鬥後取得勝利。`
      : `${pet.name} 和 ${enemy.label} 纏鬥一陣後撤退。`
  };
}
