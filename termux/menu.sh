# Himmelsgristle: menu when Termux opens.
# Loaded from ~/.bashrc and ~/.profile. Handy with a minimal launcher without widgets.

if [ -t 0 ] && [ -z "$HG_MENU_GEZIEN" ] && [ -d ~/himmelsgristle ]; then
  export HG_MENU_GEZIEN=1
  echo ""
  echo "  HIMMELSGRISTLE"
  echo ""
  echo "  1  start"
  echo "  2  update (needs internet for a moment)"
  echo "  Enter  plain terminal"
  echo ""
  while true; do
    read -r -n 1 -p "  Choice: " hg_keuze
    echo ""
    case "$hg_keuze" in
      1) bash ~/himmelsgristle/termux/Himmelsgristle-starten.sh; break ;;
      2) bash ~/himmelsgristle/termux/Himmelsgristle-bijwerken.sh; break ;;
      "") break ;;
      *) echo "  Press 1, 2 or Enter." ;;
    esac
  done
  unset hg_keuze
fi
