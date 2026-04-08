# OpenClaw chat routing

My Pet Hero now exposes both:

- a reusable `chat` CLI entrypoint for slash-style commands
- an OpenClaw skill named `pet`, so `/pet` can be registered as a real native bot command on Telegram and other supported surfaces

The intent is that OpenClaw can register `/pet` itself, then hand the rest of the message to My Pet Hero as subcommands.

## How native `/pet` registration works

OpenClaw already supports native skill-command registration. The matching pieces are:

1. a skill directory named `skills/pet/`
2. `SKILL.md` frontmatter with `name: pet`
3. OpenClaw command registration enabled (`commands.native` and `commands.nativeSkills`, or the Telegram-specific overrides left at `auto`/`true`)

With that in place, OpenClaw registers `/pet` with Telegram as a real bot command, instead of relying only on text parsing.

The skill input becomes the raw tail after `/pet`:

- `/pet` -> empty input
- `/pet status` -> `status`
- `/pet report asaki` -> `report asaki`

The skill then routes that input into:

```bash
node dist/cli.js chat --input "/pet ..."
```

That keeps one canonical parser for both direct CLI use and bot-command use.

## Install / enable in OpenClaw

For local development, install the repo skill into an OpenClaw-visible skills directory, for example by copying or symlinking `skills/pet/` into your workspace `skills/` folder.

Example:

```bash
mkdir -p ~/.openclaw/workspace/skills
ln -s /path/to/my-pet-hero/skills/pet ~/.openclaw/workspace/skills/pet
```

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

- the `pet` skill is installed in an OpenClaw-visible skills directory
- `commands.nativeSkills` is not disabled globally or for Telegram
- the gateway restarted cleanly after the skill became available

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

If the `pet` skill is visible to OpenClaw and native skill commands are enabled, `/pet` becomes eligible for Telegram command registration at gateway startup.

## Privacy / portability notes

- No hardcoded machine-specific paths are embedded in the feature.
- Preferences live under the same runtime state directory pattern as saves.
- No secrets, tokens, or personal sample data are required.
