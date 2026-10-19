#!/data/data/com.termux/files/usr/bin/bash
# Update Himmelsgristle: fetches the newest version. Needs internet for a moment.

# Run from a copy, because updating replaces this very file while it runs.
if [ "$HG_KOPIE" != "1" ]; then
  kopie="${TMPDIR:-${PREFIX:-/tmp}/tmp}/hg-update.sh"
  cp "$0" "$kopie" 2>/dev/null && HG_KOPIE=1 exec bash "$kopie"
fi
cd ~/himmelsgristle || { echo "Himmelsgristle not found."; read -r; exit 1; }
for p in $(pgrep -x node); do kill "$p"; done
echo ""
echo "  Fetching the newest version..."
if git fetch -q origin && git reset -q --hard origin/main; then
  cp termux/Himmelsgristle-starten.sh ~/.shortcuts/"Himmelsgristle start"
  cp termux/Himmelsgristle-bijwerken.sh ~/.shortcuts/"Himmelsgristle update"
  rm -f ~/.shortcuts/"Himmelsgristle starten" ~/.shortcuts/"Himmelsgristle bijwerken"
  chmod +x ~/.shortcuts/*
  for rc in ~/.bashrc ~/.profile; do
    touch "$rc"
    grep -q "himmelsgristle/termux/menu.sh" "$rc" || echo '[ -f ~/himmelsgristle/termux/menu.sh ] && . ~/himmelsgristle/termux/menu.sh' >> "$rc"
  done
  echo "  Updated to version $(grep -o "VERSIE = '[^']*'" server.js | cut -d"'" -f2)."
  echo "  Switch the hotspot back on and start Himmelsgristle."
else
  echo "  Fetching failed. Is wifi or mobile data on?"
fi
echo ""
echo "  Press Enter to close this window."
read -r
