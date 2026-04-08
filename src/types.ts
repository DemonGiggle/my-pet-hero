export type Species = 'elf' | 'dwarf' | 'human' | 'orc' | 'dragon';
export type HeroClass = 'berserker' | 'rogue' | 'mage';

export type NeedKey = 'health' | 'hunger' | 'thirst' | 'mood' | 'energy' | 'hygiene';
export type AttributeKey = 'strength' | 'agility' | 'intelligence' | 'vitality' | 'luck';
export type DamageType = 'physical' | 'magic';
export type ArmorType = 'cloth' | 'leather' | 'mail' | 'plate';
export type WeaponTag =
  | 'staff'
  | 'dagger'
  | 'shortblade'
  | 'two-handed'
  | 'axe'
  | 'sword'
  | 'mace'
  | 'dual-wield';
export type AbilityTag =
  | 'physical-resistance'
  | 'magic-vulnerability'
  | 'anti-knockdown'
  | 'anti-restrain'
  | 'trap-detection'
  | 'lockpicking'
  | 'stealth'
  | 'magic-food'
  | 'alchemy'
  | 'town-portal'
  | 'elemental-magic'
  | 'summoning'
  | 'mind-control';
export type SkillTarget = 'self' | 'enemy';
export type SkillEffectKind = 'damage' | 'heal' | 'shield' | 'buff';
export type DungeonRoomType = 'entrance' | 'battle' | 'elite' | 'treasure' | 'event' | 'rest' | 'shop' | 'boss';
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';
export type DungeonModifierEffect = 'trap-pressure' | 'treasure-rich' | 'route-fog' | 'steady-rest' | 'elite-surge';
export type RoomTag = 'main-path' | 'branch' | 'dead-end' | 'secret';
export type TrapKind = 'spike' | 'poison-dart' | 'arcane-surge' | 'ember-floor' | 'bone-snare';

export interface Needs {
  health: number;
  hunger: number;
  thirst: number;
  mood: number;
  energy: number;
  hygiene: number;
}

export interface Attributes {
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  luck: number;
}

export interface Personality {
  sociability: number;
  curiosity: number;
  discipline: number;
  playfulness: number;
  appetite: number;
}

export interface SpeciesConfig {
  key: Species;
  label: string;
  description: string;
  statBias: Partial<Needs>;
  attributeBias: Partial<Attributes>;
  decay: {
    hungerPerHour: number;
    thirstPerHour: number;
    energyPerHour: number;
    hygienePerHour: number;
    moodDriftPerHour: number;
  };
  temperament: Partial<Personality>;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

export interface ClassConfig {
  key: HeroClass;
  label: string;
  description: string;
  favoredSpecies: Species[];
  baseAttributeBias: Partial<Attributes>;
  speciesAttributeBonus: Partial<Record<Species, Partial<Attributes>>>;
  healthModifier: number;
  physicalResistance: number;
  magicResistance: number;
  controlResistance: number;
  moveSpeedModifier: number;
  attackSpeedModifier: number;
  preferredArmor: ArmorType[];
  weaponTags: WeaponTag[];
  abilities: AbilityTag[];
  gameplayNotes: string[];
}

export interface SkillDefinition {
  key: string;
  heroClass: HeroClass;
  label: string;
  description: string;
  target: SkillTarget;
  effectKind: SkillEffectKind;
  damageType?: DamageType;
  powerMultiplier?: number;
  healMultiplier?: number;
  shieldMultiplier?: number;
  hitBonus?: number;
  critBonus?: number;
  minLevel?: number;
  cooldownTurns: number;
}

export interface PetEvent {
  at: string;
  type: string;
  delta: Partial<Needs>;
  text: string;
}

export interface EnemyTemplate {
  key: string;
  label: string;
  floorRange: [number, number];
  damageTypeBias: DamageType;
  baseHealth: number;
  baseAttack: number;
  baseDefense: number;
  baseAccuracy: number;
  baseEvasion: number;
  baseCrit: number;
  aggression: number;
  expReward: number;
  goldReward: number;
  abilities?: string[];
}

export interface CombatantSnapshot {
  name: string;
  maxHealth: number;
  health: number;
  attack: number;
  magicAttack: number;
  defense: number;
  magicDefense: number;
  accuracy: number;
  evasion: number;
  crit: number;
  damageTypeBias: DamageType;
  shield: number;
}

export interface EquipmentBonuses {
  maxHealth?: number;
  attack?: number;
  magicAttack?: number;
  defense?: number;
  magicDefense?: number;
  accuracy?: number;
  evasion?: number;
  crit?: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  itemLevel: number;
  heroClass: HeroClass;
  bonuses: EquipmentBonuses;
  source?: string;
  exclusiveTo?: string;
}

export interface EquipmentState {
  equipped: {
    weapon?: EquipmentItem;
    armor?: EquipmentItem;
    accessory?: EquipmentItem;
  };
  inventory: EquipmentItem[];
  lastEquippedAt?: string;
}

export interface SkillUseLog {
  round: number;
  actor: 'hero' | 'enemy';
  skillKey: string;
  skillLabel: string;
  effectKind: SkillEffectKind;
  damageType?: DamageType;
  value: number;
  text: string;
}

export interface CombatTurnLog {
  round: number;
  actor: 'hero' | 'enemy';
  result: 'hit' | 'crit' | 'miss' | 'skill';
  damageType: DamageType;
  damage: number;
  text: string;
  skill?: SkillUseLog;
}

export interface CombatResult {
  outcome: 'win' | 'escape' | 'defeat';
  enemy: EnemyTemplate;
  hero: CombatantSnapshot;
  enemyState: CombatantSnapshot;
  rounds: number;
  turns: CombatTurnLog[];
  skillsUsed: SkillUseLog[];
  expGained: number;
  goldGained: number;
  healthLoss: number;
  moodDelta: number;
  text: string;
}

export interface AdventureLog {
  at: string;
  floor: number;
  outcome: 'win' | 'escape' | 'rest' | 'treasure' | 'defeat';
  text: string;
  expGained: number;
  goldGained: number;
  combat?: CombatResult;
  dungeonName?: string;
  roomName?: string;
  roomType?: DungeonRoomType;
  rewards?: string[];
  roomSummary?: string;
  roomEffect?: {
    health?: number;
    energy?: number;
    mood?: number;
    hunger?: number;
    thirst?: number;
  };
  trap?: {
    kind: TrapKind;
    detected: boolean;
    triggered: boolean;
    effect: string;
  };
  routeChoice?: {
    fromRoomId: string;
    toRoomId: string;
    reason: string;
  };
  runState?: {
    roomIndex: number;
    roomCount: number;
    clearedRoomIds: string[];
    discoveredRoomIds: string[];
    completedDungeon: boolean;
    pathTakenRoomIds?: string[];
    minimap?: string;
  };
}

export interface DungeonTrap {
  kind: TrapKind;
  severity: number;
  detectDifficulty: number;
  disarmed: boolean;
}

export interface DungeonRoom {
  id: string;
  type: DungeonRoomType;
  name: string;
  depth: number;
  x: number;
  y: number;
  enemies: string[];
  cleared: boolean;
  exits: string[];
  tags?: RoomTag[];
  trap?: DungeonTrap;
}

export interface DungeonModifier {
  key: string;
  label: string;
  description: string;
  effect: DungeonModifierEffect;
}

export interface DungeonTemplate {
  key: string;
  theme: string;
  nameParts: {
    prefixes: string[];
    suffixes: string[];
  };
  floorRange: [number, number];
  roomCountRange: [number, number];
  enemyKeys: string[];
  eliteEnemyKeys: string[];
  bossEnemyKeys: string[];
  exclusiveEnemyKeys?: string[];
  exclusiveDropPrefixes?: string[];
  eventBias: number;
  treasureBias: number;
  restBias: number;
  branchChance?: number;
  trapBias?: number;
  modifiers?: DungeonModifier[];
  description: string;
}

export interface DungeonInstance {
  id: string;
  name: string;
  theme: string;
  templateKey: string;
  floor: number;
  rooms: DungeonRoom[];
  currentRoomId: string;
  discoveredRoomIds: string[];
  clearedRoomIds: string[];
  pathTakenRoomIds: string[];
  seed: string;
  description: string;
  modifiers: DungeonModifier[];
}

export interface ExpeditionSummary {
  id: string;
  startedAt: string;
  endedAt?: string;
  dungeonName: string;
  floor: number;
  status: 'preparing' | 'exploring' | 'returned' | 'failed';
  returnMode?: 'portal' | 'retreat' | 'defeat';
  roomsCleared: number;
  totalRooms: number;
  bossDefeated: boolean;
  totalExpGained: number;
  totalGoldGained: number;
  villagePreparation: string[];
  returnSummary?: string;
  completed: boolean;
  logs: AdventureLog[];
}

export interface VillageState {
  name: string;
  supplies: {
    food: number;
    water: number;
    herbs: number;
  };
  lastVisitedAt: string;
}

export interface DungeonProgress {
  seed: number;
  floor: number;
  deepestFloor: number;
  runs: number;
  location: 'village' | 'dungeon';
  currentDungeon?: DungeonInstance;
  currentExpedition?: ExpeditionSummary;
  expeditionHistory: ExpeditionSummary[];
  village: VillageState;
}

export interface ClassProgress {
  current: HeroClass;
  unlocked: HeroClass[];
  aptitude: Partial<Record<HeroClass, number>>;
}

export interface HeroProgress {
  level: number;
  exp: number;
  expToNext: number;
  statPoints: number;
  gold: number;
  attributes: Attributes;
  equipment: EquipmentState;
  dungeon: DungeonProgress;
  classProgress: ClassProgress;
  adventureLog: AdventureLog[];
}

export interface PetState {
  version: number;
  id: string;
  name: string;
  species: Species;
  createdAt: string;
  updatedAt: string;
  lastSimulatedAt: string;
  ageHours: number;
  seed: number;
  needs: Needs;
  personality: Personality;
  hero: HeroProgress;
  history: PetEvent[];
}

export interface SimulationResult {
  pet: PetState;
  events: PetEvent[];
  summary: string;
  moodLabel: string;
  stageLabel: string;
}

export interface RenderResult {
  outputPath: string;
}

export interface StatusSnapshot {
  now: string;
  summary: string;
  moodLabel: string;
  stageLabel: string;
}
