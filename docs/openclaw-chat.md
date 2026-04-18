# OpenClaw chat routing

My Pet Hero now exposes both:

- a reusable `chat` CLI entrypoint for slash-style commands
- `openclaw-plugin/`, the preferred OpenClaw integration, which ships a deterministic tool plus `pet` and `pet_image` skills wired with `command-dispatch: tool`
- the older standalone `skills/pet/` skill, which still works for prompt-based routing

The intent is that OpenClaw can register `/pet` and `/pet_image` itself, then hand the rest of the message to My Pet Hero as subcommands.

## How native `/pet` registration works

### Preferred path: deterministic tool dispatch

OpenClaw native skill commands can dispatch directly to a tool when the skill frontmatter declares:

- `command-dispatch: tool`
- `command-tool: my_pet_hero_pet`
- `command-arg-mode: raw`

The `openclaw-plugin/` package ships the tool portion of that combination, and the skill can come from either the plugin bundle or the workspace mirror:

1. a skill directory named `openclaw-plugin/skills/pet/` or `~/.openclaw/workspace/skills/pet/`
2. `SKILL.md` frontmatter with `name: pet`, `command-dispatch: tool`, `command-tool: my_pet_hero_pet`, and `command-arg-mode: raw`
3. a registered tool named `my_pet_hero_pet`
4. OpenClaw command registration enabled (`commands.native` and `commands.nativeSkills`, or the Telegram-specific overrides left at `auto`/`true`)

With that in place, OpenClaw registers `/pet` with Telegram as a real bot command, instead of relying only on text parsing, and the command can execute without routing through the model.

The raw tail after `/pet` becomes the tool input:

- `/pet` -> empty input
- `/pet status` -> `status`
- `/pet report asaki` -> `report asaki`

The tool then routes that input into:

```bash
node dist/cli.js chat --input "/pet ..."
```

That keeps one canonical parser for both direct CLI use and deterministic bot-command use.

## Install / enable in OpenClaw

Preferred local install:

```bash
cd /path/to/my-pet-hero
npm run build
openclaw plugins install ./openclaw-plugin
```

This gives OpenClaw the deterministic tool. The matching `/pet` and `/pet_image` skills can come from the bundled plugin skills or the workspace mirrors.

If you keep a workspace-visible `skills/pet/`, make sure it uses the deterministic tool-dispatch frontmatter. Avoid the old skill-only prompt route.

Then make sure native skill commands are enabled. The default OpenClaw config is usually already enough:

```json5
{
  commands: {
    native: "auto",
    nativeSkills: "auto"
  },
  channels: {
    telegram: {
      commands: {
        native: "auto",
        nativeSkills: "auto"
      }
    }
  }
}
```

After restarting the gateway, Telegram should show `/pet` and `/pet_image` in the bot command menu.

## BotFather / admin notes

No separate BotFather command wiring is needed when OpenClaw native commands are enabled. OpenClaw performs the Telegram command registration.

If `/pet` or `/pet_image` does not appear, check:

- the `my-pet-hero` plugin is installed and enabled
- the optional tool `my_pet_hero_pet` is allowed by tool policy when needed
- `commands.nativeSkills` is not disabled globally or for Telegram
- the gateway restarted cleanly after the plugin became available

### Legacy skill-only install

If you only want the older prompt-routed skill:

```bash
mkdir -p ~/.openclaw/workspace/skills
ln -s /path/to/my-pet-hero/skills/pet ~/.openclaw/workspace/skills/pet
```

That still makes `/pet` eligible for native registration, but it does not provide deterministic tool dispatch.

## Goal

Let OpenClaw or any bot-like wrapper send concise commands such as `/pet status` instead of reconstructing full CLI arguments every time.

For image-first flows, `/pet_image` is the dedicated native command. It reuses the same deterministic tool, maps to `/pet status ...` under the hood, and returns a shorter caption with the status card attached.

## Entry point

```bash
node dist/cli.js chat --input "/pet status"
```

The command returns JSON with a compact top-level `message` plus the richer game payload.

For reproducible presentation quality across OpenClaw clones, treat the CLI payload as two layers:

- deterministic game output
- presentation-facing narration scaffolding

Key wrapper-facing fields now include:

- `message`
- `headline`
- `quickStatus`
- `imagePath`
- `narrationSeed`
- `storyBeats`
- `riskSummary`
- `keyStats`

See `docs/chat-output-contract.md` and `docs/narration-style.md` for the portable presentation contract.

## Supported commands

- `/pet status [heroId]`
- `/pet report [heroId]`
- `/pet inventory [heroId]`
- `/pet feed [heroId]`
- `/pet play [heroId]`
- `/pet clean [heroId]`
- `/pet checkpoint [heroId]`
- `/pet_image [heroId]`
- `/pet_image status [heroId]`
- `/pet_image card [heroId]`
- `/pet heroes`
- `/pet use HERO_ID`
- `/pet help`

## Suggested OpenClaw usage

When the user sends one of the supported slash commands, call My Pet Hero like this:

```bash
node dist/cli.js chat --input "$USER_MESSAGE"
```

Then map the JSON fields roughly as follows:

- `message`: deterministic fallback line
- `headline`: short status summary
- `quickStatus`: deterministic condition summary
- `report`: long-form adventure update
- `inventoryLines`: inventory bullets
- `imagePath`: status card image, attach by default when present
- `narrationSeed`: compact scene / arc / danger / momentum hints for packaging
- `storyBeats`: filtered recent developments for storytelling
- `riskSummary`: concise warning or momentum judgment
- `keyStats`: compact decision-relevant stats

Recommended wrapper behavior for default `/pet`:

1. attach the image when possible
2. write a short fantasy-flavored narration from `narrationSeed` and `storyBeats`
3. optionally include a compact stat block from `keyStats`
4. avoid dumping the raw JSON or turning the reply into a dashboard

## Default hero behavior

- If only one hero exists, it is used automatically.
- `/pet use HERO_ID` stores the selection in runtime state as `chat-preferences.json`.
- The preference is outside the repo, so it is user-local and safe to ship.

## Validation notes

The most useful local checks are:

```bash
npm run build
npm run validate:chat
openclaw skills list
```

For the plugin path, you can also verify the plugin and tool are visible:

```bash
openclaw plugins list
```

If the `pet` skill is visible to OpenClaw and native skill commands are enabled, `/pet` becomes eligible for Telegram command registration at gateway startup.

## Privacy / portability notes

- No hardcoded machine-specific paths are embedded in the feature.
- Preferences live under the same runtime state directory pattern as saves.
- No secrets, tokens, or personal sample data are required.
