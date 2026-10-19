#!/data/data/com.termux/files/usr/bin/bash
# Start Himmelsgristle: the Masterblaster starts running.
cd ~/himmelsgristle || { echo "Himmelsgristle not found."; read -r; exit 1; }
termux-wake-lock
node server.js
echo ""
echo "  The server has stopped. Press Enter to close this window."
read -r
