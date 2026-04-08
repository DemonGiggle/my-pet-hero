import { CLASSES } from './classes.js';
import { SPECIES } from './species.js';
import { loadGameConfig } from './config.js';
import { PetState, NeedKey, VillageActivityRecord } from './types.js';
import { clamp, hashToUnit } from './utils.js';

const RECENT_ACTIVITY_LIMIT = 8;

function villageActivityWindowMs(): number {
  return loadGameConfig().config.cadence.villageActivityBucketMinutes * 60_000;
}

type VillageActivityTemplate = {
  key: string;
  label: string;
  summary: string;
  detail: string;
  tags: string[];
  effects: Partial<Record<NeedKey, number>> & { readiness?: number };
};

function classTemplates(pet: PetState): VillageActivityTemplate[] {
  const heroClass = pet.hero.classProgress.current;
  const village = pet.hero.dungeon.village.name;
  if (heroClass === 'rogue') {
    return [
      { key: 'rogue-shadow-route', label: '踩點暗巷', summary: `在${village}的巷弄裡踩點`, detail: `${pet.name} 把 ${village} 的小巷、屋頂與捷徑又走了一遍，像在替下次行動默背退路。`, tags: ['stealth', 'scout'], effects: { energy: -3, mood: 4, hunger: 2, readiness: 7 } },
      { key: 'rogue-lockwork', label: '練手開鎖', summary: '在木箱與舊鎖上練習手感', detail: `${pet.name} 借了幾個廢棄鎖頭練手，指尖一轉一勾，動作比昨天更俐落。`, tags: ['craft', 'precision'], effects: { energy: -2, mood: 3, thirst: 1, readiness: 6 } },
      { key: 'rogue-teahouse-whispers', label: '收風聽消息', summary: '在茶館角落收集流言', detail: `${pet.name} 窩在茶館不起眼的角落，邊喝水邊聽冒險者與商人的碎語，像是在替迷宮先做功課。`, tags: ['social', 'intel'], effects: { mood: 4, thirst: -2, energy: 1, readiness: 5 } }
    ];
  }
  if (heroClass === 'berserker') {
    return [
      { key: 'berserker-yard-drills', label: '練場揮武', summary: '在練武場做重武器操練', detail: `${pet.name} 在村裡練場反覆揮武，地面都被踩出一圈圈紋路。`, tags: ['training'], effects: { energy: -5, hunger: 4, thirst: 3, mood: 3, readiness: 8 } },
      { key: 'berserker-forge-aid', label: '幫鐵匠打下手', summary: '在鐵匠鋪幫忙搬料與整修', detail: `${pet.name} 跑去鐵匠鋪幫忙搬料、拉風箱，順便把自己的裝備敲得更順手。`, tags: ['craft', 'labor'], effects: { energy: -4, hunger: 3, mood: 2, hygiene: -2, readiness: 6 } },
      { key: 'berserker-ale-bench', label: '酒館壓火', summary: '在酒館安靜吃喝壓住火氣', detail: `${pet.name} 坐在酒館長桌邊大口吃喝，整個人慢慢從衝勁切回穩定節奏。`, tags: ['rest', 'social'], effects: { hunger: -8, thirst: -6, mood: 5, energy: 4, readiness: 4 } }
    ];
  }
  return [
    { key: 'mage-archive', label: '翻閱法術筆記', summary: '在公會角落整理法術筆記', detail: `${pet.name} 把卷軸與筆記攤開來逐頁整理，順手修正了幾個看來不太對勁的術式記號。`, tags: ['study'], effects: { energy: -2, mood: 3, thirst: 2, readiness: 6 } },
    { key: 'mage-alchemy', label: '調藥與補給', summary: '在工作台調整藥草與補給', detail: `${pet.name} 在工作台前把藥草一撮撮分好，像是在把下一趟探險的安全感也一起配齊。`, tags: ['alchemy', 'craft'], effects: { mood: 4, energy: -1, readiness: 7 } },
    { key: 'mage-portal-garden', label: '照看小型法陣', summary: '在村口法陣旁做穩定維護', detail: `${pet.name} 在村口的小法陣旁做維護，讓回村的路聞起來像一種有秩序的安心。`, tags: ['ritual', 'rest'], effects: { energy: 2, mood: 3, readiness: 5 } }
  ];
}

function speciesTemplates(pet: PetState): VillageActivityTemplate[] {
  switch (pet.species) {
    case 'elf':
      return [{ key: 'species-elf-garden', label: '照料靜枝花圃', summary: '在花圃裡做安靜整理', detail: `${pet.name} 在花圃裡修枝整葉，動作安靜得像把心情一起梳平。`, tags: ['calm'], effects: { mood: 5, hygiene: 2, readiness: 4 } }];
    case 'dwarf':
      return [{ key: 'species-dwarf-bench', label: '修整裝備扣件', summary: '把皮帶扣件與護具重新鎖緊', detail: `${pet.name} 把扣件、皮帶與鉚釘一個個重鎖，雖然不花俏，但可靠。`, tags: ['craft'], effects: { mood: 2, energy: -1, readiness: 5 } }];
    case 'human':
      return [{ key: 'species-human-errand', label: '跑腿補日用品', summary: '在村裡跑腿補齊小東西', detail: `${pet.name} 幫忙跑了幾趟雜務，把零碎補給與消息一起帶回來。`, tags: ['errand'], effects: { energy: -2, mood: 3, readiness: 4 } }];
    case 'orc':
      return [{ key: 'species-orc-market', label: '市場上吆喝聊天', summary: '在市場邊吆喝邊交朋友', detail: `${pet.name} 在市場邊一邊幫忙搬貨一邊聊天，氣氛熱鬧，心情也跟著鬆開。`, tags: ['social'], effects: { mood: 5, hunger: 2, energy: -2, readiness: 3 } }];
    case 'dragon':
      return [{ key: 'species-dragon-sun', label: '曬鱗養神', summary: '找了個高處曬鱗片養精神', detail: `${pet.name} 佔了村裡最高、最舒服的位置曬鱗，附近的人自動繞路，但也忍不住多看兩眼。`, tags: ['rest'], effects: { energy: 5, mood: 4, readiness: 4 } }];
  }
}

function needTemplates(pet: PetState): VillageActivityTemplate[] {
  const out: VillageActivityTemplate[] = [];
  if (pet.needs.energy < 55 || pet.needs.health < 70) {
    out.push({ key: 'need-rest-inn', label: '旅店補眠', summary: '在旅店房間好好補眠', detail: `${pet.name} 在旅店窗邊打了個長長的盹，醒來時至少不像剛剛那麼硬撐。`, tags: ['rest'], effects: { energy: 9, health: 4, mood: 2, readiness: 5 } });
  }
  if (pet.needs.hunger > 58 || pet.needs.thirst > 56) {
    out.push({ key: 'need-meal-stall', label: '攤位補給', summary: '在熱食攤前補一頓', detail: `${pet.name} 在熱食攤前停了下來，先把肚子和水袋安撫好，再談別的。`, tags: ['supply'], effects: { hunger: -10, thirst: -8, mood: 3, readiness: 4 } });
  }
  if (pet.needs.hygiene < 48) {
    out.push({ key: 'need-cleanup-bath', label: '盥洗整理', summary: '去澡堂把自己收拾乾淨', detail: `${pet.name} 去把灰塵、血痕和一路沾上的狼狽洗掉，回來時看起來終於像能見人了。`, tags: ['cleanup'], effects: { hygiene: 8, mood: 3, readiness: 3 } });
  }
  return out;
}

function villageActivityWindowStart(at: string): string {
  const timestamp = new Date(at).getTime();
  const windowMs = villageActivityWindowMs();
  return new Date(Math.floor(timestamp / windowMs) * windowMs).toISOString();
}

function pickVillageTemplate(pet: PetState, at: string): VillageActivityTemplate {
  const windowStart = villageActivityWindowStart(at);
  const templates = [...needTemplates(pet), ...classTemplates(pet), ...speciesTemplates(pet)];
  const scored = templates.map(template => ({
    template,
    score: hashToUnit(`${pet.seed}:village:${template.key}:${windowStart}`)
      + (template.tags.includes('rest') && pet.needs.energy < 60 ? 0.2 : 0)
      + (template.tags.includes('social') ? pet.personality.sociability * 0.18 : 0)
      + (template.tags.includes('training') || template.tags.includes('stealth') || template.tags.includes('study') ? pet.personality.discipline * 0.16 : 0)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].template;
}

function buildVillageActivityRecord(pet: PetState, at: string): VillageActivityRecord {
  const startedAt = villageActivityWindowStart(at);
  const template = pickVillageTemplate(pet, startedAt);
  return {
    key: template.key,
    label: template.label,
    summary: template.summary,
    detail: template.detail,
    startedAt,
    effects: { ...template.effects },
    tags: template.tags
  };
}

function commitVillageActivityEffects(pet: PetState, record: VillageActivityRecord): VillageActivityRecord {
  pet.needs.health = clamp(pet.needs.health + (record.effects.health ?? 0));
  pet.needs.hunger = clamp(pet.needs.hunger + (record.effects.hunger ?? 0));
  pet.needs.thirst = clamp(pet.needs.thirst + (record.effects.thirst ?? 0));
  pet.needs.mood = clamp(pet.needs.mood + (record.effects.mood ?? 0));
  pet.needs.energy = clamp(pet.needs.energy + (record.effects.energy ?? 0));
  pet.needs.hygiene = clamp(pet.needs.hygiene + (record.effects.hygiene ?? 0));

  const endedAt = new Date(new Date(record.startedAt).getTime() + villageActivityWindowMs()).toISOString();
  const completed = { ...record, endedAt };
  pet.hero.dungeon.village.recentActivities = [
    ...pet.hero.dungeon.village.recentActivities,
    completed
  ].slice(-RECENT_ACTIVITY_LIMIT);
  pet.hero.dungeon.village.lastVisitedAt = endedAt;
  return completed;
}

export function ensureVillageActivity(pet: PetState, at: string): VillageActivityRecord {
  const village = pet.hero.dungeon.village;
  const currentWindowStart = villageActivityWindowStart(at);
  const current = village.currentActivity;

  if (!current || current.startedAt !== currentWindowStart) {
    village.currentActivity = buildVillageActivityRecord(pet, at);
  }

  village.lastVisitedAt = at;
  return village.currentActivity!;
}

export function advanceVillageActivity(pet: PetState, at: string): VillageActivityRecord[] {
  const village = pet.hero.dungeon.village;
  const completed: VillageActivityRecord[] = [];
  const targetWindowStart = villageActivityWindowStart(at);

  let current = village.currentActivity;
  if (!current) {
    current = buildVillageActivityRecord(pet, village.lastVisitedAt ?? at);
  }

  while (current.startedAt < targetWindowStart) {
    completed.push(commitVillageActivityEffects(pet, current));
    current = buildVillageActivityRecord(pet, new Date(new Date(current.startedAt).getTime() + villageActivityWindowMs()).toISOString());
  }

  village.currentActivity = current.startedAt === targetWindowStart ? current : buildVillageActivityRecord(pet, at);
  village.lastVisitedAt = at;
  return completed;
}

export function applyVillageActivity(pet: PetState, at: string): VillageActivityRecord {
  advanceVillageActivity(pet, at);
  return ensureVillageActivity(pet, at);
}

export function villageReadinessScore(pet: PetState): number {
  const base = (
    pet.needs.health * 0.28 +
    pet.needs.energy * 0.3 +
    (100 - pet.needs.hunger) * 0.14 +
    (100 - pet.needs.thirst) * 0.14 +
    pet.needs.mood * 0.14
  );
  const activityBonus = pet.hero.dungeon.village.currentActivity?.effects.readiness ?? 0;
  return clamp(Math.round(base + activityBonus));
}

export function villageReadinessLabel(score: number): string {
  if (score >= 82) return '隨時能出發';
  if (score >= 66) return '差不多準備好了';
  if (score >= 48) return '還在暖身';
  return '先留村裡比較好';
}
