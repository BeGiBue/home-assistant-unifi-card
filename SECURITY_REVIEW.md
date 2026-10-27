# Security-Review – UniFi Card 1.0.0

Stand: 2026-10-24. Ausgangsstand der Prüfung: Version 0.17.7. Geprüft wurden `src/`, Build-/Release-Skripte,
Lockfile und Workflows. Der Review ist eine statische Codeprüfung mit lokalen Reproduktionen und Regressionstests.

## Befunde

| ID | Datei | Risiko und Voraussetzung | Schweregrad | Korrektur / Status |
| --- | --- | --- | --- | --- |
| U-01 | `src/utils.js` | `connected_device: constructor` löst bei fehlendem gleichnamigen Gerät eine geerbte Funktion auf. `rankOf(undefined)` bricht anschließend die Darstellung mit TypeError ab. Ein über UniFi Network+ übernommener Port-/Gerätename reicht aus. `__proto__` als tatsächlicher Gerätename verändert außerdem den lokalen Index-Prototyp. Keine globale Prototype-Pollution und keine Codeausführung nachgewiesen. | Mittel (Verfügbarkeit der Karte) | Namens- und MAC-Indices ohne Prototyp; tatsächliche Eltern-IDs mit Own-Property-Prüfung validieren. Behoben; reservierte und unbekannte Namen werden getestet. |
| U-02 | `src/utils.js`, `src/unifi-network-card.js` | Die Farbprüfung akzeptierte jeden mit `#`, `rgb`, `hsl` oder `var(` beginnenden String. `#fff; background-image:url(...)` erzeugte eine zusätzliche CSS-Deklaration und damit einen ungewollten Browser-Request. Erfordert Kontrolle einer Farboption in der Dashboard-Konfiguration. HTML-Escaping verhinderte den Attributausbruch bereits. | Niedrig | Einzelne Farbwerte mit vollständiger Syntaxbegrenzung prüfen; RGB-Arrays nur mit endlichen Komponenten 0–255. Behoben; Deklarationen, Ressourcen und verschachtelte Variablen getestet. |
| U-H01 | `src/unifi-network-card.js` | Bild-URLs waren HTML-escaped, aber ohne Schema- und Credential-Prüfung. Ausführung eines `javascript:`-Wertes in einem modernen `img` wurde nicht nachgewiesen. | Härtung | HTTP(S) ohne URL-Zugangsdaten, relative Pfade und Base64-Rasterbilder erlauben; fremde Schemata und SVG-Daten-URLs verwerfen. Zusätzliches HTML-Escaping bleibt erhalten. Dokumentierte Einschränkung. |

## Geprüfte Vertrauensgrenzen

- Die einzige dynamische `innerHTML`-Zuweisung rendert Templates der Karte. Gerätenamen, Modelle, Versionen, IPs,
  Entity-IDs, Zustände, Einheiten, Konfigurationstitel und API-Daten werden in Text-/Attribut-Kontexten escaped oder
  vorab in endliche Zahlen umgewandelt. Der Editor verwendet DOM-Erzeugung und `textContent` statt dynamischem HTML.
- Ereignisse werden über `addEventListener` gebunden; Bild-Fallbacks verwenden keine Inline-Event-Handler.
- Der Recorder-Zugriff läuft über `hass.callWS`; Neustart- und PoE-Aktionen laufen über `hass.callService` und damit
  die authentifizierte HA-Verbindung. Die Karte implementiert keine eigene Authentifizierung, speichert keine
  Controller-Zugangsdaten und ruft keine Controller-API direkt auf. Berechtigungen werden serverseitig von HA und
  den bereitstellenden Integrationen erzwungen; die UI-Bestätigung ist keine Sicherheitsgrenze.
- Es gibt keine Python-Komponente, Dateizugriffe oder eigenen WebSocket-Endpunkte. Geräte-MACs/IPs sind lokale
  Netzwerkdaten und erscheinen nur in der vorhandenen HA-Sitzung. Keine fest codierten Geheimnisse gefunden.
- Keine ausgelieferten npm-Laufzeitabhängigkeiten: esbuild ist ausschließlich Build-Abhängigkeit.

## Restrisiken

- Externe HTTP(S)-Bilder können weiterhin vom gewählten Host geladen werden und dessen Betreiber Browser-IP und
  normale HTTP-Metadaten offenlegen. Die Karte fügt diesen Requests keine HA-Tokens hinzu. Lokale Bilder unter
  `/local/` vermeiden diese externe Kommunikation. Browser-Cookies und Netzwerkzugriff folgen Browserregeln.
- `npm audit` meldete am 2026-10-24 0 bekannte Schwachstellen. Das ist eine datenbankabhängige Momentaufnahme und
  keine Zusicherung der Schwachstellenfreiheit.
- Die Tests verwenden DOM-/HA-Attrappen und führen keine Geräteaktionen aus. Neustart und PoE-Steuerung sind nicht
  gegen ein reales Home Assistant mit Controller getestet.
- Die Aufnahme in den offiziellen HACS-Katalog ist kein technischer Nachweis der Sicherheit.

## Ergebnis

Keine offenen bestätigten hohen oder kritischen Befunde aus diesem Code-Review.
