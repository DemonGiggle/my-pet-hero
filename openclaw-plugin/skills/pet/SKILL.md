---
name: pet
description: Control My Pet Hero from chat with `/pet ...` commands like status, report, inventory, feed, play, clean, heroes, and use.
command-dispatch: tool
command-tool: my_pet_hero_pet
command-arg-mode: raw
---

# My Pet Hero deterministic command skill

This skill exists so OpenClaw can register `/pet` as a native command and dispatch it directly to the `my_pet_hero_pet` tool without routing through the model.

Examples:
- `/pet`
- `/pet status`
- `/pet report asaki`
- `/pet inventory`
- `/pet use asaki`
