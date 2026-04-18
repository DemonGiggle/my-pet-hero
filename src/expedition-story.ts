import { AdventureLog, DungeonInstance, DungeonRoom, ExpeditionNarrativeBeat, ExpeditionNarrativeState, ExpeditionSummary, PetState } from './types.js';
import { hashToUnit, pickOne } from './utils.js';

const GOAL_TEMPLATES = [
  {
    key: 'rescue',
    label: '尋人救援',
    motive: '要把失聯的人平安帶回村裡。',
    setup: ['失聯的斥候', '走散的採藥人', '被困的見習法師'],
    target: ['斥候', '採藥人', '見習法師'],
    clue: ['撕裂的披風碎片', '匆忙留下的腳印', '半張求援便條'],
    resolution: ['在封鎖門後找到生還者', '在核心房救出目標', '沿著最後線索接到求援者'],
    success: '目標被帶回村裡，這趟救援總算沒有白跑。',
    failure: '人沒有救回來，只帶回零碎線索與沉重消息。'
  },
  {
    key: 'retrieve',
    label: '取回遺物',
    motive: '要把村裡急需的物件帶回來。',
    setup: ['封印鑰匙', '祈雨聖杯', '老鐵匠的設計圖'],
    target: ['封印鑰匙', '祈雨聖杯', '設計圖'],
    clue: ['保護盒上的紋章', '殘留的搬運拖痕', '記錄位置的碎紙'],
    resolution: ['在上鎖祭壇取回物件', '在寶庫深處找到目標', '用先前線索打開收藏處'],
    success: '遺失物被完整帶回，村裡接下來終於能往前推。',
    failure: '東西還是沒找回，只能帶著不完整的情報撤退。'
  },
  {
    key: 'investigate',
    label: '調查異常',
    motive: '要查清楚地城失衡的來源。',
    setup: ['異常魔力波峰', '反覆響起的低鳴', '整層不自然的霜痕'],
    target: ['異常源頭', '共鳴節點', '污染核心'],
    clue: ['震盪紀錄', '牆面上的共鳴紋', '被改寫的警示牌'],
    resolution: ['在深處定位到源頭', '把分散的訊號拼成完整座標', '確認異常是由核心節點外洩造成'],
    success: '異常來源被確認，之後的行動終於有了方向。',
    failure: '異常還沒查清，這層留下的只有更多疑點。'
  },
  {
    key: 'rival',
    label: '搶先競逐',
    motive: '要趕在 rival 前先拿到成果。',
    setup: ['紅披風傭兵團', '另一組採集隊', '自稱專家的考察員'],
    target: ['紅披風隊', '採集隊', '考察員'],
    clue: ['搶先留下的營火灰', '對手刻下的方向記號', '被翻動過的補給箱'],
    resolution: ['在核心前追上對手', '利用早先痕跡抄近路超車', '在最後關頭先一步拿到成果'],
    success: '這趟競逐贏下來了，主動權還留在自己手上。',
    failure: '被 rival 搶先一步，這趟只能帶著懊惱回村。'
  }
] as const;

type GoalTemplate = typeof GOAL_TEMPLATES[number];

type CallbackTemplate = {
  key: string;
  setupPhase: 'setup' | 'turning-point';
  resolvePhase: 'turning-point' | 'climax' | 'return';
  title: string;
  setupText: (ctx: CallbackContext) => string;
  resolveText: (ctx: CallbackContext) => string;
  setupTags: string[];
  resolveTags: string[];
};

type CallbackContext = {
  expedition: ExpeditionSummary;
  room: DungeonRoom | undefined;
  log: AdventureLog;
};

const CALLBACK_TEMPLATES: CallbackTemplate[] = [
  {
    key: 'clue-trail',
    setupPhase: 'setup',
    resolvePhase: 'climax',
    title: '前段線索回收',
    setupText: ({ expedition, room }) => `在${room?.name ?? '前段通道'}找到 ${expedition.goal?.clueText ?? '零散線索'}，先記在心上。`,
    resolveText: ({ expedition, room }) => `${room?.name ?? '最深處'}讓先前的 ${expedition.goal?.clueText ?? '線索'} 對上了位置，目標終於露出真正輪廓。`,
    setupTags: ['callback-setup', 'goal-clue'],
    resolveTags: ['callback-resolved', 'goal-payoff']
  },
  {
    key: 'blocked-route',
    setupPhase: 'turning-point',
    resolvePhase: 'climax',
    title: '障礙與繞路',
    setupText: ({ room }) => `${room?.name ?? '岔路'}一度把主路封死，只能先記住這個卡點。`,
    resolveText: ({ room }) => `${room?.name ?? '終點前'}回頭兜上先前卡住的障礙，現在終於有能力把它解開。`,
    setupTags: ['callback-setup', 'blocked-route'],
    resolveTags: ['callback-resolved', 'route-cleared']
  },
  {
    key: 'ominous-sign',
    setupPhase: 'setup',
    resolvePhase: 'return',
    title: '不祥預兆成真',
    setupText: ({ room }) => `${room?.name ?? '入口'}留下的異常徵兆先壓在心底，像是在預告後段的代價。`,
    resolveText: ({ expedition }) => `回看整趟後才明白，先前那個不祥徵兆其實正指向 ${expedition.goal?.goalLabel ?? '這趟任務'} 的真正風險。`,
    setupTags: ['callback-setup', 'ominous-sign'],
    resolveTags: ['callback-resolved', 'aftershock']
  }
];

function goalTemplateFor(seed: string): GoalTemplate {
  return pickOne([...GOAL_TEMPLATES], hashToUnit(`${seed}:goal-template`));
}

function callbackTemplateFor(seed: string): CallbackTemplate {
  return pickOne([...CALLBACK_TEMPLATES], hashToUnit(`${seed}:callback-template`));
}

export function createExpeditionGoal(params: { pet: PetState; dungeon: DungeonInstance }): ExpeditionSummary['goal'] {
  const { pet, dungeon } = params;
  const template = goalTemplateFor(`${dungeon.seed}:${pet.id}`);
  const target = pickOne([...template.target], hashToUnit(`${dungeon.seed}:goal-target`));
  const setupSubject = pickOne([...template.setup], hashToUnit(`${dungeon.seed}:goal-setup`));
  const clueText = pickOne([...template.clue], hashToUnit(`${dungeon.seed}:goal-clue`));
  const resolutionText = pickOne([...template.resolution], hashToUnit(`${dungeon.seed}:goal-resolution`));
  const callback = callbackTemplateFor(`${dungeon.seed}:${template.key}`);
  return {
    key: template.key,
    goalLabel: template.label,
    motive: template.motive,
    target,
    setupText: `${setupSubject} 的任務線索把這趟探險釘成「${template.label}」。`,
    clueText,
    resolutionText,
    successSummary: template.success,
    failureSummary: template.failure,
    progress: 'active',
    callbacks: [
      {
        key: callback.key,
        title: callback.title,
        setupPhase: callback.setupPhase,
        resolvePhase: callback.resolvePhase,
        setupText: '',
        resolveText: '',
        setupResolvedAtRoomCount: 1,
        resolveAfterRoomCount: Math.max(2, dungeon.rooms.length - 1),
        status: 'pending'
      }
    ]
  };
}

export function applyExpeditionCallbacks(params: {
  expedition: ExpeditionSummary;
  log: AdventureLog;
  room?: DungeonRoom;
  phase: ExpeditionNarrativeBeat['phase'];
}): { expedition: ExpeditionSummary; extraBeats: ExpeditionNarrativeBeat[]; rewardNotes: string[] } {
  const { expedition, log, room, phase } = params;
  const goal = expedition.goal;
  if (!goal) return { expedition, extraBeats: [], rewardNotes: [] };

  const roomCount = log.runState?.clearedRoomIds?.length ?? expedition.roomsCleared ?? 0;
  const callbackTemplate = callbackTemplateFor(`${expedition.id}:${goal.key}`);
  const extraBeats: ExpeditionNarrativeBeat[] = [];
  const rewardNotes: string[] = [];

  const updatedCallbacks = goal.callbacks.map((callback) => {
    if (callback.status === 'pending' && roomCount >= callback.setupResolvedAtRoomCount && phase === callback.setupPhase) {
      const text = callbackTemplate.setupText({ expedition, room, log });
      extraBeats.push({
        at: log.at,
        phase: callback.setupPhase,
        title: callback.title,
        text,
        relatedRoomId: room?.id,
        relatedLogAt: log.at,
        stateTags: [...callbackTemplate.setupTags, goal.key]
      });
      rewardNotes.push(`任務線索：${goal.clueText}`);
      return { ...callback, setupText: text, status: 'seeded' as const };
    }

    if (callback.status === 'seeded' && roomCount >= callback.resolveAfterRoomCount && phase === callback.resolvePhase) {
      const text = callbackTemplate.resolveText({ expedition, room, log });
      extraBeats.push({
        at: log.at,
        phase: callback.resolvePhase,
        title: `${callback.title}回收`,
        text,
        relatedRoomId: room?.id,
        relatedLogAt: log.at,
        stateTags: [...callbackTemplate.resolveTags, goal.key]
      });
      rewardNotes.push(`回收前段伏筆：${goal.resolutionText}`);
      return { ...callback, resolveText: text, status: 'resolved' as const };
    }

    return callback;
  });

  let progress = goal.progress;
  if (expedition.completed) {
    progress = expedition.status === 'returned' ? 'resolved' : 'failed';
    rewardNotes.push(expedition.status === 'returned' ? `任務完成：${goal.successSummary}` : `任務失利：${goal.failureSummary}`);
  }

  return {
    expedition: {
      ...expedition,
      goal: {
        ...goal,
        progress,
        callbacks: updatedCallbacks
      }
    },
    extraBeats,
    rewardNotes
  };
}

export function buildGoalPremise(goal: ExpeditionSummary['goal'] | undefined): string {
  if (!goal) return '';
  return `這趟的任務主軸是${goal.goalLabel}，目標是 ${goal.target}，動機是${goal.motive}`;
}

export function summarizeGoal(goal: ExpeditionSummary['goal'] | undefined): string[] {
  if (!goal) return [];
  const lines = [
    `任務：${goal.goalLabel} / 目標 ${goal.target}`,
    `動機：${goal.motive}`,
    `線索：${goal.clueText}`,
    `進度：${goal.progress}`
  ];
  const pending = goal.callbacks.filter(item => item.status !== 'resolved');
  if (pending.length > 0) lines.push(`待回收伏筆：${pending.map(item => item.title).join('、')}`);
  return lines;
}
