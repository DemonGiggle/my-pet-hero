---
name: pet_image
description: Send the current My Pet Hero status image with optional `status|card` variant and hero id.
command-dispatch: tool
command-tool: my_pet_hero_pet
command-arg-mode: raw
---

# My Pet Hero image command

This skill exists so OpenClaw can register `/pet_image` as a native command and dispatch it directly to the `my_pet_hero_pet` tool.

## Input contract

Treat the raw tail after `/pet_image` as one of:

- empty -> current hero status image
- `HERO_ID` -> current hero status image for that hero
- `status [heroId]` -> explicit status-image variant
- `card [heroId]` -> reserved alias for future alternate card layouts, currently same render as `status`

## Presentation notes

- Attach the generated status image whenever `imagePath` is available.
- Keep the caption short and deterministic.
- Prefer this command when the user mainly wants the picture, not the full narrated `/pet` response.
