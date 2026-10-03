#!/bin/bash
# (uses tools/shot.mjs: a copy of scripts/shot.mjs with a 240 s screenshot timeout, robust on a loaded machine)
# Render music-room review shots one node at a time (robust to a loaded machine).
#   bash src/rooms/music/tools/shots.sh main piano harp ...   ('puzzle' renders the puzzle screen)
cd "$(dirname "$0")/../../../.." || exit 1
for n in "$@"; do
  for attempt in 1 2; do
    if [ "$n" = "puzzle" ]; then
      node src/rooms/music/tools/shot.mjs --room music --node piano --screen puzzle --timeout 600 --out review/music/puzzle.png > /tmp/claude-0/music_shot.log 2>&1
    else
      node src/rooms/music/tools/shot.mjs --room music --node "$n" --timeout 600 --out "review/music/$n.png" > /tmp/claude-0/music_shot.log 2>&1
    fi
    if grep -q '"wallMs"' /tmp/claude-0/music_shot.log; then echo "$n ok $(grep -o '"wallMs":[0-9]*' /tmp/claude-0/music_shot.log)"; grep -E "\[error\]|pageerror" /tmp/claude-0/music_shot.log | cut -c1-200; break; fi
    echo "$n failed (attempt $attempt)"; tail -3 /tmp/claude-0/music_shot.log | cut -c1-200
  done
done
