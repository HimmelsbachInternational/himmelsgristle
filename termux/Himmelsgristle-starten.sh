#!/data/data/com.termux/files/usr/bin/bash
# Himmelsgristle starten: de Masterblaster gaat draaien.
cd ~/himmelsgristle || { echo "Himmelsgristle niet gevonden."; read -r; exit 1; }
termux-wake-lock
node server.js
echo ""
echo "  De server is gestopt. Enter om dit venster te sluiten."
read -r
