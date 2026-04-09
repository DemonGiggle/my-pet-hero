# My Pet Hero OpenClaw plugin

This plugin gives OpenClaw a deterministic `my_pet_hero_pet` tool plus native `/pet` and `/pet_image` skill commands that dispatch straight to that tool.

## What it does

- registers tool: `my_pet_hero_pet`
- ships skills: `pet`, `pet_image`
- skill frontmatter uses `command-dispatch: tool`
- native `/pet` and `/pet_image` can execute without routing through the LLM

## Install locally from this repo

From a machine that already has this repo checked out:

```bash
cd /path/to/my-pet-hero
npm install
npm run build
openclaw plugins install ./openclaw-plugin
```

Then restart the gateway.

After each fresh clone or `git pull`, rebuild before using the plugin again if `dist/cli.js` is missing or stale.

For a fresh-host setup guide with install order, config hints, and troubleshooting, see `../docs/INSTALL_OPENCLAW.md`.

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

`/pet_image card asaki`

1. Telegram/OpenClaw native command resolves skill `pet_image`
2. skill dispatches to the same tool `my_pet_hero_pet`
3. tool maps it to `node dist/cli.js chat --input "/pet status asaki"`
4. tool returns a short caption plus the rendered status image

## Notes

- The plugin does not hardcode personal save paths or secrets.
- Save data still lives in My Pet Hero's runtime state directory, outside the repo.
- Build the project after source changes so `dist/cli.js` stays current.
- Because `dist/` is no longer tracked, a fresh checkout needs `npm run build` before the tool can execute.
