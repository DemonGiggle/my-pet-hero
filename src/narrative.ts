import { AdventureLog, DungeonInstance, DungeonModifier, DungeonRoom, ExpeditionNarrativeBeat, ExpeditionNarrativeState, ExpeditionSummary, PetState } from './types.js';
import { buildGoalPremise, summarizeGoal } from './expedition-story.js';

function clampNarrativeTension(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roomTypeLabel(room: DungeonRoom): string {
  const mapping: Record<DungeonRoom['type'], string> = {
    entrance: '入口',
    battle: '戰鬥房',
    elite: '精英房',
    treasure: '藏寶房',
    event: '事件房',
    rest: '休息點',
    shop: '補給點',
    boss: '核心深處'
  };
  return mapping[room.type];
}

function trapKindLabel(kind?: AdventureLog['trap'] extends { kind: infer T } ? T : string): string {
  const mapping: Record<string, string> = {
    spike: '尖刺',
    'poison-dart': '毒箭',
    'arcane-surge': '奧術亂流',
    'ember-floor': '灼燼地板',
    'bone-snare': '骨索陷阱'
  };
  return kind ? mapping[kind] ?? kind : '陷阱';
}

function arcFromTension(tension: number): ExpeditionNarrativeState['arc'] {
  if (tension >= 80) return 'perilous';
  if (tension >= 55) return 'pressing';
  if (tension <= 25) return 'resolving';
  return 'fresh';
}

function conditionFromPet(pet: PetState): ExpeditionNarrativeState['partyCondition'] {
  const health = pet.needs.health;
  const energy = pet.needs.energy;
  if (health <= 25 || energy <= 20) return 'critical';
  if (health <= 45 || energy <= 35) return 'frayed';
  if (health <= 65 || energy <= 55) return 'strained';
  return 'steady';
}

function modifierMood(modifiers: DungeonModifier[]): string {
  if (modifiers.length === 0) return '地城本身還算安靜';
  return `一路都籠著${modifiers.map(modifier => modifier.label).join('、')}的氣味`;
}

export function createExpeditionNarrative(params: { pet: PetState; dungeon: DungeonInstance; expedition?: ExpeditionSummary }): ExpeditionNarrativeState {
  const { pet, dungeon, expedition } = params;
  const goalPremise = buildGoalPremise(expedition?.goal);
  return {
    premise: `${pet.name} 走進 ${dungeon.name}，${dungeon.description}${modifierMood(dungeon.modifiers)}。${goalPremise ? ` ${goalPremise}。` : ''}`,
    tension: 28,
    arc: 'fresh',
    partyCondition: conditionFromPet(pet),
    beats: [
      {
        at: new Date().toISOString(),
        phase: 'setup',
        title: expedition?.goal ? `踏入地城，背著${expedition.goal.goalLabel}` : '踏入地城',
        text: expedition?.goal
          ? `${pet.name} 才剛跨過 ${dungeon.name} 的入口，就先把「${expedition.goal.goalLabel}」這條主線牢牢記住，準備順著 ${expedition.goal.clueText} 往下查。`
          : `${pet.name} 才剛跨過 ${dungeon.name} 的入口，先把呼吸與步伐收穩，準備摸清這趟的節奏。`,
        relatedRoomId: dungeon.rooms[0]?.id,
        stateTags: [dungeon.theme, 'expedition-start', ...(expedition?.goal ? ['goal-active', expedition.goal.key] : []), ...(dungeon.modifiers.map(modifier => modifier.key))]
      }
    ],
    latestBeat: undefined
  };
}

function buildBeatFromLog(log: AdventureLog, expedition: ExpeditionSummary, pet: PetState): ExpeditionNarrativeBeat {
  const roomName = log.roomName ?? '未知房間';
  const stateTags = [log.outcome, log.roomType ?? 'unknown'];
  if (log.trap?.triggered) stateTags.push('trap-hit', trapKindLabel(log.trap.kind));
  if (log.trap && !log.trap.triggered) stateTags.push('trap-avoided');
  if (log.rewards?.some(reward => reward.includes('升到 Lv.'))) stateTags.push('level-up');
  if (log.rewards?.some(reward => reward.includes('掉落：'))) stateTags.push('loot');
  if (log.roomType === 'boss') stateTags.push('boss-room');
  if (log.routeChoice && log.routeChoice.reason.includes('支線')) stateTags.push('branch-route');

  if (log.roomType === 'boss' || expedition.bossDefeated || log.runState?.completedDungeon) {
    return {
      at: log.at,
      phase: 'climax',
      title: `最深處見真章`,
      text: `${pet.name} 在 ${roomName} 把這趟最沉的壓力正面接下，${log.text}`,
      relatedRoomId: log.routeChoice?.toRoomId,
      relatedLogAt: log.at,
      stateTags
    };
  }

  if (log.trap?.triggered || (log.roomEffect?.health ?? 0) < -12 || (log.roomEffect?.energy ?? 0) < -18) {
    return {
      at: log.at,
      phase: 'escalation',
      title: `壓力開始反咬`,
      text: `${roomName} 沒讓人輕鬆通過，${log.trap?.triggered ? `${trapKindLabel(log.trap.kind)}先咬了一口，` : ''}${log.text}`,
      relatedRoomId: log.routeChoice?.fromRoomId,
      relatedLogAt: log.at,
      stateTags
    };
  }

  if (log.outcome === 'treasure' || log.roomType === 'event' || (log.rewards?.length ?? 0) >= 3) {
    return {
      at: log.at,
      phase: 'turning-point',
      title: `意外的線索與收穫`,
      text: `${pet.name} 在 ${roomName} 把局面往自己這邊扳了一點，${log.text}`,
      relatedRoomId: log.routeChoice?.fromRoomId,
      relatedLogAt: log.at,
      stateTags
    };
  }

  if (expedition.completed) {
    return {
      at: log.at,
      phase: 'return',
      title: '帶著餘波回村',
      text: `${pet.name} 把這趟在 ${roomName} 累積的勝負與疲意一起帶回村裡。`,
      relatedLogAt: log.at,
      stateTags
    };
  }

  return {
    at: log.at,
    phase: 'turning-point',
    title: `把路往前推了一格`,
    text: `${pet.name} 穿過 ${roomName}，${log.text}`,
    relatedRoomId: log.routeChoice?.fromRoomId,
    relatedLogAt: log.at,
    stateTags
  };
}

export function appendNarrativeBeat(params: { expedition: ExpeditionSummary; log: AdventureLog; pet: PetState }): ExpeditionNarrativeState {
  const { expedition, log, pet } = params;
  const previous = expedition.narrative ?? createExpeditionNarrative({ pet, dungeon: { ...pet.hero.dungeon.currentDungeon!, rooms: pet.hero.dungeon.currentDungeon!.rooms } });
  const tensionDelta =
    (log.trap?.triggered ? 14 : 0) +
    (log.roomType === 'elite' ? 10 : 0) +
    (log.roomType === 'boss' ? 18 : 0) +
    ((log.roomEffect?.health ?? 0) < -10 ? 10 : 0) +
    ((log.roomEffect?.energy ?? 0) < -15 ? 8 : 0) -
    (log.outcome === 'rest' ? 12 : 0) -
    (log.outcome === 'treasure' ? 4 : 0) -
    (log.runState?.completedDungeon ? 18 : 0);
  const tension = clampNarrativeTension((previous.tension ?? 30) + tensionDelta);
  const beat = buildBeatFromLog(log, expedition, pet);
  const beats = [...(previous.beats ?? []), beat].slice(-10);
  return {
    premise: previous.premise,
    tension,
    arc: expedition.completed ? 'resolving' : arcFromTension(tension),
    partyCondition: conditionFromPet(pet),
    latestBeat: beat,
    beats
  };
}

function conditionLine(condition: ExpeditionNarrativeState['partyCondition']): string {
  switch (condition) {
    case 'critical': return '人還撐著，但已經逼近極限';
    case 'frayed': return '身心都被磨出裂痕';
    case 'strained': return '還能推進，只是得開始算代價';
    default: return '節奏還穩，手感沒有散掉';
  }
}

function tensionLine(arc: ExpeditionNarrativeState['arc']): string {
  switch (arc) {
    case 'perilous': return '整趟已經進入最危險的段落';
    case 'pressing': return '壓力正一層層往上加';
    case 'resolving': return '局勢開始收束，餘波比正面衝突更明顯';
    default: return '目前仍在鋪陳與試探的前段';
  }
}

export function renderNarrativeDigest(expedition?: ExpeditionSummary | null): string[] {
  if (!expedition?.narrative) return [];
  const narrative = expedition.narrative;
  const beats = narrative.beats.slice(-3);
  const lines = [
    `【本趟故事線】${narrative.premise}`,
    `【敘事張力】${narrative.tension}/100，${tensionLine(narrative.arc)}，${conditionLine(narrative.partyCondition)}。`
  ];
  lines.push(...summarizeGoal(expedition.goal).map(line => `【任務主線】${line}`));
  if (beats.length > 0) {
    lines.push('【關鍵轉折】');
    for (const beat of beats) {
      lines.push(`- ${beat.title}：${beat.text}`);
    }
  }
  return lines;
}

export function buildExpeditionStorySummary(expedition?: ExpeditionSummary | null): string[] {
  if (!expedition?.narrative) return [];
  const latest = expedition.narrative.latestBeat;
  const lines = [] as string[];
  if (latest) lines.push(`${latest.title}，${latest.text}`);
  const previous = expedition.narrative.beats.slice(-3, -1);
  for (const beat of previous) lines.push(`${beat.title}，${beat.text}`);
  return lines;
}
