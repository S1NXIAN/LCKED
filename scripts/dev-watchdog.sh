#!/bin/bash
cd /home/z/my-project
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date)] Restarting..." >> /home/z/my-project/dev-watchdog.log
    NODE_OPTIONS="--max-old-space-size=1024" bun next dev --webpack -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    PID=$!
    echo "[$(date)] Started PID $PID" >> /home/z/my-project/dev-watchdog.log
    wait $PID 2>/dev/null
    echo "[$(date)] Server exited" >> /home/z/my-project/dev-watchdog.log
    sleep 3
  else
    sleep 10
  fi
done
