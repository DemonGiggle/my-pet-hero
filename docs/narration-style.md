# /pet narration style

This file defines the reproducible narration contract for My Pet Hero chat replies.

## Product goal

`/pet` should feel like a short fantasy status vignette, not a raw dashboard dump.

The game engine remains the source of truth for deterministic state, events, risk, and image output. OpenClaw can then package that payload into a concise, flavorful reply.

The desired result is:

- short
- vivid
- event-driven
- slightly fantastical
- not verbose
- not jokey
- not melodramatic
- not a spreadsheet

## Required reply shape

Default `/pet` replies should aim for three parts:

1. **Scene line**
   - one sentence
   - say where the hero is and what they are doing now
2. **Story beat**
   - one to three sentences
   - connect recent events into a tiny narrative arc
   - explain how those events changed the hero's current situation
3. **Judgment line**
   - one sentence
   - deliver a crisp narrator-style judgment about momentum, danger, readiness, or likely next step

When useful, attach a compact stat block after the narration.

## Story construction rules

Build the narration from recent events, not from isolated fields.

Priority order:

1. current location and current activity
2. current expedition progress or return state
3. latest 2-4 meaningful events
   - battle
   - elite or boss progress
   - trap or setback
   - level up
   - loot or gear change
   - village recovery activity
   - food, water, rest, preparation
4. current danger or momentum

Translate event sequences into cause and effect.

Examples:

- The hero rested, gathered rumors, and recovered enough readiness to return to the dungeon.
- The hero beat two rooms, took trap damage, changed armor, and is now strong in gear but weak in blood.
- The hero is safe in the village, but the unfinished expedition still hangs over them.

## Tone rules

Use:

- elegant Traditional Chinese
- light fantasy flavor
- short sensory texture when it helps
- calm narrator confidence

Avoid:

- modern dashboard phrasing
- excessive bullet spam
- jokes that break atmosphere
- overly poetic filler
- long explanations
- repeating numbers the image or stat block already shows

## Length rules

Default target:

- narration: 2-4 sentences total
- stat block: at most 5 compact lines when included
- total visible reply should usually fit on one phone screen with the image

## Stats policy

Do not lead with raw numbers unless the command is explicitly data-oriented.

For default `/pet`:

- mention only the most decision-relevant stats
- prefer risk-signaling stats such as HP, readiness, energy, hunger, thirst
- skip less important numbers when they do not change the story

For `/pet report`:

- allow a slightly richer write-up
- still preserve storytelling over report-dump formatting

## Image policy

Default `/pet` should attach the status image whenever available.

The image is part of the product experience, not an optional afterthought.

Preferred order:

1. image
2. short narration
3. optional compact stats

## Output contract guidance for integrations

When an OpenClaw integration or another wrapper consumes My Pet Hero output:

- treat the game payload as structured source material
- preserve `imagePath`
- narrate from `events`, `adventures`, `currentExpedition`, `village`, `headline`, `quickStatus`, and risk-relevant `needs`
- do not simply paste the entire raw JSON

## Reference examples

### Good

> kurami 躲在晨霧村的茶館角落收風，指尖還記著幾分開鎖時的俐落。
> 她先前連闖幽火墓園數房，還在支線裡換上新皮甲，只是陷阱與連戰也把血氣磨得單薄。墓園最深處只差最後一道門，眼下這更像蓄勢，不宜逞強。

### Good, lower intensity

> asaki 今晚留在村裡安靜整補，把散掉的節奏一點點收回來。
> 先前的探險沒有失手，還帶回一些戰果，所以現在的停步不是退縮，而是為下一趟下城留口氣。只要再補足精神與氣血，路就能續上。

### Bad

> 目前 HP 20，Energy 74，Readiness 58，currentExpedition 4/5。
> 有 village activity。
> 建議不要打 boss。

This is correct but lifeless.
