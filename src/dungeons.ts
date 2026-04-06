import { DungeonInstance, DungeonRoom, DungeonRoomType, DungeonTemplate, EnemyTemplate, PetState } from './types.js';
import { ENEMIES } from './combat.js';
import { hashToUnit, pickOne } from './utils.js';

const PREFIXES = ['枯骨', '霧隱', '灰燼', '沉星', '黑潮', '赤月', '蒼影', '幽火'];
const SUFFIXES = ['地穴', '廢塔', '裂谷', '遺跡', '洞窟', '迷城', '古井', '墓園'];

export const DUNGEON_TEMPLATES: DungeonTemplate[] = [
  {
    key: 'bone-crypt',
    theme: 'undead',
    nameParts: { prefixes: ['枯骨', '幽火', '亡鐘'], suffixes: ['地穴', '墓園', '埋骨殿'] },
    floorRange: [1, 6],
    roomCountRange: [4, 6],
    enemyKeys: ['slime', 'skeletal-guard'],
    eliteEnemyKeys: ['skeletal-guard'],
    bossEnemyKeys: ['cave-drake'],
    eventBias: 0.18,
    treasureBias: 0.16,
    restBias: 0.1,
    description: '潮濕、陰冷，滿是骨粉與亡者殘響。'
  },
  {
    key: 'mist-tower',
    theme: 'arcane',
    nameParts: { prefixes: ['霧隱', '沉星', '幽璃'], suffixes: ['廢塔', '遺跡', '觀測所'] },
    floorRange: [2, 8],
    roomCountRange: [5, 7],
    enemyKeys: ['goblin-scout', 'void-apprentice'],
    eliteEnemyKeys: ['void-apprentice'],
    bossEnemyKeys: ['cave-drake'],
    eventBias: 0.24,
    treasureBias: 0.14,
    restBias: 0.08,
    description: '殘破高塔中漂著薄霧與失控的奧術碎片。'
  },
  {
    key: 'ember-rift',
    theme: 'fire',
    nameParts: { prefixes: ['灰燼', '赤月', '熔火'], suffixes: ['裂谷', '洞窟', '深坑'] },
    floorRange: [3, 10],
    roomCountRange: [5, 8],
    enemyKeys: ['goblin-scout', 'cave-drake'],
    eliteEnemyKeys: ['cave-drake'],
    bossEnemyKeys: ['cave-drake'],
    eventBias: 0.12,
    treasureBias: 0.12,
    restBias: 0.06,
    description: '灼熱與焦痕交織，地脈像還在喘氣。'
  }
];

function rangePick([min, max]: [number, number], unit: number): number {
  return min + Math.floor(unit * (max - min + 1));
}

export function buildDungeonName(seedKey: string, template?: DungeonTemplate): string {
  const prefixes = template?.nameParts.prefixes ?? PREFIXES;
  const suffixes = template?.nameParts.suffixes ?? SUFFIXES;
  const prefix = pickOne(prefixes, hashToUnit(`${seedKey}:prefix`));
  const suffix = pickOne(suffixes, hashToUnit(`${seedKey}:suffix`));
  return `${prefix}${suffix}`;
}

export function pickDungeonTemplate(floor: number, seedKey: string): DungeonTemplate {
  const candidates = DUNGEON_TEMPLATES.filter(template => floor >= template.floorRange[0] && floor <= template.floorRange[1]);
  const pool = candidates.length > 0 ? candidates : DUNGEON_TEMPLATES;
  return pickOne(pool, hashToUnit(`${seedKey}:template:${floor}`));
}

function roomTypeFor(template: DungeonTemplate, seedKey: string, index: number, total: number): DungeonRoomType {
  if (index === 0) return 'entrance';
  if (index === total - 1) return 'boss';

  const roll = hashToUnit(`${seedKey}:room-type:${index}`);
  if (roll < template.restBias) return 'rest';
  if (roll < template.restBias + template.treasureBias) return 'treasure';
  if (roll < template.restBias + template.treasureBias + template.eventBias) return 'event';
  if (roll > 0.88) return 'elite';
  return 'battle';
}

function roomLabel(type: DungeonRoomType, seedKey: string, index: number): string {
  const labels: Record<DungeonRoomType, string[]> = {
    entrance: ['入口殘廳', '破碎前庭', '迷宮入口'],
    battle: ['回音走廊', '碎石通道', '陰影廳室'],
    elite: ['異變祭壇', '守衛大廳', '封印之間'],
    treasure: ['封存藏庫', '裂縫寶室', '舊王私庫'],
    event: ['歪斜書庫', '陌生壁畫室', '奇異岔路'],
    rest: ['靜息角落', '暖灰營地', '殘火休息處'],
    shop: ['流浪攤位', '迷途商亭', '異界補給點'],
    boss: ['深層核心', '主宰之座', '最深處']
  };
  return pickOne(labels[type], hashToUnit(`${seedKey}:room-label:${index}:${type}`));
}

function enemiesForRoom(template: DungeonTemplate, type: DungeonRoomType, floor: number, seedKey: string, index: number): EnemyTemplate[] {
  let keys = template.enemyKeys;
  if (type === 'elite') keys = template.eliteEnemyKeys.length > 0 ? template.eliteEnemyKeys : template.enemyKeys;
  if (type === 'boss') keys = template.bossEnemyKeys.length > 0 ? template.bossEnemyKeys : template.eliteEnemyKeys;
  if (type === 'treasure' || type === 'event' || type === 'rest' || type === 'entrance') return [];

  const pool = ENEMIES.filter(enemy => keys.includes(enemy.key) && floor >= enemy.floorRange[0] && floor <= enemy.floorRange[1]);
  const fallback = ENEMIES.filter(enemy => keys.includes(enemy.key));
  const source = pool.length > 0 ? pool : fallback;
  const count = type === 'boss' ? 1 : type === 'elite' ? 1 : 1 + Math.floor(hashToUnit(`${seedKey}:enemy-count:${index}`) * 2);

  return Array.from({ length: count }, (_, n) => pickOne(source, hashToUnit(`${seedKey}:enemy:${index}:${n}`)));
}

export function generateDungeonInstance(params: { pet: PetState; floor: number; at: string }): DungeonInstance {
  const { pet, floor, at } = params;
  const seedKey = `${pet.hero.dungeon.seed}:${pet.id}:${floor}:${at}`;
  const template = pickDungeonTemplate(floor, seedKey);
  const roomCount = rangePick(template.roomCountRange, hashToUnit(`${seedKey}:room-count`));
  const name = buildDungeonName(seedKey, template);

  const rooms: DungeonRoom[] = Array.from({ length: roomCount }, (_, index) => {
    const type = roomTypeFor(template, seedKey, index, roomCount);
    const id = `room-${index + 1}`;
    return {
      id,
      type,
      name: roomLabel(type, seedKey, index),
      depth: index + 1,
      enemies: enemiesForRoom(template, type, floor, seedKey, index).map(enemy => enemy.key),
      cleared: index === 0,
      exits: []
    };
  });

  rooms.forEach((room, index) => {
    const exits: string[] = [];
    if (index > 0) exits.push(rooms[index - 1].id);
    if (index < rooms.length - 1) exits.push(rooms[index + 1].id);
    if (index > 0 && index < rooms.length - 2 && hashToUnit(`${seedKey}:branch:${index}`) > 0.78) {
      exits.push(rooms[Math.min(rooms.length - 1, index + 2)].id);
    }
    room.exits = Array.from(new Set(exits));
  });

  return {
    id: `${template.key}-${floor}-${Math.floor(hashToUnit(`${seedKey}:id`) * 100000)}`,
    name,
    theme: template.theme,
    templateKey: template.key,
    floor,
    rooms,
    currentRoomId: rooms[0]?.id ?? 'room-1',
    discoveredRoomIds: rooms.slice(0, 1).map(room => room.id),
    clearedRoomIds: rooms.filter(room => room.cleared).map(room => room.id),
    seed: seedKey,
    description: template.description
  };
}

export function getCurrentRoom(instance: DungeonInstance): DungeonRoom | undefined {
  return instance.rooms.find(room => room.id === instance.currentRoomId);
}

export function advanceDungeonRoom(instance: DungeonInstance): DungeonRoom | null {
  const currentIndex = instance.rooms.findIndex(room => room.id === instance.currentRoomId);
  if (currentIndex < 0 || currentIndex >= instance.rooms.length - 1) return null;
  const nextRoom = instance.rooms[currentIndex + 1];
  instance.currentRoomId = nextRoom.id;
  if (!instance.discoveredRoomIds.includes(nextRoom.id)) instance.discoveredRoomIds.push(nextRoom.id);
  if (!instance.clearedRoomIds.includes(nextRoom.id)) instance.clearedRoomIds.push(nextRoom.id);
  nextRoom.cleared = true;
  return nextRoom;
}
