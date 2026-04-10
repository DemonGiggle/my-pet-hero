# /pet chat output contract

This file defines the reproducible output contract for My Pet Hero chat integrations, especially OpenClaw.

## Goal

A clone of this repository should be able to reproduce the intended `/pet` experience with minimal guesswork.

That experience is:

- deterministic game state generation
- reproducible status image rendering
- structured raw payload for wrappers
- short fantasy-flavored narration layered on top of the raw payload

## Layers

### Layer 1: deterministic game output

My Pet Hero CLI remains the source of truth.

`chat --input "/pet ..."` must return structured JSON that wrappers can depend on.

### Layer 2: presentation wrapper

OpenClaw or another wrapper may transform the JSON into a polished user-visible reply.

This presentation layer should:

- attach the generated image when available
- narrate based on the structured payload
- stay faithful to the deterministic data

## Required fields for `/pet status` and `/pet report`

The payload should expose at least:

- `message`
- `headline`
- `quickStatus`
- `imagePath`
- `narrationSeed`
- `storyBeats`
- `riskSummary`
- `keyStats`
- `events`
- `adventures`
- `currentExpedition`
- `village`

## Field semantics

### `message`
Compact deterministic first-line summary suitable for non-narrated or fallback environments.

### `headline`
Short human-readable state line.

### `quickStatus`
Compact deterministic condition summary.

### `imagePath`
Local render path for the latest status image.

### `narrationSeed`
A compact structured object intended for wrappers to build polished narration without mining the entire payload ad hoc.

Suggested shape:

```json
{
  "scene": "現在在哪裡、正在做什麼",
  "storyArc": "近況核心變化",
  "danger": "目前最大風險",
  "momentum": "目前節奏或氣勢",
  "recommendedFocus": "回覆時最值得提的焦點"
}
```

### `storyBeats`
Ordered short lines describing the most important recent developments. These should already be filtered for significance.

### `riskSummary`
A short deterministic warning or readiness assessment.

### `keyStats`
Only the small subset of stats that matter for chat presentation.

Suggested shape:

```json
{
  "health": 20,
  "energy": 74.2,
  "readiness": 58,
  "readinessLabel": "勉強能上",
  "gold": 28,
  "exp": 30,
  "expToNext": 52
}
```

## Reply expectations for wrappers

### Default `/pet`

Expected wrapper behavior:

1. attach the image from `imagePath` when possible
2. write a short narrated vignette using `narrationSeed` and `storyBeats`
3. include a compact stat block only if it helps decision-making

### `/pet report`

Expected wrapper behavior:

1. attach the image when available
2. allow a slightly richer story summary
3. treat the report as an RPG-style log or storyteller recap, not just a longer status line
4. include meaningful recent activity progression when available, especially village activities, expedition progress, and combat outcomes
5. when combat history is available in the payload, do not silently omit it from the report-oriented presentation
6. still avoid raw JSON or long dashboard formatting

## Portability requirement

The repo must contain enough documentation and structured output guidance so another OpenClaw setup can reproduce the intended behavior after clone + build + install.

Narration and report behavior that materially shapes the product experience must live in this repo, not only in local memory, private prompt tweaks, or one-off operator habits.

Do not rely on hidden local prompt tweaks as the primary source of truth.
