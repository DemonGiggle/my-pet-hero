import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_DATA_DIR, ensureDataDir } from './state.js';

export interface ChatPreferenceState {
  defaultHeroId?: string;
  updatedAt?: string;
}

export interface ChatCommandIntent {
  namespace: 'pet';
  action: 'help' | 'status' | 'report' | 'inventory' | 'feed' | 'play' | 'clean' | 'heroes' | 'use';
  heroId?: string;
  raw: string;
  tokens: string[];
}

const CHAT_STATE_FILE = 'chat-preferences.json';

function tokenize(input: string): string[] {
  return Array.from(input.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g), (match) => match[1] ?? match[2] ?? match[3]);
}

export function parseChatCommand(input: string): ChatCommandIntent {
  const normalized = input.trim();
  const tokens = tokenize(normalized);
  if (tokens.length === 0) {
    return { namespace: 'pet', action: 'help', raw: input, tokens: [] };
  }

  const [first, second, ...rest] = tokens;
  const namespace = first.replace(/^\//, '').toLowerCase();
  if (namespace !== 'pet') {
    throw new Error('聊天指令要用 /pet 開頭，例如 /pet status。');
  }

  const command = (second ?? 'status').toLowerCase();
  const firstArg = rest[0];

  if (command === 'help') return { namespace: 'pet', action: 'help', raw: input, tokens };
  if (command === 'status') return { namespace: 'pet', action: 'status', heroId: firstArg, raw: input, tokens };
  if (command === 'report') return { namespace: 'pet', action: 'report', heroId: firstArg, raw: input, tokens };
  if (command === 'inventory' || command === 'inv' || command === 'bag') {
    return { namespace: 'pet', action: 'inventory', heroId: firstArg, raw: input, tokens };
  }
  if (command === 'feed' || command === 'play' || command === 'clean') {
    return { namespace: 'pet', action: command, heroId: firstArg, raw: input, tokens };
  }
  if (command === 'heroes' || command === 'saves' || command === 'list') {
    return { namespace: 'pet', action: 'heroes', raw: input, tokens };
  }
  if (command === 'use' || command === 'hero' || command === 'default') {
    return { namespace: 'pet', action: 'use', heroId: firstArg, raw: input, tokens };
  }

  throw new Error(`不認得的聊天指令: ${command}。可用 /pet help 查看支援列表。`);
}

function chatStatePath(dataDir = DEFAULT_DATA_DIR): string {
  return path.join(path.dirname(dataDir), CHAT_STATE_FILE);
}

export async function loadChatPreferences(dataDir = DEFAULT_DATA_DIR): Promise<ChatPreferenceState> {
  const resolvedDataDir = await ensureDataDir(dataDir);
  const filePath = chatStatePath(resolvedDataDir);
  try {
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as ChatPreferenceState;
    return typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    return {};
  }
}

export async function saveChatPreferences(preferences: ChatPreferenceState, dataDir = DEFAULT_DATA_DIR): Promise<void> {
  const resolvedDataDir = await ensureDataDir(dataDir);
  const filePath = chatStatePath(resolvedDataDir);
  await writeFile(filePath, JSON.stringify({ ...preferences, updatedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');
}

export function formatChatHelp(): string {
  return [
    'My Pet Hero chat commands:',
    '/pet status [heroId]    快速狀態',
    '/pet report [heroId]    詳細近況',
    '/pet inventory [heroId] 背包與裝備',
    '/pet feed [heroId]      餵食',
    '/pet play [heroId]      玩耍',
    '/pet clean [heroId]     清潔',
    '/pet heroes             列出角色',
    '/pet use HERO_ID        設定預設角色',
    '/pet help               顯示這份說明'
  ].join('\n');
}
