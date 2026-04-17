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
  supplyUse?: Partial<Record<'food' | 'water' | 'herbs', number>>;
};

function villageName(pet: PetState): string {
  return pet.hero.dungeon.village.name;
}

function recentActivityPenalty(pet: PetState, key: string): number {
  const recent = pet.hero.dungeon.village.recentActivities.slice(-4).reverse();
  return recent.reduce((penalty, activity, index) => {
    if (activity.key !== key) return penalty;
    return penalty - Math.max(0.08, 0.22 - index * 0.05);
  }, 0);
}

function needMatchBonus(pet: PetState, template: VillageActivityTemplate): number {
  let score = 0;
  if ((template.effects.energy ?? 0) > 0 && pet.needs.energy < 60) score += 0.28;
  if ((template.effects.health ?? 0) > 0 && pet.needs.health < 68) score += 0.3;
  if ((template.effects.hunger ?? 0) < 0 && pet.needs.hunger > 50) score += 0.22;
  if ((template.effects.thirst ?? 0) < 0 && pet.needs.thirst > 50) score += 0.22;
  if ((template.effects.hygiene ?? 0) > 0 && pet.needs.hygiene < 55) score += 0.2;
  if ((template.effects.mood ?? 0) > 0 && pet.needs.mood < 62) score += 0.18;
  if ((template.effects.readiness ?? 0) > 0 && pet.hero.dungeon.currentExpedition) score += 0.12;
  if (template.tags.includes('rest') && pet.needs.energy < 55) score += 0.24;
  if (template.tags.includes('social') && pet.needs.mood < 60) score += 0.16;
  if (template.tags.includes('training') && pet.personality.discipline > 0.6) score += 0.16;
  if (template.tags.includes('stealth') && pet.personality.curiosity > 0.55) score += 0.12;
  return score;
}

function supplyFitBonus(pet: PetState, template: VillageActivityTemplate): number {
  const supplies = pet.hero.dungeon.village.supplies;
  let bonus = 0;
  if ((template.supplyUse?.food ?? 0) > 0 && supplies.food > 0) bonus += 0.12;
  if ((template.supplyUse?.water ?? 0) > 0 && supplies.water > 0) bonus += 0.12;
  if ((template.supplyUse?.herbs ?? 0) > 0 && supplies.herbs > 0) bonus += 0.14;
  return bonus;
}

function enrichDetail(template: VillageActivityTemplate, pet: PetState): string {
  const extra: string[] = [];
  if ((template.effects.energy ?? 0) > 0 && pet.needs.energy < 50) extra.push('先把體力補回來，行動才不會虛掉。');
  if ((template.effects.hunger ?? 0) < 0 && pet.needs.hunger > 60) extra.push('肚子先安定下來，心情也會跟著穩。');
  if ((template.effects.thirst ?? 0) < 0 && pet.needs.thirst > 60) extra.push('水分補回來後，節奏會更順。');
  if ((template.effects.hygiene ?? 0) > 0 && pet.needs.hygiene < 50) extra.push('整理完之後，整體狀態也比較像樣。');
  if ((template.effects.readiness ?? 0) > 0 && pet.hero.dungeon.currentExpedition) extra.push('這趟補給也會直接影響下一次出發的節奏。');
  return extra.length > 0 ? `${template.detail} ${extra.join(' ')}` : template.detail;
}

function classTemplates(pet: PetState): VillageActivityTemplate[] {
  const heroClass = pet.hero.classProgress.current;
  const village = villageName(pet);
  if (heroClass === 'rogue') {
    return [
      { key: 'rogue-shadow-route', label: '踩點暗巷', summary: `在${village}的巷弄裡踩點`, detail: `${pet.name} 把 ${village} 的小巷、屋頂與捷徑又走了一遍，像在替下次行動默背退路。`, tags: ['stealth', 'scout'], effects: { energy: -3, mood: 4, hunger: 2, readiness: 7 } },
      { key: 'rogue-lockwork', label: '練手開鎖', summary: '在木箱與舊鎖上練習手感', detail: `${pet.name} 借了幾個廢棄鎖頭練手，指尖一轉一勾，動作比昨天更俐落。`, tags: ['craft', 'precision'], effects: { energy: -2, mood: 3, thirst: 1, readiness: 6 } },
      { key: 'rogue-teahouse-whispers', label: '收風聽消息', summary: '在茶館角落收集流言', detail: `${pet.name} 窩在茶館不起眼的角落，邊喝水邊聽冒險者與商人的碎語，像是在替迷宮先做功課。`, tags: ['social', 'intel'], effects: { mood: 4, thirst: -2, energy: 1, readiness: 5 }, supplyUse: { water: 1 } },
      { key: 'rogue-rooftop-watch', label: '屋頂巡視', summary: '從屋頂確認村裡的動線', detail: `${pet.name} 爬上屋頂順一圈，把 ${village} 的人流與死角都掃了一遍，連風向都記下來。`, tags: ['scout', 'precision'], effects: { energy: -2, mood: 2, readiness: 8 } },
      { key: 'rogue-map-copy', label: '重繪路線圖', summary: '把路線圖重新畫得更細', detail: `${pet.name} 把舊地圖攤開重畫，補上幾個昨天沒注意到的轉角與出口。`, tags: ['craft', 'study'], effects: { energy: -1, mood: 2, readiness: 7 } }
    ];
  }
  if (heroClass === 'berserker') {
    return [
      { key: 'berserker-yard-drills', label: '練場揮武', summary: '在練武場做重武器操練', detail: `${pet.name} 在村裡練場反覆揮武，地面都被踩出一圈圈紋路。`, tags: ['training'], effects: { energy: -5, hunger: 4, thirst: 3, mood: 3, readiness: 8 } },
      { key: 'berserker-forge-aid', label: '幫鐵匠打下手', summary: '在鐵匠鋪幫忙搬料與整修', detail: `${pet.name} 跑去鐵匠鋪幫忙搬料、拉風箱，順便把自己的裝備敲得更順手。`, tags: ['craft', 'labor'], effects: { energy: -4, hunger: 3, mood: 2, hygiene: -2, readiness: 6 } },
      { key: 'berserker-ale-bench', label: '酒館壓火', summary: '在酒館安靜吃喝壓住火氣', detail: `${pet.name} 坐在酒館長桌邊大口吃喝，整個人慢慢從衝勁切回穩定節奏。`, tags: ['rest', 'social'], effects: { hunger: -8, thirst: -6, mood: 5, energy: 4, readiness: 4 }, supplyUse: { food: 1, water: 1 } },
      { key: 'berserker-square-guard', label: '廣場巡守', summary: '在廣場協助維持秩序', detail: `${pet.name} 在廣場邊走邊看，誰要是起哄太過頭，氣勢一站出去就先安靜一半。`, tags: ['social', 'guard'], effects: { mood: 4, readiness: 5, energy: -2 } },
      { key: 'berserker-mentor-spar', label: '帶新人對練', summary: '陪村裡的新人做基礎對練', detail: `${pet.name} 一邊陪新人對練，一邊把自己的節奏重新校正好。`, tags: ['training', 'social'], effects: { mood: 4, readiness: 7, energy: -3, hunger: 2 } }
    ];
  }
  return [
    { key: 'mage-archive', label: '翻閱法術筆記', summary: '在公會角落整理法術筆記', detail: `${pet.name} 把卷軸與筆記攤開來逐頁整理，順手修正了幾個看來不太對勁的術式記號。`, tags: ['study'], effects: { energy: -2, mood: 3, thirst: 2, readiness: 6 } },
    { key: 'mage-alchemy', label: '調藥與補給', summary: '在工作台調整藥草與補給', detail: `${pet.name} 在工作台前把藥草一撮撮分好，像是在把下一趟探險的安全感也一起配齊。`, tags: ['alchemy', 'craft'], effects: { mood: 4, energy: -1, readiness: 7 }, supplyUse: { herbs: 1 } },
    { key: 'mage-portal-garden', label: '照看小型法陣', summary: '在村口法陣旁做穩定維護', detail: `${pet.name} 在村口的小法陣旁做維護，讓回村的路聞起來像一種有秩序的安心。`, tags: ['ritual', 'rest'], effects: { energy: 2, mood: 3, readiness: 5 } },
    { key: 'mage-runebind', label: '重新綁定符文', summary: '把舊符文重新整理成可用狀態', detail: `${pet.name} 把幾段舊符文重新綁好，讓每個術式像被重新校準了一次。`, tags: ['study', 'ritual'], effects: { energy: -2, mood: 2, readiness: 8 } },
    { key: 'mage-lantern-watch', label: '法燈巡照', summary: '提著法燈確認村口結界', detail: `${pet.name} 提著法燈把村口結界照過一輪，連角落裡的細微晃動都沒放過。`, tags: ['guard', 'ritual'], effects: { energy: -1, mood: 3, readiness: 6 } }
  ];
}

function speciesTemplates(pet: PetState): VillageActivityTemplate[] {
  switch (pet.species) {
    case 'elf':
      return [
        { key: 'species-elf-garden', label: '照料靜枝花圃', summary: '在花圃裡做安靜整理', detail: `${pet.name} 在花圃裡修枝整葉，動作安靜得像把心情一起梳平。`, tags: ['calm'], effects: { mood: 5, hygiene: 2, readiness: 4 } },
        { key: 'species-elf-moonwell', label: '月井淨化', summary: '替月井做溫和淨化', detail: `${pet.name} 在月井邊做溫和淨化，整座村子的空氣都像慢了一拍。`, tags: ['rest', 'ritual'], effects: { energy: 3, mood: 4, readiness: 3 }, supplyUse: { water: 1 } }
      ];
    case 'dwarf':
      return [
        { key: 'species-dwarf-bench', label: '修整裝備扣件', summary: '把皮帶扣件與護具重新鎖緊', detail: `${pet.name} 把扣件、皮帶與鉚釘一個個重鎖，雖然不花俏，但可靠。`, tags: ['craft'], effects: { mood: 2, energy: -1, readiness: 5 } },
        { key: 'species-dwarf-forge', label: '爐火校準', summary: '在爐火旁校準打鐵節奏', detail: `${pet.name} 在爐火旁把節奏一錘一錘校準好，手感也跟著回穩。`, tags: ['training', 'craft'], effects: { energy: -2, mood: 2, readiness: 6 } }
      ];
    case 'human':
      return [
        { key: 'species-human-errand', label: '跑腿補日用品', summary: '在村裡跑腿補齊小東西', detail: `${pet.name} 幫忙跑了幾趟雜務，把零碎補給與消息一起帶回來。`, tags: ['errand'], effects: { energy: -2, mood: 3, readiness: 4 } },
        { key: 'species-human-notice', label: '公告欄巡看', summary: '把公告欄的情報過一遍', detail: `${pet.name} 在公告欄前把任務與消息逐條看過，順手把有價值的線索收進腦袋裡。`, tags: ['social', 'intel'], effects: { mood: 2, readiness: 5, thirst: 1 } }
      ];
    case 'orc':
      return [
        { key: 'species-orc-market', label: '市場上吆喝聊天', summary: '在市場邊吆喝邊交朋友', detail: `${pet.name} 在市場邊一邊幫忙搬貨一邊聊天，氣氛熱鬧，心情也跟著鬆開。`, tags: ['social'], effects: { mood: 5, hunger: 2, energy: -2, readiness: 3 } },
        { key: 'species-orc-square-song', label: '廣場合唱', summary: '跟著大家在廣場吼一輪', detail: `${pet.name} 在廣場跟著吼了一輪，嗓門雖大，但團隊感也跟著起來了。`, tags: ['social', 'rest'], effects: { mood: 6, energy: -1, readiness: 4, thirst: 1 } }
      ];
    case 'dragon':
      return [
        { key: 'species-dragon-sun', label: '曬鱗養神', summary: '找了個高處曬鱗片養精神', detail: `${pet.name} 佔了村裡最高、最舒服的位置曬鱗，附近的人自動繞路，但也忍不住多看兩眼。`, tags: ['rest'], effects: { energy: 5, mood: 4, readiness: 4 } },
        { key: 'species-dragon-watch', label: '高處守望', summary: '在高處替村子放哨', detail: `${pet.name} 站在高處替整個村子放哨，連遠方的動靜都像在視野裡放大了一圈。`, tags: ['guard', 'scout'], effects: { mood: 3, readiness: 6, energy: -1 } }
      ];
  }
}

function needTemplates(pet: PetState): VillageActivityTemplate[] {
  const out: VillageActivityTemplate[] = [];
  if (pet.needs.energy < 55 || pet.needs.health < 70) {
    out.push({ key: 'need-rest-inn', label: '旅店補眠', summary: '在旅店房間好好補眠', detail: `${pet.name} 在旅店窗邊打了個長長的盹，醒來時至少不像剛剛那麼硬撐。`, tags: ['rest'], effects: { energy: 9, health: 4, mood: 2, readiness: 5 }, supplyUse: { water: 1 } });
    out.push({ key: 'need-hot-broth', label: '熱湯補氣', summary: '喝熱湯把精神拉回來', detail: `${pet.name} 喝了碗熱湯，體力和心情都慢慢回到可用區間。`, tags: ['rest', 'supply'], effects: { energy: 5, hunger: -5, mood: 3, readiness: 4 }, supplyUse: { food: 1, water: 1 } });
  }
  if (pet.needs.hunger > 58 || pet.needs.thirst > 56) {
    out.push({ key: 'need-meal-stall', label: '攤位補給', summary: '在熱食攤前補一頓', detail: `${pet.name} 在熱食攤前停了下來，先把肚子和水袋安撫好，再談別的。`, tags: ['supply'], effects: { hunger: -10, thirst: -8, mood: 3, readiness: 4 }, supplyUse: { food: 1, water: 1 } });
    out.push({ key: 'need-merchant-stock', label: '補貨採買', summary: '順手把村裡必需品補齊', detail: `${pet.name} 在攤商之間補了一圈貨，順便把下一次出門要用的東西補齊。`, tags: ['supply', 'errand'], effects: { hunger: -4, thirst: -4, mood: 2, readiness: 5 } });
  }
  if (pet.needs.hygiene < 48) {
    out.push({ key: 'need-cleanup-bath', label: '盥洗整理', summary: '去澡堂把自己收拾乾淨', detail: `${pet.name} 去把灰塵、血痕和一路沾上的狼狽洗掉，回來時看起來終於像能見人了。`, tags: ['cleanup'], effects: { hygiene: 8, mood: 3, readiness: 3 }, supplyUse: { water: 1 } });
  }
  if (pet.needs.mood < 55) {
    out.push({ key: 'need-quiet-talk', label: '安靜閒聊', summary: '找個熟人慢慢聊天', detail: `${pet.name} 找了個熟人慢慢聊天，把剛剛卡住的心情一點點卸下來。`, tags: ['social', 'calm'], effects: { mood: 8, readiness: 3, energy: 1 } });
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
      + needMatchBonus(pet, template)
      + supplyFitBonus(pet, template)
      + (template.tags.includes('social') ? pet.personality.sociability * 0.18 : 0)
      + (template.tags.includes('training') || template.tags.includes('stealth') || template.tags.includes('study') ? pet.personality.discipline * 0.16 : 0)
      + recentActivityPenalty(pet, template.key)
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
    detail: enrichDetail(template, pet),
    startedAt,
    effects: { ...template.effects },
    tags: template.tags
  };
}

function commitVillageActivityEffects(pet: PetState, record: VillageActivityRecord): VillageActivityRecord {
  const village = pet.hero.dungeon.village;
  const resolvedEffects = { ...record.effects };
  let detail = record.detail;

  if (record.key === 'need-rest-inn' && village.supplies.water > 0) {
    village.supplies.water -= 1;
    resolvedEffects.energy = (resolvedEffects.energy ?? 0) + 2;
    resolvedEffects.health = (resolvedEffects.health ?? 0) + 1;
    detail += ' 旅店的熱水讓這段休息更有效。';
  } else if (record.key === 'need-hot-broth' && village.supplies.food > 0 && village.supplies.water > 0) {
    village.supplies.food -= 1;
    village.supplies.water -= 1;
    resolvedEffects.energy = (resolvedEffects.energy ?? 0) + 2;
    resolvedEffects.hunger = (resolvedEffects.hunger ?? 0) - 2;
    resolvedEffects.readiness = (resolvedEffects.readiness ?? 0) + 1;
    detail += ' 熱湯和麵包讓狀態回復得更快。';
  } else if (record.key === 'need-meal-stall' && village.supplies.food > 0 && village.supplies.water > 0) {
    village.supplies.food -= 1;
    village.supplies.water -= 1;
    resolvedEffects.hunger = (resolvedEffects.hunger ?? 0) - 3;
    resolvedEffects.thirst = (resolvedEffects.thirst ?? 0) - 2;
    resolvedEffects.readiness = (resolvedEffects.readiness ?? 0) + 1;
    detail += ' 熱食和清水把餘裕補得更完整。';
  } else if (record.key === 'need-cleanup-bath' && village.supplies.water > 0) {
    village.supplies.water -= 1;
    if (village.supplies.herbs > 0) village.supplies.herbs -= 1;
    resolvedEffects.hygiene = (resolvedEffects.hygiene ?? 0) + 2;
    resolvedEffects.mood = (resolvedEffects.mood ?? 0) + 1;
    detail += ' 澡堂的熱水和草藥讓整體更清爽。';
  } else if (record.key === 'mage-alchemy' && village.supplies.herbs > 0) {
    village.supplies.herbs -= 1;
    resolvedEffects.readiness = (resolvedEffects.readiness ?? 0) + 2;
    resolvedEffects.mood = (resolvedEffects.mood ?? 0) + 1;
    detail += ' 藥草也被順手調得更有用。';
  } else if (record.key === 'berserker-ale-bench' && village.supplies.food > 0) {
    village.supplies.food -= 1;
    resolvedEffects.energy = (resolvedEffects.energy ?? 0) + 1;
    detail += ' 連吃喝都更像是正式的整補。';
  } else if (record.key === 'species-elf-moonwell' && village.supplies.water > 0) {
    village.supplies.water -= 1;
    resolvedEffects.energy = (resolvedEffects.energy ?? 0) + 1;
    detail += ' 月井補給讓精神沉得更穩。';
  }

  pet.needs.health = clamp(pet.needs.health + (resolvedEffects.health ?? 0));
  pet.needs.hunger = clamp(pet.needs.hunger + (resolvedEffects.hunger ?? 0));
  pet.needs.thirst = clamp(pet.needs.thirst + (resolvedEffects.thirst ?? 0));
  pet.needs.mood = clamp(pet.needs.mood + (resolvedEffects.mood ?? 0));
  pet.needs.energy = clamp(pet.needs.energy + (resolvedEffects.energy ?? 0));
  pet.needs.hygiene = clamp(pet.needs.hygiene + (resolvedEffects.hygiene ?? 0));

  const endedAt = new Date(new Date(record.startedAt).getTime() + villageActivityWindowMs()).toISOString();
  const completed = { ...record, detail, effects: resolvedEffects, endedAt };
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
  const recentMomentum = pet.hero.dungeon.village.recentActivities.slice(-3).reduce((bonus, activity, index) => {
    const readiness = activity.effects.readiness ?? 0;
    if (readiness <= 0) return bonus;
    return bonus + readiness * Math.max(0.08, 0.22 - index * 0.05);
  }, 0);
  return clamp(Math.round(base + activityBonus + recentMomentum));
}

export function villageReadinessLabel(score: number): string {
  if (score >= 92) return '滿狀態出發';
  if (score >= 82) return '隨時能出發';
  if (score >= 66) return '差不多準備好了';
  if (score >= 48) return '還在暖身';
  return '先留村裡比較好';
}
