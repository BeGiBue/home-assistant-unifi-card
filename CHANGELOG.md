# Changelog

Alle sichtbaren Änderungen an der UniFi Card. Neueste Version oben.

## 1.3.0 – 2026-11-11

- New look in line with the NAS, Eaton UPS and TouchKio cards: header with icon and larger title, "online" as a status pill (green, orange when a device is missing), device tiles and history tiles with the shared fill and border, "Internet" and "Ping" with a divider line. The topology, the flows and all values are unchanged. / Neues Aussehen passend zu NAS-, Eaton-UPS- und TouchKio-Card: Kopf mit Symbol und größerem Titel, „Online" als Status-Pill (grün, orange wenn ein Gerät fehlt), Gerätekacheln und Verlaufsfelder mit gemeinsamer Füllung und Rahmen, „Internet" und „Ping" mit Trennlinie. Topologie, Flüsse und alle Werte bleiben unverändert.
- The card no longer rebuilds its content on every value change. It adjusts only what changed: tiles, flow lines, history and buttons stay in place, so the keyboard focus is kept, flow animations no longer restart every few seconds, device images are not reloaded and an open info window stays put. / Die Karte baut ihren Inhalt nicht mehr bei jeder Wertänderung neu auf. Sie gleicht nur an, was sich geändert hat: Kacheln, Flusslinien, Verlauf und Schaltflächen bleiben bestehen. Dadurch bleibt der Tastaturfokus erhalten, Fluss-Animationen starten nicht mehr alle paar Sekunden neu, Gerätebilder werden nicht neu geladen und ein offenes Info-Fenster bleibt stehen.
- A device image that cannot be loaded is no longer requested again on every update; the icon is shown instead. / Ein nicht ladbares Gerätebild wird nicht mehr bei jeder Aktualisierung erneut angefordert; stattdessen erscheint das Symbol.
- Fixed: the restart icon on a device tile could be drawn as large as the device icon. / Behoben: Das Neustart-Symbol auf einer Gerätekachel konnte so groß wie das Gerätesymbol gezeichnet werden.
- Visible focus outline on tiles, history tiles, connections and dialog buttons. / Sichtbarer Fokusrahmen auf Kacheln, Verlaufsfeldern, Verbindungen und Dialog-Schaltflächen.
- Card type, options and entities are unchanged. / Kartentyp, Optionen und Entitäten bleiben unverändert.
- Browser tests added (no rebuild on value changes, dialogs and actions, layout at several widths). / Browser-Tests ergänzt (kein Neuaufbau bei Wertänderungen, Dialoge und Aktionen, Layout in mehreren Breiten).

## 1.2.1 – 2026-11-08

- Fixed: with automatic density the card could switch back and forth between compact and normal (and jitter in height) when its width was close to the threshold and the page scrollbar appeared and disappeared. After the card had to switch to a denser level, it now only returns once the less dense level fits with at least 24 px to spare. / Behoben: Mit automatischer Dichte konnte die Karte zwischen kompakt und normal hin- und herschalten (und in der Höhe zappeln), wenn ihre Breite knapp an der Schwelle lag und die Scrollleiste der Seite ein- und ausgeblendet wurde. Nachdem die Karte auf eine dichtere Stufe wechseln musste, kehrt sie jetzt erst zurück, wenn die weniger dichte Stufe mit mindestens 24 px Reserve passt.

## 1.2.0 – 2026-11-07

- The card description in the card picker now follows the Home Assistant language (English by default, German for German). Card and editor were already bilingual. / Die Beschreibung im Kartenauswahl-Dialog folgt jetzt der Sprache von Home Assistant (Standard Englisch, Deutsch bei deutscher Oberfläche). Karte und Editor waren bereits zweisprachig.
- README shortened and available in English and German. / README gekürzt und auf Englisch und Deutsch verfügbar.

## 1.1.0 – 2026-11-07

- Fix: Auf iPad und iPhone sprang das Dashboard regelmäßig zur Karte. Die Karte baute bei jeder Aktualisierung auch ihre Hülle (`ha-card`) neu auf und war beim anschließenden Messen kurz nur rund 20 px hoch; Safari kürzte dabei die Scrollposition. Die Hülle bleibt jetzt bestehen, und die Dichte-Messung hält die Kartenhöhe fest.
- Die waagerechte Verbindungsleiste bleibt bis zum äußersten verbundenen Gerät schwarz, auch wenn dazwischen ein Gerät offline ist. Grau ist nur noch der senkrechte Abzweig zum Offline-Gerät.
- Nicht verbundene Fremdgeräte (`external_devices`, keine UniFi-Hardware) werden ausgeblendet, zählen in der Zusammenfassung aber weiter mit (z. B. „9/10 Online“). Offline-UniFi-Geräte bleiben ausgegraut sichtbar. Die neue Option `show_offline_external: true` zeigt Fremdgeräte wie bisher an.

## 1.0.1 – 2026-10-27

- Aufräumarbeiten ohne Funktionsänderung: doppelten Code im Karten- und Editor-Quelltext zusammengeführt, ungenutzte Hilfsfunktionen und Variablen entfernt. Konfiguration und Verhalten bleiben unverändert.
- Repository verschlankt: nicht benötigte Logo-Dateien und die Pflicht-Datei `RELEASE_NOTES_<Version>.md` entfernt (der Release-Text kommt aus diesem Changelog), Entwicklungs- und Release-Abschnitte aus der README genommen.

## 1.0.0 – 2026-10-24

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

## 0.17.7 – 2026-10-21

Anpassung an [UniFi Network+](https://github.com/42bios/unifi-network-plus) 0.3.

**Neu**
- Der Sensor „Uplink“ von Network+ ordnet jedem Access Point und Switch automatisch das übergeordnete Gerät und den
  Port zu. Das klappt auch, wenn die Link-Speed-Sensoren der Ports deaktiviert sind. Switches, die an einem anderen
  Switch hängen, erscheinen damit automatisch an der richtigen Stelle im Baum.

**Behoben**
- Die PoE-Leistung eines Ports fehlte oder zeigte „–“, wenn der neue Sensor „Port N PoE Standard“ aktiviert war. Die
  Karte hatte ihn mit „PoE Power“ verwechselt.
- Geräte, die in Home Assistant umbenannt wurden, werden bei der automatischen Zuordnung wieder gefunden.

## 0.17.6 – 2026-10-20

**Behoben**
- Das Dashboard sprang beim Scrollen auf dem iPad bzw. in der Companion App zurück, sobald die Karte sichtbar war. Ursache
  waren die animierten Flusslinien. Sie sehen gleich aus, belasten den Browser aber nicht mehr.

## 0.17.5 – 2026-10-20

**Geändert**
- Mehr Abstand zwischen den Kacheln in der breiten Baumansicht (15 statt 10 px). Kompakte Ansicht und Liste bleiben
  unverändert.

**Verbessert**
- Die Karte baut sich nicht mehr neu auf, während die Seite gescrollt wird, und misst ihre Darstellung nur noch neu, wenn
  sich Breite oder Geräte ändern. (Das Springen beim Scrollen hat das noch nicht behoben, siehe 0.17.6.)

## 0.17.4 – 2026-10-16

- Keine Änderungen an der Karte. Versionsstand für die Aufnahme in HACS.

## 0.17.3 – 2026-10-16

- Keine Änderungen an der Karte.
- README mit Logo und echten Vorschaubildern (schmal und breit), die auch in HACS angezeigt werden.
- Repository umbenannt in `home-assistant-unifi-card`, Lizenz einheitlich AGPL-3.0.

## 0.17.2 – 2026-10-13

**Verbessert**
- Kompakte Ansicht (z. B. iPad hochkant): Die Werte an den Verbindungen stehen untereinander und überlappen sich nicht
  mehr mit denen des Nachbargeräts.

## 0.17.1 – 2026-10-13

**Verbessert**
- Die automatische Wahl zwischen normal, kompakt und Liste berücksichtigt auch die Anzahl der Geräte und die
  Bildschirmbreite und greift dadurch zuverlässiger.

**Behoben**
- In Safari standen die Ebenen des Baums linksbündig statt zentriert.

## 0.17.0 – 2026-10-12

**Neu**
- Schmale Displays: Passt der Baum nicht in die Breite, wechselt die Karte automatisch auf kompakte Kacheln und bei
  sehr wenig Platz auf eine Liste. Mit `density` lässt sich die Darstellung fest einstellen.

## 0.16.1 – 2026-10-12

**Behoben**
- Editor: Bei gesetztem übergeordnetem Gerät stand dort die Geräte-ID statt des Namens.

## 0.16.0 – 2026-10-12

**Geändert**
- Externe Geräte ohne eigene Status-Entität gelten als online, solange am Port ein Link besteht (Link-Speed-Sensor von
  Network+). Ohne solchen Sensor bleiben sie wie bisher online.

## 0.15.2 – 2026-10-12

**Behoben**
- Externe Geräte wurden als offline angezeigt, obwohl am Port Daten flossen oder PoE anlag.
- Vorgeschlagene externe Geräte nutzen den Link-Speed-Sensor ihres Ports als Status.

## 0.15.1 – 2026-10-12

**Behoben**
- Editor: Beim Öffnen konnte eine bestehende Konfiguration überschrieben werden. Fehler im Editor werden jetzt angezeigt
  statt still ignoriert.

## 0.15.0 – 2026-10-12

**Neu**
- Editor-Button „Externe Geräte aus der Portbelegung vorschlagen“: schlägt Geräte an den Switch-Ports vor, die keine
  UniFi-Geräte sind (NAS, Drucker, PC …), mit Name, Port, Symbol und IP.

## 0.14.0 – 2026-10-12

**Neu**
- Verwaltete Liste (`managed`): Die automatische Erkennung legt für jedes Gerät, jeden Ping-Sensor und die
  Internet-Sensoren einen Eintrag an. Ein gelöschter Eintrag blendet das Gerät aus.

## 0.13.0 – 2026-10-12

**Neu**
- Klick auf ein Gerät öffnet ein kleines Fenster mit Status, IP-Adresse, Betriebszeit und Neustart.
- Klick auf eine Verbindung bietet PoE aus/ein und PoE-Neustart (Power Cycle) für den Port an.

## 0.12.0 – 2026-10-12

**Neu**
- Die automatische Erkennung lässt sich erneut starten (z. B. nach dem Umstecken) und überschreibt dabei keine selbst
  eingetragenen Werte.

**Geändert**
- Geräte ohne PoE-Versorgung zeigen keine PoE-Anzeige und keine orange Linie mehr.

## 0.11.0 – 2026-10-12

**Neu**
- Network+: Ports mit eigenem Namen („NAS“ statt „Port 5“) und deutsche Sensornamen werden erkannt. `switch_port`
  akzeptiert auch Port-Namen.

## 0.10.0 – 2026-10-12

**Neu**
- Editor-Button, der die automatisch erkannte Portbelegung in die Gerätekonfiguration übernimmt.

## 0.9.0 – 2026-10-12

**Neu**
- Network+: Welches Gerät an welchem Port hängt, wird automatisch aus den Link-Speed-Sensoren der Ports erkannt,
  einschließlich Link Aggregation.

## 0.8.0 – 2026-10-12

**Neu**
- Unterstützung für die Community-Integration [UniFi Network+](https://github.com/42bios/unifi-network-plus), auch
  parallel zur Core-Integration (gleiche Geräte werden zusammengeführt).
- Option `swap_port_direction`, falls Download und Upload vertauscht angezeigt werden.

## 0.7.0 – 2026-10-12

**Neu**
- Verbindungslinien zeigen den Zustand: durchgezogen in Textfarbe bei bestehender Verbindung, grau bei offline.

## 0.6.0 – 2026-10-12

**Neu**
- Kacheln „Internet ↓/↑“ mit WAN-Durchsatz und Verlauf.

## 0.5.0 – 2026-10-12

**Neu**
- Neustart-Button an Geräten (mit Rückfrage).
- Ping-/Latenz-Bereich mit 24-Stunden-Verlauf.

## 0.4.0 – 2026-10-11

**Neu**
- Link Aggregation: mehrere Ports pro Gerät, Werte werden addiert („LAG ×2“).
- Zweite Verbindung für externe Geräte (z. B. LAN und WLAN), gekennzeichnet mit `link_type`.

## 0.3.0 – 2026-10-11

**Neu**
- Anzahl verbundener Geräte an Access Points und Switches.
- Externe Geräte (`external_devices`) für alles, was nicht in UniFi vorkommt.

## 0.2.2 – 2026-10-11

**Verbessert**
- Bessere Lesbarkeit der Zusammenfassung und der Werte an den Verbindungen, besonders im hellen Theme.

## 0.2.1 – 2026-10-11

**Behoben**
- Editor: Gerät und übergeordnetes Gerät waren nicht zu unterscheiden.

## 0.2.0 – 2026-10-11

**Neu**
- Übergeordnetes Gerät pro Gerät einstellbar (`parent`) und automatische Hierarchie (`auto_parent`), damit nicht alle
  Geräte nebeneinander stehen.

**Behoben**
- Switches wie der US16P150 wurden nicht als Switch erkannt. WLAN- und Controller-Einträge erscheinen nicht mehr als
  Gerät.

## 0.1.2 – 2026-10-11

**Behoben**
- Die Kartenvorschau im Editor stürzte ab, bevor Home Assistant Daten geliefert hatte.

## 0.1.1 – 2026-10-11

**Behoben**
- Editor: Der Dialog sprang ständig nach oben und ließ sich nicht scrollen.

## 0.1.0 – 2026-10-11

Erste Version: UniFi-Topologie (Baum oder Raster) mit Theme-Farben, animierten PoE- und Datenflüssen, PoE-Budget je
Switch und visuellem Editor.
