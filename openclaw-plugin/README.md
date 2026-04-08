# My Pet Hero OpenClaw plugin

This plugin gives OpenClaw a deterministic `my_pet_hero_pet` tool and a native `/pet` skill command that dispatches straight to that tool.

## What it does

- registers tool: `my_pet_hero_pet`
- ships skill: `pet`
- skill frontmatter uses `command-dispatch: tool`
- native `/pet` can execute without routing through the LLM

## Install locally from this repo

From a machine that already has this repo checked out:

```bash
cd /path/to/my-pet-hero
npm run build
openclaw plugins install ./openclaw-plugin
```

Then restart the gateway.

## Optional plugin config

If the plugin directory is not sitting inside the My Pet Hero repo, set `projectDir` to the repo root containing `dist/cli.js`.

```json5
{
  plugins: {
    entries: {
      "my-pet-hero": {
        enabled: true,
        config: {
          projectDir: "/path/to/my-pet-hero"
        }
      }
    }
  },
  tools: {
    allow: ["my_pet_hero_pet"]
  }
}
```

`nodeBin` is also supported if OpenClaw should use a specific Node executable.

## Command flow

`/pet report asaki`

1. Telegram/OpenClaw native command resolves skill `pet`
2. skill dispatches to tool `my_pet_hero_pet`
3. tool runs `node dist/cli.js chat --input "/pet report asaki"`
4. tool returns the JSON payload's `message`/`report`/`headline` as reply text

## Notes

- The plugin does not hardcode personal save paths or secrets.
- Save data still lives in My Pet Hero's runtime state directory, outside the repo.
- Build the project after source changes so `dist/cli.js` stays current.
