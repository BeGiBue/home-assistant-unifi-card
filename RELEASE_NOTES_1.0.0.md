- Aufnahme in den **offiziellen HACS-Katalog**: Installation über die HACS-Suche ist der Standardweg.
- Migration bestehender **Custom Repositories** dokumentiert: nur den benutzerdefinierten Repository-Eintrag entfernen,
  die Installation, Konfigurationen und Dashboard-Karten erhalten und HACS aktualisieren.
- Die Major-Version markiert den Katalogeintrag und bedeutet **nicht automatisch Breaking Changes**. Kartentyp,
  Gerätezuordnungen und reguläre Konfigurationsoptionen bleiben kompatibel.
- Sicherheitskorrektur: Geräte-/Portnamen wie `constructor` oder `__proto__` können bei der automatischen Link-Erkennung
  keine geerbten Objekte mehr auflösen und die Karte zum Abbruch bringen.
- Sicherheitskorrektur: Farbwerte werden als einzelne CSS-Farbe validiert; zusätzliche Deklarationen und `url()`-Werte
  werden verworfen. Dadurch lassen sich über Farboptionen keine zusätzlichen Ressourcen laden.
- Bild-URLs werden auf HTTP(S), lokale/relative Pfade und Base64-Rasterbilder begrenzt; URL-Zugangsdaten, fremde Schemata
  und SVG-Daten-URLs werden verworfen. HTML-Escaping bleibt zusätzlich aktiv.
- Sicherheits-Regressionstests für Gerätenamen, HTML/Attribute, CSS-Deklarationen und Bild-URLs ergänzt.
- HACS-Validierung in CI als erforderliches erfolgreiches Job-Ergebnis behandelt; die bisherige Fehler-Toleranz entfällt.
- `package.json`, Lockfile und Versionskonstante auf **1.0.0** vereinheitlicht.
