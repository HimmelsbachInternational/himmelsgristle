#!/data/data/com.termux/files/usr/bin/bash
# Himmelsgristle: eenmalig klaarzetten op de Masterblaster.
# Gebruik in Termux (met internet):
#   curl -sL https://raw.githubusercontent.com/HimmelsbachInternational/himmelsgristle/main/termux/eerste-keer.sh | bash

REPO="HimmelsbachInternational/himmelsgristle"

echo ""
echo "  HIMMELSGRISTLE  klaarzetten"
echo ""

pkg install -y git nodejs >/dev/null 2>&1 || pkg install -y git nodejs

cd ~
if [ -d himmelsgristle ] && [ ! -d himmelsgristle/.git ]; then
  rm -rf himmelsgristle-oud
  mv himmelsgristle himmelsgristle-oud
  echo "  Oude versie bewaard als ~/himmelsgristle-oud"
fi
if [ ! -d himmelsgristle ]; then
  git clone -q "https://github.com/$REPO.git" himmelsgristle || { echo "  Ophalen mislukt. Heb je internet?"; exit 1; }
fi

mkdir -p ~/.shortcuts
cp ~/himmelsgristle/termux/Himmelsgristle-starten.sh ~/.shortcuts/"Himmelsgristle starten"
cp ~/himmelsgristle/termux/Himmelsgristle-bijwerken.sh ~/.shortcuts/"Himmelsgristle bijwerken"
chmod +x ~/.shortcuts/*

# Keuzemenu bij het openen van Termux (voor launchers zonder widgets)
touch ~/.bashrc
grep -q "himmelsgristle/termux/menu.sh" ~/.bashrc || echo '[ -f ~/himmelsgristle/termux/menu.sh ] && . ~/himmelsgristle/termux/menu.sh' >> ~/.bashrc

echo ""
echo "  Klaar. Voortaan krijg je bij het openen van Termux een keuzemenu:"
echo "  1 = starten, 2 = bijwerken."
echo "  Met een launcher die widgets kan, staan de knoppen ook onder Termux:Widget."
echo ""
