# Himmelsgristle

Een synthnetwerk van oude telefoons die samen in sync spelen. Eén telefoon is de **Masterblaster**: hij zet een hotspot op, draait een klein servertje en houdt de klok bij. Andere telefoons, tablets of laptops openen gewoon een webpagina en spelen mee. Geen internet, geen app-winkel, geen account.

Richting: industrial en electroclash. Koud, ritmisch, een beetje vuil.

## Wat er nu in zit (versie 0.2)

- Gedeelde klok tussen alle toestellen, met strak instappen op de maat en tempowissels op de volgende maat
- **Drums:** vijf gesynthetiseerde stemmen (kick, snare, hihat, clap, metaal), elk met een eigen rij van 16 stappen, accent per stap en vijf knoppen per stem
- **Kliktest:** voor het afstellen van de compensatie per toestel
- Op de Masterblaster: het spelersadres en een QR-code om aan te haken

## Masterblaster klaarzetten (eenmalig)

Op een Android-telefoon met [Termux](https://f-droid.org/packages/com.termux/) en [Termux:Widget](https://f-droid.org/packages/com.termux.widget/), allebei via F-Droid. Zorg dat de telefoon even internet heeft en typ in Termux:

```
curl -sL https://raw.githubusercontent.com/HimmelsbachInternational/himmelsgristle/main/termux/eerste-keer.sh | bash
```

Voortaan krijg je bij het openen van Termux een keuzemenu: **1** om te starten, **2** om bij te werken. Werkt je launcher met widgets, dan kun je ook de knoppen van Termux:Widget op je startscherm zetten.

Vraagt Android of Termux over andere apps mag tekenen, sta dat toe; anders kunnen de knoppen Termux niet openen. Zet ook de batterijbesparing voor Termux uit.

## Spelen

1. Zet op de Masterblaster de **hotspot** aan.
2. Open Termux en kies **1** (of tik op de knop Himmelsgristle starten).
3. Open op de Masterblaster in Chrome `http://localhost:8080`. Daar staan het spelersadres en de QR-code.
4. Verbind de andere toestellen met de hotspot, zet hun **mobiele data uit**, en scan de code of typ het adres.
5. Kies op elk toestel een rol en tik op START.

Klinkt een toestel te laat of te vroeg, stel dan onder INSTELLINGEN de compensatie bij. De waarde wordt per toestel onthouden.

## Bijwerken

Alleen de Masterblaster hoeft bijgewerkt te worden; de spelers laden alles van hem. Zet de hotspot even uit en wifi aan (of laat mobiele data aan), open Termux en kies **2**, en zet daarna de hotspot weer aan.

## Hoe het werkt

De spelers vragen de Masterblaster steeds hoe laat het is en rekenen het verschil met hun eigen klok uit. Elke noot wordt een fractie van een seconde vooruit ingepland op de audioklok van het toestel zelf. Daardoor maakt een haperende wifi-verbinding niet uit voor de timing. Alles is gewone JavaScript, zodat ook oude telefoons en tablets meedoen.

De QR-code wordt gemaakt met [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) van Kazuhiko Arase (MIT-licentie).
