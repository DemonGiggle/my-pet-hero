---
name: pet_image
description: Send the current My Pet Hero status image with optional `status|card` variant and hero id.
command-dispatch: tool
command-tool: my_pet_hero_pet
command-arg-mode: raw
---

# My Pet Hero deterministic image command skill

Use this skill to expose the live `/pet_image` command through OpenClaw while routing image generation into the real My Pet Hero project.

## Input contract

Treat the skill input as the raw tail after `/pet_image`.

Examples:
- `/pet_image` -> empty input
- `/pet_image asaki` -> `asaki`
- `/pet_image status asaki` -> `status asaki`
- `/pet_image card` -> `card`

## Deterministic run path

This skill expects the `my_pet_hero_pet` tool to be available, typically from the My Pet Hero OpenClaw plugin in:

- `/home/gigo/.openclaw/projects/my-pet-hero/openclaw-plugin`

The tool maps `/pet_image ...` to the canonical chat entrypoint underneath:

```bash
node dist/cli.js chat --input "/pet status ..."
```

## Presentation rules

- attach `imagePath` whenever available
- keep the caption concise and deterministic
- `card` is currently an alias of `status`, reserved for future alternate image layouts
