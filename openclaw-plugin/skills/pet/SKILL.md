---
name: pet
description: Control My Pet Hero from chat with `/pet ...` commands like status, report, inventory, feed, play, clean, heroes, and use.
command-dispatch: tool
command-tool: my_pet_hero_pet
command-arg-mode: raw
---

# My Pet Hero deterministic command skill

This skill exists so OpenClaw can register `/pet` as a native command and dispatch it directly to the `my_pet_hero_pet` tool without routing through the model.

For user-visible presentation, treat My Pet Hero as the deterministic source of truth and package its payload with these rules:

- Attach the generated status image whenever `imagePath` is available.
- Read `narrationSeed`, `storyBeats`, `riskSummary`, `keyStats`, `headline`, and `quickStatus` before free-form summarizing.
- Write in concise Traditional Chinese with light fantasy flavor.
- Turn the recent event chain into a tiny story, not a dashboard dump.
- Usually keep the reply to 2-4 narration sentences plus a compact stat block.
- End with a crisp narrator-style judgment about danger, readiness, or momentum.
- Avoid long bullet lists unless the command is explicitly inventory-oriented.

Examples:
- `/pet`
- `/pet status`
- `/pet report asaki`
- `/pet inventory`
- `/pet use asaki`
