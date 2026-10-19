#!/data/data/com.termux/files/usr/bin/bash
# Himmelsgristle bijwerken: haalt de nieuwste versie op. Hiervoor is even internet nodig.
cd ~/himmelsgristle || { echo "Himmelsgristle niet gevonden."; read -r; exit 1; }
for p in $(pgrep -x node); do kill "$p"; done
echo ""
echo "  Nieuwste versie ophalen..."
if git fetch -q origin && git reset -q --hard origin/main; then
  cp termux/Himmelsgristle-starten.sh ~/.shortcuts/"Himmelsgristle starten"
  cp termux/Himmelsgristle-bijwerken.sh ~/.shortcuts/"Himmelsgristle bijwerken"
  chmod +x ~/.shortcuts/*
  echo "  Bijgewerkt naar versie $(grep -o "VERSIE = '[^']*'" server.js | cut -d"'" -f2)."
  echo "  Zet de hotspot weer aan en tik op Himmelsgristle starten."
else
  echo "  Ophalen mislukt. Staat wifi of mobiele data aan?"
fi
echo ""
echo "  Enter om dit venster te sluiten."
read -r
