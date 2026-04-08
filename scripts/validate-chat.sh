#!/usr/bin/env bash
set -euo pipefail

tmpdir=$(mktemp -d)
export MY_PET_HERO_DATA_DIR="$tmpdir/pets"
export MY_PET_HERO_RENDER_DIR="$tmpdir/renders"

node dist/cli.js create --name Asaki --species elf --class mage > /tmp/mph-chat-create.json
node dist/cli.js chat --input "/pet status" > /tmp/mph-chat-status.json
node dist/cli.js chat --input "/pet report" > /tmp/mph-chat-report.json
node dist/cli.js chat --input "/pet inventory" > /tmp/mph-chat-inventory.json
node dist/cli.js chat --input "/pet use asaki" > /tmp/mph-chat-use.json
node dist/cli.js chat --input "/pet heroes" > /tmp/mph-chat-heroes.json
node dist/cli.js chat --input "/pet feed" > /tmp/mph-chat-feed.json

jq -e '.mode == "chat" and .command == "status" and .headline and .message' /tmp/mph-chat-status.json > /dev/null
jq -e '.mode == "chat" and .command == "report" and .report' /tmp/mph-chat-report.json > /dev/null
jq -e '.mode == "chat" and .command == "inventory" and .inventoryLines' /tmp/mph-chat-inventory.json > /dev/null
jq -e '.defaultHeroId == "asaki"' /tmp/mph-chat-use.json > /dev/null
jq -e '.defaultHeroId == "asaki" and .count == 1' /tmp/mph-chat-heroes.json > /dev/null
jq -e '.command == "feed" and .summary and .id == "asaki"' /tmp/mph-chat-feed.json > /dev/null

echo 'CHAT_STATUS:'
jq -r '.message' /tmp/mph-chat-status.json
echo '---'
echo 'CHAT_REPORT_SNIPPET:'
jq -r '.report' /tmp/mph-chat-report.json | head -n 8
