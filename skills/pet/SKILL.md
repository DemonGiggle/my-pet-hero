---
name: pet
description: Control My Pet Hero from chat with `/pet ...` commands like status, report, inventory, feed, play, clean, heroes, and use.
command-dispatch: tool
command-tool: my_pet_hero_pet
command-arg-mode: raw
---

# My Pet Hero chat skill

Use this skill when the user wants to control a My Pet Hero save from chat, especially through the direct `/pet` command.

## Input contract

- Treat the skill input as the raw tail after `/pet`.
- Examples:
  - `/pet` -> empty input
  - `/pet status` -> `status`
  - `/pet report asaki` -> `report asaki`
  - `/pet inventory` -> `inventory`

## Run path

1. Build the project first if `dist/cli.js` is missing or stale:
   - `npm run build`
2. Route chat input through the dedicated chat entrypoint:
   - with input: `node dist/cli.js chat --input "/pet <INPUT>"`
   - without input: `node dist/cli.js chat --input "/pet"`

Always pass the full `/pet ...` string into the `chat` command instead of reconstructing lower-level CLI flags by hand.

## Output handling

The command returns JSON. Prefer these fields in replies:

- `message`: compact reply text
- `headline`: short summary
- `report`: long-form adventure update when present
- `inventoryLines`: inventory bullets when present
- `imagePath`: optional status image path when present

## Notes

- `/pet use HERO_ID` stores the default hero in runtime state, outside the repo.
- If only one hero exists, My Pet Hero auto-selects it.
- If the command fails because the project is not built yet, run `npm run build` and retry.
