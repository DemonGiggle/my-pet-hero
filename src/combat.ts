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
import { computeEquipmentBonuses } from './gear.js';

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
  },
  {
    key: 'grave-wisp',
    label: '墓燼幽火',
    floorRange: [2, 7],
    damageTypeBias: 'magic',
    baseHealth: 26,
    baseAttack: 14,
    baseDefense: 4,
    baseAccuracy: 0.84,
    baseEvasion: 0.12,
    baseCrit: 0.08,
    aggression: 0.78,
    expReward: 16,
    goldReward: 11,
    abilities: ['curse-flare']
  },
  {
    key: 'mirror-sentinel',
    label: '鏡面守兵',
    floorRange: [3, 9],
    damageTypeBias: 'magic',
    baseHealth: 36,
    baseAttack: 15,
    baseDefense: 9,
    baseAccuracy: 0.8,
    baseEvasion: 0.07,
    baseCrit: 0.07,
    aggression: 0.7,
    expReward: 18,
    goldReward: 12,
    abilities: ['reflective-shell']
  },
  {
    key: 'ash-salamander',
    label: '灰燼蠑螈',
    floorRange: [4, 10],
    damageTypeBias: 'physical',
    baseHealth: 38,
    baseAttack: 17,
    baseDefense: 8,
    baseAccuracy: 0.83,
    baseEvasion: 0.11,
    baseCrit: 0.09,
    aggression: 0.86,
    expReward: 19,
    goldReward: 13,
    abilities: ['ember-rush']
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
  const gear = computeEquipmentBonuses(pet);
  const maxHealth = Math.round(54 + pet.hero.attributes.vitality * 4 + pet.hero.level * 5 + heroClass.healthModifier + gear.maxHealth);
  return {
    name: pet.name,
    maxHealth,
    health: Math.round(maxHealth * (pet.needs.health / 100)),
    attack: Math.round(pet.hero.attributes.strength * 2.1 + pet.hero.level * 2 + affinity * 3 + gear.attack),
    magicAttack: Math.round(pet.hero.attributes.intelligence * 2.4 + pet.hero.level * 2 + affinity * 3 + gear.magicAttack),
    defense: Math.round(pet.hero.attributes.vitality * 1.6 + pet.hero.level + heroClass.physicalResistance * 14 + gear.defense),
    magicDefense: Math.round(pet.hero.attributes.intelligence * 1.25 + pet.hero.level + heroClass.magicResistance * 14 + gear.magicDefense),
    accuracy: clamp(0.74 + pet.hero.attributes.agility * 0.012 + pet.hero.attributes.luck * 0.004 + heroClass.attackSpeedModifier * 0.1 + gear.accuracy, 0.55, 0.97),
    evasion: clamp(0.05 + pet.hero.attributes.agility * 0.008 + heroClass.moveSpeedModifier * 0.15 + gear.evasion, 0.02, 0.35),
    crit: clamp(0.04 + pet.hero.attributes.luck * 0.006 + heroClass.attackSpeedModifier * 0.04 + gear.crit, 0.03, 0.35),
    damageTypeBias: pet.hero.classProgress.current === 'mage' ? 'magic' : 'physical',
    shield: 0
  };
}

function buildEnemySnapshot(enemy: EnemyTemplate, floor: number): CombatantSnapshot {
  const scale = 1 + (floor - 1) * 0.2;
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

function applyEnemyAbilityPrelude(
  enemy: EnemyTemplate,
  enemyState: CombatantSnapshot,
  hero: CombatantSnapshot,
  round: number,
  seed: string,
  floor: number
): CombatTurnLog[] {
  if (round !== 1 || !enemy.abilities || enemy.abilities.length === 0) return [];

  const turns: CombatTurnLog[] = [];

  for (const ability of enemy.abilities) {
    if (ability === 'ambush') {
      const strike = rollAttack(enemyState, hero, 'enemy', round, `${seed}:ability:ambush`, {
        damageType: 'physical',
        powerMultiplier: 0.82,
        hitBonus: 0.08
      });
      turns.push({
        ...strike,
        text: `${enemy.label} 先以突襲搶節奏。${strike.text}`
      });
      continue;
    }

    if (ability === 'spell-burst') {
      const burst = rollAttack(enemyState, hero, 'enemy', round, `${seed}:ability:spell-burst`, {
        damageType: 'magic',
        powerMultiplier: 0.9,
        hitBonus: 0.05,
        critBonus: 0.05
      });
      turns.push({
        ...burst,
        text: `${enemy.label} 先放出一輪法術爆發。${burst.text}`
      });
      continue;
    }

    if (ability === 'fear') {
      hero.accuracy = clamp(hero.accuracy - 0.05, 0.2, 0.97);
      hero.evasion = clamp(hero.evasion - 0.03, 0.02, 0.35);
      hero.crit = clamp(hero.crit - 0.03, 0.03, 0.35);
      turns.push({
        round,
        actor: 'enemy',
        result: 'skill',
        damageType: enemy.damageTypeBias,
        damage: 0,
        text: `${enemy.label} 散發壓迫感，${hero.name} 的判斷變得保守。`
      });
      continue;
    }

    if (ability === 'curse-flare') {
      const flare = rollAttack(enemyState, hero, 'enemy', round, `${seed}:ability:curse-flare`, {
        damageType: 'magic',
        powerMultiplier: 1.0,
        hitBonus: 0.06,
        critBonus: 0.04
      });
      hero.magicDefense = Math.max(0, hero.magicDefense - 2);
      turns.push({
        ...flare,
        text: `${enemy.label} 的詛咒火光灼上來。${flare.text}`
      });
      continue;
    }

    if (ability === 'reflective-shell') {
      const shield = Math.max(4, Math.round(enemyState.maxHealth * 0.18));
      enemyState.shield += shield;
      turns.push({
        round,
        actor: 'enemy',
        result: 'skill',
        damageType: enemy.damageTypeBias,
        damage: 0,
        text: `${enemy.label} 展開反射甲殼，獲得 ${shield} 點護盾。`
      });
      continue;
    }

    if (ability === 'ember-rush') {
      const rush = rollAttack(enemyState, hero, 'enemy', round, `${seed}:ability:ember-rush`, {
        damageType: 'physical',
        powerMultiplier: 0.95,
        hitBonus: 0.1,
        critBonus: 0.04
      });
      enemyState.attack += Math.max(1, Math.round(floor * 0.3));
      turns.push({
        ...rush,
        text: `${enemy.label} 以灼熱衝刺壓上來。${rush.text}`
      });
    }
  }

  return turns;
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

export function runCombat(pet: PetState, floor: number, at: string, forcedEnemyKey?: string): CombatResult {
  const enemy = forcedEnemyKey
    ? ENEMIES.find(candidate => candidate.key === forcedEnemyKey) ?? chooseEnemy(floor, `${pet.seed}:enemy:${at}:${floor}`)
    : chooseEnemy(floor, `${pet.seed}:enemy:${at}:${floor}`);
  const hero = buildHeroSnapshot(pet);
  const enemyState = buildEnemySnapshot(enemy, floor);
  const turns: CombatTurnLog[] = [];
  const skillsUsed: SkillUseLog[] = [];
  const maxRounds = 6;
  const skillCooldowns = new Map<string, number>();
  const heroSkills = getSkillsForClass(pet.hero.classProgress.current).filter((skill) => (skill.minLevel ?? 1) <= pet.hero.level);
  let enemyPreludeNote = '';

  for (let round = 1; round <= maxRounds; round++) {
    const openingTurns = applyEnemyAbilityPrelude(enemy, enemyState, hero, round, `${pet.seed}:${at}:${enemy.key}`, floor);
    if (openingTurns.length > 0) {
      if (!enemyPreludeNote) enemyPreludeNote = openingTurns.map((turn) => turn.text).join(' ');
      turns.push(...openingTurns);
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
          expGained: Math.max(1, Math.round(enemy.expReward * 0.25)),
          goldGained: 0,
          healthLoss,
          moodDelta: -12,
          text: `${pet.name} 一進場就被 ${enemy.label} 壓制，最後只能撤退。${enemyPreludeNote ? ` ${enemyPreludeNote}` : ''}`
        };
      }
    }

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
        expGained: Math.round(expGained * 1.05),
        goldGained: Math.round(goldGained * 1.08),
        healthLoss,
        moodDelta: 7,
        text: `${pet.name} 打倒了 ${enemy.label}。${enemyPreludeNote ? ` ${enemyPreludeNote}` : ''}`
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
        goldGained: Math.max(0, Math.round(enemy.goldReward * 0.08)),
        healthLoss,
        moodDelta: -12,
        text: `${pet.name} 被 ${enemy.label} 擊退了。${enemyPreludeNote ? ` ${enemyPreludeNote}` : ''}`
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
    expGained: outcome === 'win' ? Math.round((enemy.expReward + floor + skillsUsed.length) * 1.05) : Math.max(2, Math.round(enemy.expReward * 0.5)),
    goldGained: outcome === 'win' ? Math.round((enemy.goldReward + floor) * 1.08) : Math.max(0, Math.round(enemy.goldReward * 0.4)),
    healthLoss: hero.maxHealth - hero.health,
    moodDelta: outcome === 'win' ? 5 : -3,
    text: outcome === 'win'
      ? `${pet.name} 和 ${enemy.label} 纏鬥後取得勝利。${enemyPreludeNote ? ` ${enemyPreludeNote}` : ''}`
      : `${pet.name} 和 ${enemy.label} 纏鬥一陣後撤退。${enemyPreludeNote ? ` ${enemyPreludeNote}` : ''}`
  };
}
