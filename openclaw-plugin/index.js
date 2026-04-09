import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Type } from '@sinclair/typebox';
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_NAME = 'my_pet_hero_pet';
const IMAGE_VARIANTS = new Set(['status', 'card']);
const MAX_BEATS = 3;
const MAX_TIMELINE = 4;

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolvePluginConfig(api) {
  const cfg = api.runtime?.pluginConfig ?? {};
  return {
    projectDir: asTrimmedString(cfg.projectDir),
    nodeBin: asTrimmedString(cfg.nodeBin) || process.execPath
  };
}

function resolveProjectDir(api) {
  const cfg = resolvePluginConfig(api);
  return cfg.projectDir || path.resolve(__dirname, '..');
}

async function assertBuiltProject(projectDir) {
  const cliPath = path.join(projectDir, 'dist', 'cli.js');
  await access(cliPath);
  return cliPath;
}

function normalizeRawPetCommand(raw) {
  const trimmed = asTrimmedString(raw);
  return trimmed ? `/pet ${trimmed}` : '/pet';
}

function parsePetImageRequest(raw) {
  const trimmed = asTrimmedString(raw);
  if (!trimmed) return { chatCommand: 'status', requestedVariant: 'status' };

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const [first = '', second = ''] = tokens;
  const firstLower = first.toLowerCase();

  if (IMAGE_VARIANTS.has(firstLower)) {
    return {
      chatCommand: second ? `status ${second}` : 'status',
      requestedVariant: firstLower
    };
  }

  return {
    chatCommand: `status ${trimmed}`,
    requestedVariant: 'status'
  };
}

function getString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatStatLine(label, value) {
  return `${label} ${value}`;
}

function formatKeyStats(payload) {
  const keyStats = getObject(payload?.keyStats);
  if (!keyStats) return '';

  const parts = [];
  if (typeof keyStats.health === 'number') parts.push(formatStatLine('HP', Math.round(keyStats.health)));
  if (typeof keyStats.energy === 'number') parts.push(formatStatLine('EN', Math.round(keyStats.energy)));
  if (typeof keyStats.readinessLabel === 'string' && typeof keyStats.readiness === 'number') {
    parts.push(`準備度 ${keyStats.readiness} (${keyStats.readinessLabel})`);
  }
  if (typeof keyStats.gold === 'number') parts.push(formatStatLine('Gold', keyStats.gold));
  if (typeof keyStats.exp === 'number' && typeof keyStats.expToNext === 'number') {
    parts.push(`EXP ${keyStats.exp}/${keyStats.expToNext}`);
  }

  return parts.length > 0 ? `✦ ${parts.join(' ・ ')}` : '';
}

function buildNarratedMessage(payload) {
  if (!payload || typeof payload !== 'object') return 'My Pet Hero command finished.';

  const command = getString(payload.command);
  const headline = getString(payload.headline);
  const quickStatus = getString(payload.quickStatus);
  const riskSummary = getString(payload.riskSummary);
  const report = getString(payload.report);
  const message = getString(payload.message);
  const narrationSeed = getObject(payload.narrationSeed);
  const storyBeats = getArray(payload.storyBeats)
    .map((item) => getString(item))
    .filter(Boolean)
    .slice(0, MAX_BEATS);
  const recentTimeline = getArray(payload.recentTimeline)
    .map((item) => getString(item))
    .filter(Boolean)
    .slice(0, MAX_TIMELINE);
  const imagePath = pickImagePath(payload);
  const pushUnique = (lines, value) => {
    const trimmed = getString(value);
    if (!trimmed) return;
    if (!lines.includes(trimmed)) lines.push(trimmed);
  };

  if (command === 'inventory') {
    const equipment = getArray(payload.equipmentSummary).map((item) => getString(item)).filter(Boolean);
    const inventoryLines = getArray(payload.inventoryLines).map((item) => getString(item)).filter(Boolean).slice(0, 4);
    const lines = [message || '背包與裝備如下。'];
    if (equipment.length > 0) lines.push(`裝備：${equipment.join(' / ')}`);
    if (inventoryLines.length > 0) lines.push(...inventoryLines);
    return lines.join('\n');
  }

  if (command === 'heroes') {
    const saves = getArray(payload.saves)
      .map((save) => getObject(save))
      .filter(Boolean)
      .map((save) => {
        const id = getString(save.id);
        const name = getString(save.name);
        const heroClass = getString(save.heroClass);
        return [name || id, heroClass].filter(Boolean).join('，');
      })
      .filter(Boolean);
    return [message || '可用角色如下。', ...saves.map((line) => `• ${line}`)].join('\n');
  }

  if (command === 'help' || command === 'use') {
    return message || headline || 'My Pet Hero command finished.';
  }

  if (command === 'feed' || command === 'play' || command === 'clean') {
    const lines = [message || '已完成互動。'];
    const stats = formatKeyStats(payload);
    if (stats) lines.push(stats);
    return lines.join('\n');
  }

  const scene = getString(narrationSeed?.scene);
  const momentum = getString(narrationSeed?.momentum);
  const lines = [];
  pushUnique(lines, headline || message || quickStatus);
  if (scene && scene !== headline) pushUnique(lines, scene);

  const beatLine = storyBeats
    .filter((beat) => beat !== scene && beat !== riskSummary)
    .join(' ');
  if (beatLine) pushUnique(lines, beatLine);
  else pushUnique(lines, momentum);

  if (recentTimeline.length > 0) {
    lines.push('最近動向:');
    for (const item of recentTimeline) lines.push(`• ${item}`);
  }

  pushUnique(lines, riskSummary);
  const stats = formatKeyStats(payload);
  if (stats) lines.push(stats);
  if (imagePath) lines.push(`圖卡：${imagePath}`);
  if (command === 'report' && report) lines.push(`\n${report}`);
  return lines.filter(Boolean).join('\n');
}

function pickImagePath(payload) {
  if (!payload || typeof payload !== 'object') return undefined;
  return typeof payload.imagePath === 'string' && payload.imagePath.trim() ? payload.imagePath.trim() : undefined;
}

async function runPetCommand(api, rawCommand) {
  const { nodeBin } = resolvePluginConfig(api);
  const projectDir = resolveProjectDir(api);
  const cliPath = await assertBuiltProject(projectDir);
  const input = normalizeRawPetCommand(rawCommand);
  const { stdout, stderr } = await execFileAsync(nodeBin, [cliPath, 'chat', '--input', input], {
    cwd: projectDir,
    env: process.env,
    maxBuffer: 1024 * 1024
  });

  const rawStdout = asTrimmedString(stdout);
  if (!rawStdout) {
    const errText = asTrimmedString(stderr);
    throw new Error(errText || 'My Pet Hero returned no output.');
  }

  let payload;
  try {
    payload = JSON.parse(rawStdout);
  } catch (error) {
    throw new Error(`My Pet Hero returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    payload,
    text: buildNarratedMessage(payload)
  };
}

function buildPetImageCaption(payload, requestedVariant) {
  if (!payload || typeof payload !== 'object') {
    return '寵物狀態圖已送達。';
  }

  const headline = getString(payload.headline);
  const quickStatus = getString(payload.quickStatus);
  const riskSummary = getString(payload.riskSummary);
  const imageLabel = requestedVariant === 'card' ? '狀態卡' : '狀態圖';
  const lines = [headline || `${imageLabel}已送達。`];
  if (quickStatus && quickStatus !== headline) lines.push(quickStatus);
  if (riskSummary) lines.push(riskSummary);
  return lines.join('\n');
}

export default definePluginEntry({
  id: 'my-pet-hero',
  name: 'My Pet Hero',
  description: 'Deterministic /pet command dispatch for My Pet Hero',
  register(api) {
    api.registerTool({
      name: TOOL_NAME,
      description: 'Execute deterministic My Pet Hero `/pet` chat commands such as status, report, inventory, feed, play, clean, heroes, and use.',
      parameters: Type.Object({
        command: Type.Optional(Type.String({ description: 'Raw arguments after /pet, for example `status`, `report asaki`, or `use asaki`.' })),
        commandName: Type.Optional(Type.String({ description: 'OpenClaw native command name. Provided automatically for skill command dispatch.' })),
        skillName: Type.Optional(Type.String({ description: 'Source skill name. Provided automatically for skill command dispatch.' }))
      }),
      async execute(_toolCallId, params) {
        const commandName = getString(params.commandName).toLowerCase();
        const isPetImageCommand = commandName === 'pet_image';
        const petImageRequest = isPetImageCommand ? parsePetImageRequest(params.command) : null;
        const { payload, text } = await runPetCommand(api, petImageRequest?.chatCommand ?? params.command);
        const imagePath = pickImagePath(payload);
        const mediaUrls = imagePath ? [imagePath] : undefined;
        const outputText = isPetImageCommand ? buildPetImageCaption(payload, petImageRequest?.requestedVariant) : text;
        return {
          text: outputText,
          mediaUrl: imagePath,
          mediaUrls,
          content: imagePath
            ? [{ type: 'text', text: outputText }, { type: 'image', image: imagePath }]
            : [{ type: 'text', text: outputText }],
          imagePath,
          details: {
            ...payload,
            commandAlias: isPetImageCommand ? 'pet_image' : null,
            requestedVariant: petImageRequest?.requestedVariant ?? null,
            imagePath: imagePath ?? payload?.imagePath ?? null,
            text: outputText,
            mediaUrl: imagePath ?? null,
            mediaUrls: mediaUrls ?? null
          }
        };
      }
    }, { optional: true });
  }
});
