import {
  DungeonInstance,
  DungeonModifier,
  DungeonRoom,
  DungeonRoomType,
  DungeonTemplate,
  EnemyTemplate,
  PetState,
  TrapKind
} from './types.js';
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
    roomCountRange: [5, 7],
    enemyKeys: ['slime', 'skeletal-guard'],
    eliteEnemyKeys: ['skeletal-guard', 'grave-wisp'],
    bossEnemyKeys: ['cave-drake'],
    exclusiveEnemyKeys: ['grave-wisp'],
    exclusiveDropPrefixes: ['亡鐘', '骨紋', '灰墓'],
    eventBias: 0.16,
    treasureBias: 0.18,
    restBias: 0.12,
    branchChance: 0.48,
    trapBias: 0.36,
    modifiers: [
      { key: 'bone-rattle', label: '骨鳴回廊', description: '陷阱更常見，但寶庫也更容易藏在支線。', effect: 'trap-pressure' },
      { key: 'quiet-sanctum', label: '靜骨避難所', description: '休息點更穩定，恢復也更好。', effect: 'steady-rest' }
    ],
    description: '潮濕、陰冷，滿是骨粉與亡者殘響。'
  },
  {
    key: 'mist-tower',
    theme: 'arcane',
    nameParts: { prefixes: ['霧隱', '沉星', '幽璃'], suffixes: ['廢塔', '遺跡', '觀測所'] },
    floorRange: [2, 8],
    roomCountRange: [5, 8],
    enemyKeys: ['goblin-scout', 'void-apprentice'],
    eliteEnemyKeys: ['void-apprentice', 'mirror-sentinel'],
    bossEnemyKeys: ['cave-drake'],
    exclusiveEnemyKeys: ['mirror-sentinel'],
    exclusiveDropPrefixes: ['霧璃', '觀星', '幻紋'],
    eventBias: 0.24,
    treasureBias: 0.14,
    restBias: 0.08,
    branchChance: 0.56,
    trapBias: 0.28,
    modifiers: [
      { key: 'wandering-fog', label: '迷途霧層', description: '岔路更多，未探索區域資訊更朦朧。', effect: 'route-fog' },
      { key: 'arcane-cache', label: '奧術補遺', description: '事件房與寶庫更容易給高價值收穫。', effect: 'treasure-rich' }
    ],
    description: '殘破高塔中漂著薄霧與失控的奧術碎片。'
  },
  {
    key: 'ember-rift',
    theme: 'fire',
    nameParts: { prefixes: ['灰燼', '赤月', '熔火'], suffixes: ['裂谷', '洞窟', '深坑'] },
    floorRange: [3, 10],
    roomCountRange: [6, 8],
    enemyKeys: ['goblin-scout', 'cave-drake'],
    eliteEnemyKeys: ['cave-drake', 'ash-salamander'],
    bossEnemyKeys: ['cave-drake'],
    exclusiveEnemyKeys: ['ash-salamander'],
    exclusiveDropPrefixes: ['熔火', '燼核', '赤脈'],
    eventBias: 0.1,
    treasureBias: 0.12,
    restBias: 0.06,
    branchChance: 0.42,
    trapBias: 0.4,
    modifiers: [
      { key: 'simmering-fault', label: '灼熱斷層', description: '地面陷阱更危險，強敵也更積極。', effect: 'trap-pressure' },
      { key: 'alpha-den', label: '獵場躁動', description: '精英房更容易出現，但收益也更高。', effect: 'elite-surge' }
    ],
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

function pickModifier(template: DungeonTemplate, seedKey: string): DungeonModifier[] {
  const pool = template.modifiers ?? [];
  if (pool.length === 0) return [];
  return [pickOne(pool, hashToUnit(`${seedKey}:modifier`))];
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
  if (type === 'battle' && template.exclusiveEnemyKeys && hashToUnit(`${seedKey}:exclusive:${index}`) > 0.82) {
    keys = [...keys, ...template.exclusiveEnemyKeys];
  }
  if (type === 'treasure' || type === 'event' || type === 'rest' || type === 'entrance') return [];

  const pool = ENEMIES.filter(enemy => keys.includes(enemy.key) && floor >= enemy.floorRange[0] && floor <= enemy.floorRange[1]);
  const fallback = ENEMIES.filter(enemy => keys.includes(enemy.key));
  const source = pool.length > 0 ? pool : fallback;
  const count = type === 'boss' ? 1 : type === 'elite' ? 1 : 1 + Math.floor(hashToUnit(`${seedKey}:enemy-count:${index}`) * 2);

  return Array.from({ length: count }, (_, n) => pickOne(source, hashToUnit(`${seedKey}:enemy:${index}:${n}`)));
}

function trapForRoom(template: DungeonTemplate, roomType: DungeonRoomType, seedKey: string, index: number) {
  if (roomType === 'entrance' || roomType === 'rest' || roomType === 'boss') return undefined;
  const bias = template.trapBias ?? 0.2;
  if (hashToUnit(`${seedKey}:trap:${index}`) > bias) return undefined;
  const kinds: TrapKind[] = ['spike', 'poison-dart', 'arcane-surge', 'ember-floor', 'bone-snare'];
  return {
    kind: pickOne(kinds, hashToUnit(`${seedKey}:trap-kind:${index}`)),
    severity: 6 + Math.round(hashToUnit(`${seedKey}:trap-severity:${index}`) * 10),
    detectDifficulty: 0.3 + hashToUnit(`${seedKey}:trap-detect:${index}`) * 0.45,
    disarmed: false
  };
}

function buildGraph(rooms: DungeonRoom[], template: DungeonTemplate, seedKey: string): void {
  rooms.forEach((room, index) => {
    const exits = new Set<string>();
    if (index > 0) exits.add(rooms[index - 1].id);
    if (index < rooms.length - 1) exits.add(rooms[index + 1].id);
    const branchChance = template.branchChance ?? 0.4;
    if (index > 0 && index < rooms.length - 2 && hashToUnit(`${seedKey}:branch:${index}`) < branchChance) {
      exits.add(rooms[Math.min(rooms.length - 1, index + 2)].id);
      room.tags = Array.from(new Set([...(room.tags ?? []), 'main-path' as const]));
      rooms[Math.min(rooms.length - 1, index + 2)].tags = Array.from(new Set([...(rooms[Math.min(rooms.length - 1, index + 2)].tags ?? []), 'branch' as const]));
    }
    room.exits = [...exits];
    if (room.exits.length <= 1 && index > 0 && index < rooms.length - 1) room.tags = Array.from(new Set([...(room.tags ?? []), 'dead-end' as const]));
  });
}

export function generateDungeonInstance(params: { pet: PetState; floor: number; at: string }): DungeonInstance {
  const { pet, floor, at } = params;
  const seedKey = `${pet.hero.dungeon.seed}:${pet.id}:${floor}:${at}`;
  const template = pickDungeonTemplate(floor, seedKey);
  const roomCount = rangePick(template.roomCountRange, hashToUnit(`${seedKey}:room-count`));
  const name = buildDungeonName(seedKey, template);
  const modifiers = pickModifier(template, seedKey);

  const rooms: DungeonRoom[] = Array.from({ length: roomCount }, (_, index) => {
    const type = roomTypeFor(template, seedKey, index, roomCount);
    const id = `room-${index + 1}`;
    return {
      id,
      type,
      name: roomLabel(type, seedKey, index),
      depth: index + 1,
      x: index,
      y: 0,
      enemies: enemiesForRoom(template, type, floor, seedKey, index).map(enemy => enemy.key),
      cleared: index === 0,
      exits: [],
      tags: index === 0 ? ['main-path' as const] : undefined,
      trap: trapForRoom(template, type, seedKey, index)
    };
  });

  buildGraph(rooms, template, seedKey);

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
    pathTakenRoomIds: [],
    seed: seedKey,
    description: template.description,
    modifiers
  };
}

export function getCurrentRoom(instance: DungeonInstance): DungeonRoom | undefined {
  return instance.rooms.find(room => room.id === instance.currentRoomId);
}

export function getRoomById(instance: DungeonInstance, roomId: string): DungeonRoom | undefined {
  return instance.rooms.find(room => room.id === roomId);
}

export function chooseNextDungeonRoom(instance: DungeonInstance, at: string): DungeonRoom | null {
  const current = getCurrentRoom(instance);
  if (!current) return null;
  const candidates = current.exits
    .map(roomId => getRoomById(instance, roomId))
    .filter((room): room is DungeonRoom => room !== undefined)
    .filter(room => room.id !== current.id);
  if (candidates.length === 0) return null;

  const scored = candidates.map(room => {
    const unseen = instance.discoveredRoomIds.includes(room.id) ? 0 : 0.3;
    const branch = room.tags?.includes('branch') ? 0.08 : 0;
    const rewardBias = room.type === 'treasure' ? 0.22 : room.type === 'rest' ? -0.02 : room.type === 'elite' ? 0.12 : 0;
    const danger = room.trap && !room.trap.disarmed ? -0.08 : 0;
    const roll = hashToUnit(`${instance.seed}:route:${current.id}:${room.id}:${at}`);
    return { room, score: unseen + branch + rewardBias + danger + roll };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;
  const nextRoom = best.room;
  instance.currentRoomId = nextRoom.id;
  if (!instance.discoveredRoomIds.includes(nextRoom.id)) instance.discoveredRoomIds.push(nextRoom.id);
  if (!instance.pathTakenRoomIds.includes(nextRoom.id)) instance.pathTakenRoomIds.push(nextRoom.id);
  return nextRoom;
}

export function markRoomCleared(instance: DungeonInstance, roomId: string): void {
  const room = getRoomById(instance, roomId);
  if (!room) return;
  room.cleared = true;
  if (!instance.clearedRoomIds.includes(roomId)) instance.clearedRoomIds.push(roomId);
}

export function renderDungeonMinimap(instance: DungeonInstance): string {
  const rooms = [...instance.rooms].sort((a, b) => a.depth - b.depth);
  const glyphFor = (room: DungeonRoom): string => {
    if (room.id === instance.currentRoomId) return '@';
    if (!instance.discoveredRoomIds.includes(room.id)) return '?';
    if (room.type === 'boss') return 'B';
    if (room.type === 'treasure') return '$';
    if (room.type === 'rest') return 'R';
    if (room.type === 'elite') return 'E';
    if (room.type === 'event') return '!';
    return room.cleared ? '·' : 'o';
  };

  return rooms.map((room, index) => {
    const branch = room.tags?.includes('branch') ? '↘' : '─';
    const trap = room.trap && !room.trap.disarmed && instance.discoveredRoomIds.includes(room.id) ? '^' : '';
    return `${glyphFor(room)}${trap}${index < rooms.length - 1 ? branch : ''}`;
  }).join('');
}
