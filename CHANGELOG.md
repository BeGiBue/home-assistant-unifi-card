# Changelog

## 0.17.7

- Fix: Der neue Sensor „Port N PoE Standard“ von UniFi Network+ (Text wie 802.3at, standardmäßig deaktiviert) wurde bei nummerischen Ports teils statt „PoE Power“ als PoE-Wert gewählt. Die Art der Entität wird jetzt über den `translation_key` bestimmt, der Standard-Sensor wird nie für die Leistung verwendet.
- Neu: Der Sensor „Uplink“ von UniFi Network+ (ab 0.3, je AP/Switch) ordnet übergeordnetes Gerät und Port automatisch zu, auch wenn die Link-Speed-Sensoren der Ports deaktiviert sind. Kaskadierte Switches (Switch an Switch) werden damit erkannt. Link-Speed-Sensoren haben weiterhin Vorrang, manuelle Angaben ebenso.
- Geräte werden bei der Zuordnung zusätzlich über ihren HA-Namen gefunden, falls dieser vom Controller-Namen abweicht.

## 0.17.6

- Scroll-Springen im Dashboard behoben (iPad/Companion App): Die animierten Flusslinien liefen über `background-position` und haben den Gerätebaum in jedem Frame neu gezeichnet. Sie werden jetzt per `transform` verschoben und laufen damit im Compositing, ohne Neuzeichnen. Aussehen und Geschwindigkeit bleiben gleich.

## 0.17.5

- Mehr Platz zwischen den Kacheln in der breiten Baumansicht (Abstand 10 → 15 px); kompakte Ansicht und Liste bleiben unverändert.
- Scroll-Springen behoben: Während die Seite gescrollt oder berührt wird, baut die Karte ihr DOM nicht mehr neu auf, Live-Werte werden danach nachgezogen.
- Die Dichte-Messung (normal/kompakt/Liste) läuft nur noch bei geänderter Breite oder Gerätestruktur und nicht mehr bei jeder Wertänderung.

## 0.17.3

- Neue, im Browser erstellte Vorschauen aus dem unveränderten Original-Code in der README.
- Vorschau-Bilder über absolute Raw-URLs für die Anzeige in GitHub und HACS eingebunden.
- Versionsangaben für das Patch-Release aktualisiert.

Keine Änderungen an der Funktionsweise der Karte oder Integration.

