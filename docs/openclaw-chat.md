# OpenClaw chat routing

My Pet Hero now exposes a reusable `chat` CLI entrypoint for slash-style commands.

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

## Privacy / portability notes

- No hardcoded machine-specific paths are embedded in the feature.
- Preferences live under the same runtime state directory pattern as saves.
- No secrets, tokens, or personal sample data are required.
