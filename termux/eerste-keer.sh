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

echo ""
echo "  Klaar. Zet nu de knoppen op je startscherm:"
echo "  lang drukken op het startscherm > Widgets > Termux:Widget"
echo ""
