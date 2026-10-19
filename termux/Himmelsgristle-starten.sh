#!/data/data/com.termux/files/usr/bin/bash
# Start Himmelsgristle: the Masterblaster starts running.
cd ~/himmelsgristle || { echo "Himmelsgristle not found."; read -r; exit 1; }
termux-wake-lock
# If the server ever stops by itself, start it again. Volume down + C stops it for good.
trap 'echo ""; echo "  Stopped."; exit 0' INT
while true; do
  node server.js
  [ $? -eq 3 ] && { echo "  Press Enter to close this window."; read -r; exit 0; }
  echo ""
  echo "  The server stopped. Starting again in 2 seconds (volume down + C to quit)."
  sleep 2
done
