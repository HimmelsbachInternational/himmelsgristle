# Himmelsgristle: keuzemenu bij het openen van Termux.
# Wordt geladen vanuit ~/.bashrc. Handig met een minimale launcher zonder widgets.

if [ -t 0 ] && [ -z "$HG_MENU_GEZIEN" ] && [ -d ~/himmelsgristle ]; then
  export HG_MENU_GEZIEN=1
  echo ""
  echo "  HIMMELSGRISTLE"
  echo ""
  echo "  1  starten"
  echo "  2  bijwerken (even internet nodig)"
  echo "  Enter  gewone terminal"
  echo ""
  while true; do
    read -r -n 1 -p "  Keuze: " hg_keuze
    echo ""
    case "$hg_keuze" in
      1) bash ~/himmelsgristle/termux/Himmelsgristle-starten.sh; break ;;
      2) bash ~/himmelsgristle/termux/Himmelsgristle-bijwerken.sh; break ;;
      "") break ;;
      *) echo "  Kies 1, 2 of Enter." ;;
    esac
  done
  unset hg_keuze
fi
