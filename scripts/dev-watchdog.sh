#!/bin/bash
cd /home/z/my-project
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date)] Restarting..." >> /home/z/my-project/dev-watchdog.log
    NODE_OPTIONS="--max-old-space-size=768" bun next dev --webpack -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    PID=$!
    wait $PID 2>/dev/null
    echo "[$(date)] Server exited (OOM?), waiting 5s..." >> /home/z/my-project/dev-watchdog.log
    sleep 5
  else
    sleep 8
  fi
done
