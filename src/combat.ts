import { CLASSES, getClassAffinity } from './classes.js';
import {
  CombatResult,
  CombatTurnLog,
  CombatantSnapshot,
  DamageType,
  EnemyTemplate,
  PetState
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
    damageTypeBias: pet.hero.classProgress.current === 'mage' ? 'magic' : 'physical'
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
    damageTypeBias: enemy.damageTypeBias
  };
}

function rollAttack(
  actor: CombatantSnapshot,
  target: CombatantSnapshot,
  actorKind: 'hero' | 'enemy',
  round: number,
  seed: string
): CombatTurnLog {
  const hitRoll = hashToUnit(`${seed}:${actorKind}:hit:${round}`);
  const critRoll = hashToUnit(`${seed}:${actorKind}:crit:${round}`);
  const variance = 0.85 + hashToUnit(`${seed}:${actorKind}:var:${round}`) * 0.35;
  const hitChance = clamp(actor.accuracy - target.evasion + 0.08, 0.2, 0.98);
  const damageType: DamageType = actor.damageTypeBias;

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

  const isCrit = critRoll < actor.crit;
  const attackStat = damageType === 'magic' ? actor.magicAttack : actor.attack;
  const defenseStat = damageType === 'magic' ? target.magicDefense : target.defense;
  const raw = Math.max(1, attackStat * variance - defenseStat * 0.72);
  const damage = Math.max(1, Math.round(raw * (isCrit ? 1.65 : 1)));

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

export function runCombat(pet: PetState, floor: number, at: string): CombatResult {
  const enemy = chooseEnemy(floor, `${pet.seed}:enemy:${at}:${floor}`);
  const hero = buildHeroSnapshot(pet);
  const enemyState = buildEnemySnapshot(enemy, floor);
  const turns: CombatTurnLog[] = [];
  const maxRounds = 6;

  for (let round = 1; round <= maxRounds; round++) {
    const heroTurn = rollAttack(hero, enemyState, 'hero', round, `${pet.seed}:${at}:${enemy.key}`);
    turns.push(heroTurn);
    enemyState.health = Math.max(0, enemyState.health - heroTurn.damage);
    if (enemyState.health <= 0) {
      const expGained = enemy.expReward + floor * 2;
      const goldGained = enemy.goldReward + Math.max(0, Math.round(floor * 1.5));
      const healthLoss = hero.maxHealth - hero.health;
      return {
        outcome: 'win',
        enemy,
        hero,
        enemyState,
        rounds: round,
        turns,
        expGained,
        goldGained,
        healthLoss,
        moodDelta: 7,
        text: `${pet.name} 打倒了 ${enemy.label}。`
      };
    }

    const enemyTurn = rollAttack(enemyState, hero, 'enemy', round, `${pet.seed}:${at}:${enemy.key}`);
    turns.push(enemyTurn);
    hero.health = Math.max(0, hero.health - enemyTurn.damage);
    if (hero.health <= 0) {
      const healthLoss = hero.maxHealth;
      return {
        outcome: 'defeat',
        enemy,
        hero,
        enemyState,
        rounds: round,
        turns,
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
    expGained: outcome === 'win' ? enemy.expReward + floor : Math.max(2, Math.round(enemy.expReward * 0.5)),
    goldGained: outcome === 'win' ? enemy.goldReward + floor : Math.max(0, Math.round(enemy.goldReward * 0.35)),
    healthLoss: hero.maxHealth - hero.health,
    moodDelta: outcome === 'win' ? 5 : -3,
    text: outcome === 'win'
      ? `${pet.name} 和 ${enemy.label} 纏鬥後取得勝利。`
      : `${pet.name} 和 ${enemy.label} 纏鬥一陣後撤退。`
  };
}
