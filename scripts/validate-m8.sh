#!/usr/bin/env bash
set -euo pipefail

tmpdir=$(mktemp -d)
export MY_PET_HERO_DATA_DIR="$tmpdir/pets"
export MY_PET_HERO_RENDER_DIR="$tmpdir/renders"

node dist/cli.js create --name Asaki --species elf --class mage > /tmp/mph-create.json
node dist/cli.js status --report > /tmp/mph-status.json
node dist/cli.js inventory > /tmp/mph-inventory.json
node dist/cli.js saves > /tmp/mph-saves.json
node dist/cli.js doctor > /tmp/mph-doctor.json
node dist/cli.js dungeon-preview --repeat 2 --force-ready > /tmp/mph-dungeon.json
npm run check:migrations > /tmp/mph-migrations.txt

jq -e '.id == "asaki"' /tmp/mph-create.json > /dev/null
jq -e '.headline and .quickStatus and .report' /tmp/mph-status.json > /dev/null
jq -e '.inventoryLines' /tmp/mph-inventory.json > /dev/null
jq -e '.count == 1 and .defaultHeroId == "asaki"' /tmp/mph-saves.json > /dev/null
jq -e '.migrationPolicy.target == 7 and .pet.id == "asaki"' /tmp/mph-doctor.json > /dev/null
jq -e '.triggered != null and .after.location' /tmp/mph-dungeon.json > /dev/null

echo 'STATUS_HEADLINE:'
jq -r '.headline' /tmp/mph-status.json
echo '---'
echo 'STATUS_REPORT:'
jq -r '.report' /tmp/mph-status.json
echo '---'
echo 'MIGRATION_CHECK:'
tail -n 5 /tmp/mph-migrations.txt
