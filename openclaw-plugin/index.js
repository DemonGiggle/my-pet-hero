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

function pickMessage(payload) {
  if (!payload || typeof payload !== 'object') return 'My Pet Hero command finished.';
  const candidates = [payload.message, payload.report, payload.headline];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return JSON.stringify(payload, null, 2);
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
    text: pickMessage(payload)
  };
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
        const { payload, text } = await runPetCommand(api, params.command);
        return {
          content: [{ type: 'text', text }],
          details: payload
        };
      }
    }, { optional: true });
  }
});
