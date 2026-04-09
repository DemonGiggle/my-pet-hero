# Install My Pet Hero into OpenClaw

This is the shortest reliable setup for a fresh OpenClaw host with no prior context.

## Goal
Enable these native commands in OpenClaw:
- `/pet`
- `/pet_image`

## 1. Clone the repo
```bash
git clone git@github.com:DemonGiggle/my-pet-hero.git /home/gigo/.openclaw/projects/my-pet-hero
cd /home/gigo/.openclaw/projects/my-pet-hero
```

If the repo already exists:
```bash
cd /home/gigo/.openclaw/projects/my-pet-hero
git pull
```

## 2. Build it
This repo is **source-first**. `dist/` is not stored in git.

After every fresh clone or pull, run:
```bash
npm install
npm run build
```

If you skip this, anything that calls `node dist/cli.js` will fail.

## 3. Install the OpenClaw plugin
From the repo root:
```bash
openclaw plugins install ./openclaw-plugin
```

This should provide:
- plugin: `my-pet-hero`
- tool: `my_pet_hero_pet`
- skills: `pet`, `pet_image`

## 4. Confirm OpenClaw config/runtime sees it
Check that OpenClaw actually has the plugin enabled and visible.

Look for:
- `my-pet-hero` in `plugins.allow`
- a matching plugin entry/path in `plugins.entries`
- plugin enabled in runtime
- skills visible: `pet`, `pet_image`

## 5. Restart the gateway if needed
If the plugin was just installed or updated, restart OpenClaw gateway using the normal supported method.

Examples:
```bash
openclaw gateway restart
```

## 6. Test commands
After restart, test:
- `/pet`
- `/pet status`
- `/pet_image`

Expected:
- `/pet` returns text status
- `/pet_image` returns a status image

## Minimal config idea
If your OpenClaw uses explicit plugin allow/entries, make sure it effectively includes something equivalent to:

```json
{
  "plugins": {
    "allow": ["my-pet-hero"],
    "entries": {
      "my-pet-hero": {
        "enabled": true,
        "source": "/home/gigo/.openclaw/projects/my-pet-hero/openclaw-plugin"
      }
    }
  }
}
```

Adjust to your actual OpenClaw config shape if needed.

## Common failure cases

### `/pet` or `/pet_image` says command not found
Usually means one of these:
- plugin not installed
- plugin not enabled
- skill not discovered
- gateway not restarted after install/update
- Telegram/native routing not bound correctly

### Plugin exists but tool fails with missing file / dist error
You forgot to rebuild after clone/pull:
```bash
npm install
npm run build
```

### `/pet` works but `/pet_image` fails
Check whether `pet_image` is being routed through the same deterministic tool and mapped to `/pet status ...` correctly.

## Debug order
When troubleshooting, check in this order:
1. repo exists
2. build succeeded
3. plugin installed
4. plugin enabled in config/runtime
5. skills visible: `pet`, `pet_image`
6. gateway restarted cleanly
7. native routing/menu updated

