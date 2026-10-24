# Security-Review – UniFi Card 1.0.0

Stand: 2026-10-24. Geprüfter Ausgangscommit: `a8d7990e0e2cd3c37f65126635c4368ffc542e4d` (0.17.7).
Die Fundstellen in der Tabelle beziehen sich auf diesen Ausgangscommit. Geprüft wurden `src/`, Build-/Release-Skripte,
Lockfile und Workflows. Der Review ist eine statische Codeprüfung mit lokalen Reproduktionen und Regressionstests.

## Befunde

| ID | Repository | Datei / Zeile (Ausgangsstand) | Risiko und Voraussetzung | Schweregrad | Korrektur / Status |
| --- | --- | --- | --- | --- | --- |
| U-01 | home-assistant-unifi-card | `src/utils.js:270`, `:271`, `:294` | `connected_device: constructor` löst bei fehlendem gleichnamigen Gerät eine geerbte Funktion auf. `rankOf(undefined)` bricht anschließend die Darstellung mit TypeError ab. Ein über UniFi Network+ übernommener Port-/Gerätename reicht aus. `__proto__` als tatsächlicher Gerätename verändert außerdem den lokalen Index-Prototyp. Keine globale Prototype-Pollution und keine Codeausführung nachgewiesen. | Mittel (Verfügbarkeit der Karte) | Namens- und MAC-Indices ohne Prototyp; tatsächliche Eltern-IDs mit Own-Property-Prüfung validieren. Behoben; reservierte und unbekannte Namen werden getestet. |
| U-02 | home-assistant-unifi-card | `src/utils.js:159`, `src/unifi-network-card.js:818` | Die Farbprüfung akzeptierte jeden mit `#`, `rgb`, `hsl` oder `var(` beginnenden String. `#fff; background-image:url(...)` erzeugte eine zusätzliche CSS-Deklaration und damit einen ungewollten Browser-Request. Erfordert Kontrolle einer Farboption in der Dashboard-Konfiguration. HTML-Escaping verhinderte den Attributausbruch bereits. | Niedrig | Einzelne Farbwerte mit vollständiger Syntaxbegrenzung prüfen; RGB-Arrays nur mit endlichen Komponenten 0–255. Behoben; Deklarationen, Ressourcen und verschachtelte Variablen getestet. |
| U-H01 | home-assistant-unifi-card | `src/unifi-network-card.js:632`, `:637`, `:705` | Bild-URLs waren HTML-escaped, aber ohne Schema- und Credential-Prüfung. Ausführung eines `javascript:`-Wertes in einem modernen `img` wurde nicht nachgewiesen. | Härtung | HTTP(S) ohne URL-Zugangsdaten, relative Pfade und Base64-Rasterbilder erlauben; fremde Schemata und SVG-Daten-URLs verwerfen. Zusätzliches HTML-Escaping bleibt erhalten. Dokumentierte Einschränkung. |

## Prüfergebnisse und Vertrauensgrenzen

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
- Externe HTTP(S)-Bilder können weiterhin vom gewählten Host geladen werden und dessen Betreiber Browser-IP und
  normale HTTP-Metadaten offenlegen. Die Karte fügt diesen Requests keine HA-Tokens hinzu. Lokale Bilder unter
  `/local/` vermeiden diese externe Kommunikation. Browser-Cookies und Netzwerkzugriff folgen Browserregeln.
- Keine ausgelieferten npm-Laufzeitabhängigkeiten: esbuild 0.25.12 ist ausschließlich Build-Abhängigkeit.
  Der koordinierte Aufruf `npm audit --json` meldete am 2026-10-24 **0 bekannte Schwachstellen**. Das ist eine
  datenbankabhängige Momentaufnahme und keine Zusicherung der Schwachstellenfreiheit.

## Verifikation

- Ausgangsfehler U-01 mit dem minimalen Portattribut `connected_device: constructor` reproduziert (TypeError).
- U-02 mit `#fff; background-image:url(https://example.invalid/track)` als akzeptierte zweite Deklaration reproduziert.
- `npm test`: erfolgreich.
- `node --test --test-isolation=none`: **56 Tests erfolgreich**, darunter fünf neue Sicherheitsfälle mit mehreren
  bösartigen Eingaben. Der zusätzliche Aufruf zeigt in dieser Umgebung die Einzeltests statt nur der zwei Testdateien.
- `npm run build`: erfolgreich, Bundle für 1.0.0 erzeugt; `dist/` ist laut Projektkonvention nicht eingecheckt.
- `node --check` für Karte, Hilfsfunktionen und erzeugtes Bundle: erfolgreich.
- Release-Text über `node scripts/release-notes.mjs 1.0.0` aus dem Changelog geprüft; Release-Notes-Datei stimmt überein.
- `git diff --check`: erfolgreich.
- Reale Home-Assistant-/Controller-/Browserprüfung von Neustart und PoE bleibt vor Veröffentlichung erforderlich;
  die Tests verwenden DOM-/HA-Attrappen und führen keine Geräteaktionen aus.

## Release-Status

Zielversion: **1.0.0**. Keine offenen bestätigten hohen oder kritischen Befunde aus diesem Code-Review.
HACS-Validierung toleriert in CI keine Fehler mehr; bestehende Branch-Schutzregeln werden nicht verändert.
Der Release-Workflow bleibt unverändert und veröffentlicht nur per Tag oder manuellem Workflow-Aufruf. Es wurden
keine Tags, Releases oder Geräteaktionen ausgeführt. Vor Veröffentlichung sind PR-Review, erfolgreiche GitHub-CI
und die genannten Realtests erforderlich. Die Aufnahme in den offiziellen HACS-Katalog ist kein technischer
Nachweis der Sicherheit; die Major-Version bedeutet nicht automatisch Breaking Changes.
