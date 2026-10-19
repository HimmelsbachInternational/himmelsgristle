#!/data/data/com.termux/files/usr/bin/bash
# Himmelsgristle: one-time setup on the Masterblaster.
# Use in Termux (with internet):
#   curl -sL https://raw.githubusercontent.com/HimmelsbachInternational/himmelsgristle/main/termux/eerste-keer.sh | bash

REPO="HimmelsbachInternational/himmelsgristle"

echo ""
echo "  HIMMELSGRISTLE  setup"
echo ""

pkg install -y git nodejs >/dev/null 2>&1 || pkg install -y git nodejs

cd ~
if [ -d himmelsgristle ] && [ ! -d himmelsgristle/.git ]; then
  rm -rf himmelsgristle-oud
  mv himmelsgristle himmelsgristle-oud
  echo "  Old version kept as ~/himmelsgristle-oud"
fi
if [ ! -d himmelsgristle ]; then
  git clone -q "https://github.com/$REPO.git" himmelsgristle || { echo "  Fetching failed. Do you have internet?"; exit 1; }
fi

mkdir -p ~/.shortcuts
cp ~/himmelsgristle/termux/Himmelsgristle-starten.sh ~/.shortcuts/"Himmelsgristle start"
cp ~/himmelsgristle/termux/Himmelsgristle-bijwerken.sh ~/.shortcuts/"Himmelsgristle update"
chmod +x ~/.shortcuts/*

# Menu when Termux opens (for launchers without widgets)
for rc in ~/.bashrc ~/.profile; do
  touch "$rc"
  grep -q "himmelsgristle/termux/menu.sh" "$rc" || echo '[ -f ~/himmelsgristle/termux/menu.sh ] && . ~/himmelsgristle/termux/menu.sh' >> "$rc"
done

echo ""
echo "  Done. From now on Termux opens with a menu:"
echo "  1 = start, 2 = update."
echo "  With a launcher that supports widgets, the buttons are also under Termux:Widget."
echo ""
