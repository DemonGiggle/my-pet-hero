import { feedPet, playWithPet, cleanPet } from './actions.js';
import { formatChatHelp, loadChatPreferences, parseChatCommand, saveChatPreferences } from './chat.js';
import { loadGameConfig } from './config.js';
import { renderDungeonMinimap } from './dungeons.js';
import { describeItem, equipItemById, formatEquipmentSummary, listInventory, sellItemById } from './gear.js';
import { buildExpeditionStorySummary, renderNarrativeDigest } from './narrative.js';
import { renderStatusCard } from './render.js';
import { simulatePet } from './simulate.js';
import { listPetSaves, loadPet, savePet } from './state.js';
import { SKILLS } from './skills.js';
import { PetState } from './types.js';
import { villageReadinessLabel, villageReadinessScore } from './village.js';

function formatNeedSummary(pet: PetState): string {
  const warnings: string[] = [];
  if (pet.needs.health < 45) warnings.push('血量偏低');
  if (pet.needs.energy < 35) warnings.push('有點累');
  if (pet.needs.hunger > 70) warnings.push('很餓');
  if (pet.needs.thirst > 70) warnings.push('很渴');
  if (pet.needs.hygiene < 35) warnings.push('需要整理');
  return warnings.length > 0 ? warnings.join('、') : '狀態大致穩定';
}

function formatHeadline(result: ReturnType<typeof simulatePet>): string {
  const pet = result.pet;
  const villageActivity = pet.hero.dungeon.village.currentActivity;
  const readiness = villageReadinessLabel(villageReadinessScore(pet));
  const location = pet.hero.dungeon.location === 'village'
    ? `現在在${pet.hero.dungeon.village.name}${villageActivity ? `，正忙著${villageActivity.summary}` : ''}`
    : `正在 ${pet.hero.dungeon.currentDungeon?.name ?? `第 ${pet.hero.dungeon.floor} 層迷宮`} 探索`;
  const expedition = pet.hero.dungeon.currentExpedition
    ? `，本趟已推進 ${pet.hero.dungeon.currentExpedition.roomsCleared}/${pet.hero.dungeon.currentExpedition.totalRooms} 房`
    : pet.hero.dungeon.location === 'village'
      ? `，出發準備度${readiness}`
      : '';
  return `${pet.name}是個 Lv${pet.hero.level} ${pet.species} ${pet.hero.classProgress.current}，心情${result.moodLabel}，${location}${expedition}。`;
}

function formatCardSummary(result: ReturnType<typeof simulatePet>): string {
  const pet = result.pet;
  const readiness = villageReadinessLabel(villageReadinessScore(pet));
  const villageActivity = pet.hero.dungeon.village.currentActivity;
  const location = pet.hero.dungeon.location === 'village'
    ? villageActivity ? `村裡忙著${villageActivity.label}` : '在村莊待命'
    : '迷宮探索中';
  const urgency = pet.needs.health < 45 || pet.needs.energy < 35 || pet.needs.hunger > 70 || pet.needs.thirst > 70
    ? '先照顧狀態'
    : pet.hero.dungeon.currentExpedition
      ? '探險順利中'
      : `準備度 ${readiness}`;
  return `${location} ${urgency}`;
}

function describeCurrentScene(pet: PetState): string {
  const activity = pet.hero.dungeon.village.currentActivity;
  if (pet.hero.dungeon.location === 'village') {
    if (activity) return `${pet.name} 現在待在 ${pet.hero.dungeon.village.name}，正${activity.summary}。`;
    return `${pet.name} 現在待在 ${pet.hero.dungeon.village.name}，暫時按兵不動。`;
  }

  if (pet.hero.dungeon.currentExpedition) {
    return `${pet.name} 人還在 ${pet.hero.dungeon.currentExpedition.dungeonName}，這趟已推進 ${pet.hero.dungeon.currentExpedition.roomsCleared}/${pet.hero.dungeon.currentExpedition.totalRooms} 房。`;
  }

  return `${pet.name} 正在迷宮之中摸索前路。`;
}

function summarizeRecentStoryBeats(pet: PetState): string[] {
  const beats: string[] = [];
  const adventures = pet.hero.adventureLog.slice(-3);
  const currentExpedition = pet.hero.dungeon.currentExpedition;
  const villageActivities = pet.hero.dungeon.village.recentActivities.slice(-2);

  if (currentExpedition) {
    beats.push(`${currentExpedition.dungeonName} 這趟還沒結束，最深處的壓力仍掛在身上。`);
    if (currentExpedition.goal) beats.push(`這趟明確是為了${currentExpedition.goal.goalLabel}，目標指向 ${currentExpedition.goal.target}。`);
    beats.push(...buildExpeditionStorySummary(currentExpedition));
  }

  for (const item of adventures) {
    if (item.trap?.triggered) {
      beats.push(`途中還踩中了 ${item.trap.kind}，讓狀態被硬生生磨掉一截。`);
      continue;
    }
    if (item.rewards?.some((reward) => reward.includes('升到 Lv.'))) {
      beats.push('先前一戰替他贏來了成長，等級也往上踏了一階。');
      continue;
    }
    if (item.rewards?.some((reward) => reward.includes('換上了新防具')) || item.rewards?.some((reward) => reward.includes('掉落：'))) {
      beats.push('在廢墟深處撈到的新裝備，多少替他把底氣補回來一些。');
      continue;
    }
    if (item.outcome === 'win') {
      beats.push('前幾個房間並沒有讓他失手，腳步算是穩穩踏過去了。');
    }
  }

  if (pet.hero.dungeon.location === 'village' && pet.hero.dungeon.village.currentActivity) {
    const activity = pet.hero.dungeon.village.currentActivity;
    beats.push(`現在在村裡忙著「${activity.label}」，${activity.detail}`);
  }

  if (beats.length < 2) {
    for (const activity of villageActivities) {
      const effectText = Object.entries(activity.effects)
        .filter(([, value]) => typeof value === 'number' && value !== 0)
        .map(([key, value]) => `${key} ${value! > 0 ? '+' : ''}${value}`)
        .join(' / ');
      beats.push(`${pet.name} 回到村裡後沒有閒著，還在用「${activity.label}」慢慢把節奏收回來${effectText ? `（${effectText}）` : ''}。`);
      if (beats.length >= 3) break;
    }
  }

  return Array.from(new Set(beats)).slice(0, 3);
}

function summarizeRisk(pet: PetState): { riskSummary: string; momentum: string; recommendedFocus: string } {
  const readinessScore = villageReadinessScore(pet);
  const readinessLabel = villageReadinessLabel(readinessScore);
  const inExpedition = Boolean(pet.hero.dungeon.currentExpedition);

  if (pet.needs.health <= 25) {
    return {
      riskSummary: '血線很薄，再往前就不是試探，是拿命換答案。',
      momentum: inExpedition ? '探險仍懸著，但氣血已經見底。' : '人雖回到村裡，傷勢卻還沒真正補平。',
      recommendedFocus: '強調危險與暫避鋒芒。'
    };
  }

  if (pet.needs.energy <= 35) {
    return {
      riskSummary: '精神有些散，再硬撐只會把判斷磨鈍。',
      momentum: '節奏還在，但需要喘口氣才能把手感接回來。',
      recommendedFocus: '強調休整而不是衝刺。'
    };
  }

  if (readinessScore < 60) {
    return {
      riskSummary: `準備度只有 ${readinessLabel}，勉強能動，還談不上從容。`,
      momentum: '局勢沒有崩，但還差一口完整的出發氣。',
      recommendedFocus: '強調整補與蓄勢。'
    };
  }

  if (inExpedition) {
    return {
      riskSummary: '狀態還能撐，但接下來每一步都得看清代價。',
      momentum: '局勢仍在往前滾動，眼下算是有機會把這趟做完。',
      recommendedFocus: '強調進退判斷與探險壓力。'
    };
  }

  return {
    riskSummary: '眼下沒有立刻失控的危險，但也不是該漫不經心的時候。',
    momentum: '整體節奏還算穩，像是在替下一次出發慢慢蓄光。',
    recommendedFocus: '強調穩定與下一步的可能。'
  };
}

function normalizePetIdCandidate(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function resolveReportSimulationAt(pet: PetState, nowIso: string): string {
  const nowMs = new Date(nowIso).getTime();
  const lastMs = new Date(pet.lastSimulatedAt).getTime();
  const cadenceMinutes = loadGameConfig().config.cadence.simulationBucketMinutes;
  const forcedMs = lastMs + cadenceMinutes * 60_000;
  return new Date(Math.max(nowMs, forcedMs)).toISOString();
}

function buildNarrationSeed(result: ReturnType<typeof simulatePet>): Record<string, unknown> {
  const pet = result.pet;
  const risk = summarizeRisk(pet);
  return {
    scene: describeCurrentScene(pet),
    storyArc: summarizeRecentStoryBeats(pet).join(' '),
    danger: risk.riskSummary,
    momentum: risk.momentum,
    recommendedFocus: risk.recommendedFocus
  };
}

function buildRecentTimeline(result: ReturnType<typeof simulatePet>): string[] {
  const pet = result.pet;
  const lines: string[] = [];
  const currentExpedition = pet.hero.dungeon.currentExpedition;
  const latestExpedition = pet.hero.dungeon.expeditionHistory[pet.hero.dungeon.expeditionHistory.length - 1];
  const currentVillageActivity = pet.hero.dungeon.village.currentActivity;
  const recentVillageActivities = pet.hero.dungeon.village.recentActivities.slice(-3).reverse();

  if (currentExpedition) {
    lines.push(`現在仍在 ${currentExpedition.dungeonName}，本趟已推進 ${currentExpedition.roomsCleared}/${currentExpedition.totalRooms} 房。`);
    if (currentExpedition.villagePreparation.length > 0) {
      lines.push(`出發前做過 ${currentExpedition.villagePreparation.join('、')}，這股準備還撐著這趟節奏。`);
    }
    const lastLog = currentExpedition.logs[currentExpedition.logs.length - 1];
    if (lastLog) {
      const roomLabel = lastLog.roomName ?? lastLog.roomType ?? '未知房間';
      lines.push(`最近一站是 ${roomLabel}，結果 ${lastLog.outcome}，拿到 EXP +${lastLog.expGained} / Gold +${lastLog.goldGained}。`);
    }
  } else if (latestExpedition) {
    lines.push(`上一趟剛從 ${latestExpedition.dungeonName} 回來，結果是 ${latestExpedition.status}${latestExpedition.returnMode ? ` / ${latestExpedition.returnMode}` : ''}。`);
    if (latestExpedition.returnSummary) lines.push(latestExpedition.returnSummary);
    const lastLog = latestExpedition.logs[latestExpedition.logs.length - 1];
    if (lastLog) {
      const roomLabel = lastLog.roomName ?? lastLog.roomType ?? '未知房間';
      lines.push(`收尾前最後經過 ${roomLabel}，結果 ${lastLog.outcome}。`);
    }
  }

  if (pet.hero.dungeon.location === 'village' && currentVillageActivity) {
    lines.push(`回到 ${pet.hero.dungeon.village.name} 後，現在正忙著${currentVillageActivity.summary}。`);
  }

  for (const activity of recentVillageActivities) {
    lines.push(`稍早做過「${activity.label}」，${activity.summary}。`);
    if (lines.length >= 5) break;
  }

  if (lines.length === 0) {
    lines.push(`${pet.name} 目前待在 ${pet.hero.dungeon.village.name}，最近還沒留下新的探險或村莊節奏。`);
  }

  return Array.from(new Set(lines)).slice(0, 5);
}

function buildStoryBeats(result: ReturnType<typeof simulatePet>): string[] {
  const pet = result.pet;
  const beats: string[] = [];
  beats.push(describeCurrentScene(pet));
  beats.push(...buildRecentTimeline(result));
  beats.push(...summarizeRecentStoryBeats(pet));
  beats.push(summarizeRisk(pet).riskSummary);
  return Array.from(new Set(beats)).slice(0, 5);
}

function buildKeyStats(result: ReturnType<typeof simulatePet>): Record<string, unknown> {
  const pet = result.pet;
  const readinessScore = villageReadinessScore(pet);
  return {
    health: Number(pet.needs.health.toFixed(1)),
    energy: Number(pet.needs.energy.toFixed(1)),
    hunger: Number(pet.needs.hunger.toFixed(1)),
    thirst: Number(pet.needs.thirst.toFixed(1)),
    readiness: readinessScore,
    readinessLabel: villageReadinessLabel(readinessScore),
    gold: pet.hero.gold,
    exp: pet.hero.exp,
    expToNext: pet.hero.expToNext
  };
}

function formatExpeditionSummary(expedition: PetState['hero']['dungeon']['expeditionHistory'][number]): string[] {
  const title = expedition.completed
    ? `【探險結算】${expedition.dungeonName} / 第 ${expedition.floor} 層`
    : `【進行中探險】${expedition.dungeonName} / 第 ${expedition.floor} 層`;
  const lines = [
    title,
    `結果：${expedition.status}${expedition.returnMode ? ` / ${expedition.returnMode}` : ''}`,
    `進度：${expedition.roomsCleared}/${expedition.totalRooms} 房`,
    `收益：EXP +${expedition.totalExpGained} / Gold +${expedition.totalGoldGained}`,
    `Boss：${expedition.bossDefeated ? '已擊破' : '未擊破'}`,
    `完成度：${expedition.completed ? '本次探險已完整結束' : '仍在探索中'}`
  ];
  if (expedition.goal) {
    lines.push(`任務主線：${expedition.goal.goalLabel} / 目標 ${expedition.goal.target}`);
    lines.push(`任務動機：${expedition.goal.motive}`);
    lines.push(`任務進度：${expedition.goal.progress}`);
    lines.push(`前段線索：${expedition.goal.clueText}`);
  }
  if (expedition.villagePreparation.length > 0) lines.push(`村莊整備：${expedition.villagePreparation.join('、')}`);
  if (expedition.returnSummary) lines.push(`回村整理：${expedition.returnSummary}`);
  if (expedition.logs.length > 0) {
    lines.push('本次歷程：');
    for (const item of expedition.logs) {
      const roomLabel = item.roomName ?? item.roomType ?? 'unknown';
      lines.push(`• ${roomLabel}，${item.outcome}，EXP +${item.expGained}，Gold +${item.goldGained}`);
      lines.push(`  ${item.text}`);
      if (item.runState?.minimap) lines.push(`  地圖：${item.runState.minimap}`);
    }
  }
  return lines;
}

function formatAdventureReport(result: ReturnType<typeof simulatePet>): string[] {
  const pet = result.pet;
  const adventures = pet.hero.adventureLog.slice(-3).reverse();
  const readinessScore = villageReadinessScore(pet);
  const readinessLabel = villageReadinessLabel(readinessScore);
  const currentVillageActivity = pet.hero.dungeon.village.currentActivity;
  const recentVillageActivities = pet.hero.dungeon.village.recentActivities.slice(-3).reverse();
  const lines: string[] = [
    `【近況】${formatHeadline(result)}`,
    `【身體狀態】${formatNeedSummary(pet)}`,
    `【村莊節奏】出發準備度 ${readinessScore}/100，${readinessLabel}${currentVillageActivity ? `，目前在忙「${currentVillageActivity.label}」` : ''}`,
    `【裝備】${formatEquipmentSummary(pet).join(' / ')}`
  ];

  if (pet.hero.dungeon.currentDungeon) {
    lines.push(`【迷宮地圖】${renderDungeonMinimap(pet.hero.dungeon.currentDungeon)}`);
    if (pet.hero.dungeon.currentDungeon.modifiers.length > 0) {
      lines.push(`【本層異常】${pet.hero.dungeon.currentDungeon.modifiers.map(modifier => `${modifier.label}(${modifier.description})`).join(' / ')}`);
    }
  }

  if (pet.hero.dungeon.location === 'village' && currentVillageActivity) {
    lines.push(`【村裡在做什麼】${currentVillageActivity.detail}`);
    if (recentVillageActivities.length > 1) {
      lines.push('【最近村莊行程】');
      for (const activity of recentVillageActivities) {
        const effects = Object.entries(activity.effects)
          .filter(([, value]) => typeof value === 'number' && value !== 0)
          .map(([key, value]) => `${key} ${value! > 0 ? '+' : ''}${value}`)
          .join(' / ');
        lines.push(`- ${activity.label}，${activity.summary}${effects ? ` (${effects})` : ''}`);
      }
    }
  }

  if (pet.hero.dungeon.currentExpedition) {
    lines.push(`【正在做什麼】剛好人在 ${pet.hero.dungeon.currentExpedition.dungeonName}，目前清了 ${pet.hero.dungeon.currentExpedition.roomsCleared}/${pet.hero.dungeon.currentExpedition.totalRooms} 房。`);
    lines.push(...renderNarrativeDigest(pet.hero.dungeon.currentExpedition));
    lines.push(...formatExpeditionSummary(pet.hero.dungeon.currentExpedition as PetState['hero']['dungeon']['expeditionHistory'][number]).map(line => `  ${line}`));
  } else if (pet.hero.dungeon.expeditionHistory.length > 0) {
    const latest = pet.hero.dungeon.expeditionHistory[pet.hero.dungeon.expeditionHistory.length - 1];
    lines.push(`【上一趟探險】剛從 ${latest.dungeonName} 回來，結果是 ${latest.status}${latest.returnMode ? ` / ${latest.returnMode}` : ''}。`);
    lines.push(...renderNarrativeDigest(latest));
    lines.push(...formatExpeditionSummary(latest).map(line => `  ${line}`));
  } else {
    lines.push(`【探險節奏】最近還沒留下正式探險紀錄，目前待在 ${pet.hero.dungeon.village.name}。`);
  }

  if (adventures.length === 0) {
    lines.push('【最近幾件事】還沒有新的冒險紀錄。');
    return lines;
  }

  lines.push('【最近幾件事】');
  for (const item of adventures) {
    const where = item.dungeonName ? `${item.dungeonName} 的 ${item.roomName ?? item.roomType ?? '未知房間'}` : `第 ${item.floor} 層`;
    lines.push(`- 在 ${where}，結果 ${item.outcome}，拿到 EXP +${item.expGained} / Gold +${item.goldGained}。`);
    lines.push(`  ${item.text}`);
    if (item.roomSummary) lines.push(`  房間摘要：${item.roomSummary}`);
    if (item.runState?.minimap) lines.push(`  迷你地圖：${item.runState.minimap}`);
    if (item.trap) lines.push(`  陷阱：${item.trap.effect}`);
    if (item.routeChoice) lines.push(`  路線：${item.routeChoice.reason}`);
    if (item.rewards && item.rewards.length > 0) lines.push(`  額外收穫：${item.rewards.join('、')}`);
    if (item.combat) {
      lines.push(`  戰鬥摘要：對上 ${item.combat.enemy.label}，打了 ${item.combat.rounds} 回合，結果 ${item.combat.outcome}。`);
      if (item.combat.skillsUsed.length > 0) lines.push(`  用到技能：${item.combat.skillsUsed.map(skill => skill.skillLabel).join('、')}`);
    }
  }

  return lines;
}

export async function resolvePetId(explicitId?: string): Promise<string> {
  const saves = await listPetSaves();
  if (!explicitId) {
    const chatPreferences = await loadChatPreferences();
    if (chatPreferences.defaultHeroId) return chatPreferences.defaultHeroId;
    if (saves.length === 1) return saves[0].id;
    if (saves.length === 0) throw new Error('找不到任何角色存檔，請先用 create 建立角色。');
    throw new Error(`這裡有 ${saves.length} 個角色，請加 --id 指定，或先用 /pet use HERO_ID 設定預設角色。可用角色：${saves.map(save => save.id).join(', ')}`);
  }

  const exact = saves.find((save) => save.id === explicitId);
  if (exact) return exact.id;

  const slugMatch = saves.find((save) => normalizePetIdCandidate(save.id) === normalizePetIdCandidate(explicitId));
  if (slugMatch) return slugMatch.id;

  const nameMatch = saves.find((save) => typeof save.name === 'string' && normalizePetIdCandidate(save.name) === normalizePetIdCandidate(explicitId));
  if (nameMatch) return nameMatch.id;

  if (saves.length === 1) return saves[0].id;
  if (saves.length === 0) throw new Error('找不到任何角色存檔，請先用 create 建立角色。');
  throw new Error(`找不到角色存檔：${explicitId}。可用角色：${saves.map(save => save.id + (save.name ? `(${save.name})` : '')).join(', ')}`);
}

export async function getStatusPayload(idArg?: string, includeReport = false): Promise<Record<string, unknown>> {
  const id = await resolvePetId(idArg);
  const pet = await loadPet(id);
  const nowIso = new Date().toISOString();
  const result = simulatePet(pet, includeReport ? resolveReportSimulationAt(pet, nowIso) : nowIso);
  await savePet(result.pet);
  const rendered = await renderStatusCard({ pet: result.pet, summary: formatCardSummary(result) });
  const currentDungeon = result.pet.hero.dungeon.currentDungeon;
  const currentRoom = currentDungeon?.rooms.find(room => room.id === currentDungeon.currentRoomId);

  const payload: Record<string, unknown> = {
    location: result.pet.hero.dungeon.location,
    village: result.pet.hero.dungeon.village,
    readiness: {
      score: villageReadinessScore(result.pet),
      label: villageReadinessLabel(villageReadinessScore(result.pet))
    },
    currentExpedition: result.pet.hero.dungeon.currentExpedition ?? null,
    expeditionHistory: result.pet.hero.dungeon.expeditionHistory.slice(-3),
    expeditionNarrative: result.pet.hero.dungeon.currentExpedition?.narrative ?? result.pet.hero.dungeon.expeditionHistory[result.pet.hero.dungeon.expeditionHistory.length - 1]?.narrative ?? null,
    id: result.pet.id,
    name: result.pet.name,
    species: result.pet.species,
    heroClass: result.pet.hero.classProgress.current,
    classUnlocked: result.pet.hero.classProgress.unlocked,
    skills: SKILLS[result.pet.hero.classProgress.current],
    level: result.pet.hero.level,
    exp: result.pet.hero.exp,
    expToNext: result.pet.hero.expToNext,
    gold: result.pet.hero.gold,
    dungeonFloor: result.pet.hero.dungeon.floor,
    deepestFloor: result.pet.hero.dungeon.deepestFloor,
    currentDungeon: currentDungeon
      ? {
          id: currentDungeon.id,
          name: currentDungeon.name,
          theme: currentDungeon.theme,
          description: currentDungeon.description,
          currentRoomId: currentDungeon.currentRoomId,
          discoveredRoomIds: currentDungeon.discoveredRoomIds,
          clearedRoomIds: currentDungeon.clearedRoomIds,
          rooms: currentDungeon.rooms,
          currentRoom,
          minimap: renderDungeonMinimap(currentDungeon),
          modifiers: currentDungeon.modifiers
        }
      : null,
    summary: result.summary,
    headline: formatHeadline(result),
    quickStatus: `${formatNeedSummary(result.pet)}；準備度 ${villageReadinessLabel(villageReadinessScore(result.pet))}`,
    narrationSeed: buildNarrationSeed(result),
    storyBeats: buildStoryBeats(result),
    recentTimeline: buildRecentTimeline(result),
    narrativeDigest: renderNarrativeDigest(result.pet.hero.dungeon.currentExpedition ?? result.pet.hero.dungeon.expeditionHistory[result.pet.hero.dungeon.expeditionHistory.length - 1] ?? null),
    riskSummary: summarizeRisk(result.pet).riskSummary,
    keyStats: buildKeyStats(result),
    mood: result.moodLabel,
    stage: result.stageLabel,
    imagePath: rendered.outputPath,
    needs: result.pet.needs,
    attributes: result.pet.hero.attributes,
    equipment: result.pet.hero.equipment,
    equipmentSummary: formatEquipmentSummary(result.pet),
    aptitude: result.pet.hero.classProgress.aptitude,
    events: result.events.slice(-5),
    adventures: result.pet.hero.adventureLog.slice(-3)
  };

  if (includeReport) payload.report = formatAdventureReport(result).join('\n');
  return payload;
}

export async function getMutationPayload(idArg: string | undefined, action: 'feed' | 'play' | 'clean'): Promise<Record<string, unknown>> {
  const id = await resolvePetId(idArg);
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  let actionText = '';
  if (action === 'feed') actionText = feedPet(result.pet);
  if (action === 'play') actionText = playWithPet(result.pet);
  if (action === 'clean') actionText = cleanPet(result.pet);
  await savePet(result.pet);
  const rendered = await renderStatusCard({ pet: result.pet, summary: actionText });
  return {
    id: result.pet.id,
    action,
    heroClass: result.pet.hero.classProgress.current,
    summary: actionText,
    imagePath: rendered.outputPath,
    needs: result.pet.needs,
    attributes: result.pet.hero.attributes,
    equipment: result.pet.hero.equipment,
    equipmentSummary: formatEquipmentSummary(result.pet),
    level: result.pet.hero.level,
    exp: result.pet.hero.exp,
    expToNext: result.pet.hero.expToNext
  };
}

export async function getInventoryPayload(idArg?: string): Promise<Record<string, unknown>> {
  const id = await resolvePetId(idArg);
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  await savePet(result.pet);
  return {
    id: result.pet.id,
    heroClass: result.pet.hero.classProgress.current,
    gold: result.pet.hero.gold,
    equipmentSummary: formatEquipmentSummary(result.pet),
    inventory: result.pet.hero.equipment.inventory,
    inventoryLines: listInventory(result.pet)
  };
}

export async function getSavesPayload(): Promise<Record<string, unknown>> {
  const saves = await listPetSaves();
  const chatPreferences = await loadChatPreferences();
  return {
    count: saves.length,
    defaultHeroId: chatPreferences.defaultHeroId ?? (saves.length === 1 ? saves[0].id : null),
    saves
  };
}

export async function equipInventoryItem(idArg: string | undefined, itemId: string): Promise<Record<string, unknown>> {
  const id = await resolvePetId(idArg);
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  const summary = equipItemById(result.pet, itemId);
  await savePet(result.pet);
  return {
    id: result.pet.id,
    summary,
    equippedItem: describeItem(result.pet.hero.equipment.inventory.find((item) => item.id === itemId)!),
    equipment: result.pet.hero.equipment,
    equipmentSummary: formatEquipmentSummary(result.pet),
    gold: result.pet.hero.gold
  };
}

export async function sellInventoryItem(idArg: string | undefined, itemId: string): Promise<Record<string, unknown>> {
  const id = await resolvePetId(idArg);
  const pet = await loadPet(id);
  const result = simulatePet(pet);
  const summary = sellItemById(result.pet, itemId);
  await savePet(result.pet);
  return {
    id: result.pet.id,
    summary,
    gold: result.pet.hero.gold,
    equipment: result.pet.hero.equipment,
    equipmentSummary: formatEquipmentSummary(result.pet),
    inventoryLines: listInventory(result.pet)
  };
}

export async function executeChatCommand(rawInput: string): Promise<Record<string, unknown>> {
  const intent = parseChatCommand(rawInput);

  if (intent.action === 'help') {
    return {
      mode: 'chat',
      rawInput,
      command: intent.action,
      message: formatChatHelp()
    };
  }

  if (intent.action === 'heroes') {
    const payload = await getSavesPayload();
    return {
      mode: 'chat',
      rawInput,
      command: intent.action,
      message: '可用角色如下，可搭配 /pet use HERO_ID 設成預設角色。',
      ...payload
    };
  }

  if (intent.action === 'use') {
    if (!intent.heroId) throw new Error('/pet use 需要 HERO_ID，例如 /pet use asaki');
    await loadPet(intent.heroId);
    await saveChatPreferences({ defaultHeroId: intent.heroId });
    return {
      mode: 'chat',
      rawInput,
      command: intent.action,
      defaultHeroId: intent.heroId,
      message: `之後會預設使用 ${intent.heroId}。`
    };
  }

  if (intent.action === 'status' || intent.action === 'report') {
    const payload = await getStatusPayload(intent.heroId, intent.action === 'report');
    return {
      mode: 'chat',
      rawInput,
      command: intent.action,
      message: typeof payload.headline === 'string' ? payload.headline : '角色近況如下。',
      ...payload
    };
  }

  if (intent.action === 'inventory') {
    const payload = await getInventoryPayload(intent.heroId);
    return {
      mode: 'chat',
      rawInput,
      command: intent.action,
      message: '背包與裝備如下。',
      ...payload
    };
  }

  if (intent.action === 'feed' || intent.action === 'play' || intent.action === 'clean') {
    const payload = await getMutationPayload(intent.heroId, intent.action);
    return {
      mode: 'chat',
      rawInput,
      command: intent.action,
      message: typeof payload.summary === 'string' ? payload.summary : '已完成互動。',
      ...payload
    };
  }

  throw new Error(`未知聊天指令動作: ${intent.action}`);
}
