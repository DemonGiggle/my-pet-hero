# OpenClaw chat routing

My Pet Hero now exposes both:

- a reusable `chat` CLI entrypoint for slash-style commands
- `openclaw-plugin/`, the preferred OpenClaw integration, which ships a deterministic tool plus a `pet` skill wired with `command-dispatch: tool`
- the older standalone `skills/pet/` skill, which still works for prompt-based routing

The intent is that OpenClaw can register `/pet` itself, then hand the rest of the message to My Pet Hero as subcommands.

## How native `/pet` registration works

### Preferred path: deterministic tool dispatch

OpenClaw native skill commands can dispatch directly to a tool when the skill frontmatter declares:

- `command-dispatch: tool`
- `command-tool: my_pet_hero_pet`
- `command-arg-mode: raw`

The `openclaw-plugin/` package ships exactly that combination:

1. a skill directory named `openclaw-plugin/skills/pet/`
2. `SKILL.md` frontmatter with `name: pet`
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

This gives OpenClaw both the tool and the skill it needs for deterministic `/pet` dispatch.

Legacy skill-only install is still possible by copying or symlinking `skills/pet/` into an OpenClaw-visible skills directory, but that is not the deterministic path.

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

After restarting the gateway, Telegram should show `/pet` in the bot command menu.

## BotFather / admin notes

No separate BotFather command wiring is needed when OpenClaw native commands are enabled. OpenClaw performs the Telegram command registration.

If `/pet` does not appear, check:

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

## Entry point

```bash
node dist/cli.js chat --input "/pet status"
```

The command returns JSON with a compact top-level `message` plus the richer game payload.

## Supported commands

- `/pet status [heroId]`
- `/pet report [heroId]`
- `/pet inventory [heroId]`
- `/pet feed [heroId]`
- `/pet play [heroId]`
- `/pet clean [heroId]`
- `/pet heroes`
- `/pet use HERO_ID`
- `/pet help`

## Suggested OpenClaw usage

When the user sends one of the supported slash commands, call My Pet Hero like this:

```bash
node dist/cli.js chat --input "$USER_MESSAGE"
```

Then map the JSON fields roughly as follows:

- `message`: first reply line
- `headline`: short status summary
- `report`: long-form adventure update
- `inventoryLines`: inventory bullets
- `imagePath`: optional status card image

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
