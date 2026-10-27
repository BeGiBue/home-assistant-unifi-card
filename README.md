<p align="center">
  <img src="https://raw.githubusercontent.com/BeGiBue/home-assistant-unifi-card/main/images/unifi-card-logo-160.png?v=2" alt="UniFi Card" width="160">
</p>

# UniFi Card

**Version 1.0.0**

Lovelace-Karte für Home Assistant, die dein UniFi-Netzwerk als Topologie zeigt: Gateway → Switches → Access Points,
Kameras und weitere Geräte, mit PoE-Leistung und Datenraten an jeder Verbindung.

- Liest die Geräte direkt aus der [UniFi-Integration](https://www.home-assistant.io/integrations/unifi/), kein
  zusätzliches Backend
- Optional mit [UniFi Network+](https://github.com/42bios/unifi-network-plus): Portbelegung, Hierarchie und
  WAN-Daten werden automatisch erkannt
- Animierte Linien für PoE, Download und Upload, PoE-Budget je Switch, Link Aggregation
- Klick auf ein Gerät: Status, IP, Betriebszeit, Neustart. Klick auf eine Verbindung: PoE aus/ein, PoE-Neustart
- Internet-Durchsatz und Ping mit Verlauf
- Passt sich an: Baum, kompakte Kacheln oder Liste, je nach Breite
- Farben aus dem aktiven Theme (hell und dunkel), visueller Editor, YAML möglich

## Vorschau

**Breit (800 px)**

<img src="https://raw.githubusercontent.com/BeGiBue/home-assistant-unifi-card/main/screenshots/unifi-normal-800-light.png" width="800" alt="UniFi-Topologie mit Gateway, Switch, zwei Access Points und PC am Switch, 800 px breit, helles Theme">

**Schmal (350 px)**

<img src="https://raw.githubusercontent.com/BeGiBue/home-assistant-unifi-card/main/screenshots/unifi-normal-350-light.png" width="350" alt="Dieselbe Topologie in 350 px Breite, helles Theme">

## Installation

### HACS (empfohlen)

[![In HACS öffnen](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BeGiBue&repository=home-assistant-unifi-card&category=plugin)

1. HACS öffnen und im offiziellen Katalog nach **UniFi Card** suchen.
2. **UniFi Card** auswählen und herunterladen.
3. Browser vollständig neu laden; in der Companion App bei Bedarf den Frontend-Cache zurücksetzen.
4. Unter **Dashboard bearbeiten → Karte hinzufügen** die **UniFi Network Card** auswählen.

### Bestehende Custom-Repository-Installation migrieren

1. Prüfen, ob **UniFi Card** im offiziellen HACS-Katalog verfügbar ist. Falls der Eintrag noch fehlt, zunächst die
   Repository-Informationen in HACS aktualisieren und mit dem nächsten Schritt warten, bis er sichtbar ist.
2. Unter **HACS → ⋮ → Benutzerdefinierte Repositories** nur den Eintrag
   `BeGiBue/home-assistant-unifi-card` entfernen.
3. Die bestehende Installation **nicht deinstallieren**. Dashboard-Ressourcen und Karten ebenfalls erhalten.
4. HACS bzw. die Repository-Informationen aktualisieren und prüfen, ob **UniFi Card** weiterhin installiert angezeigt
   wird. Das angebotene Update auf 1.0.0 installieren und das Frontend neu laden.
5. Vorhandene YAML-Konfigurationen, Gerätezuordnungen und Dashboard-Karten prüfen. Sie können weiterverwendet werden;
   eine erneute automatische Erkennung ist für die Migration nicht erforderlich.

Die Major-Version bedeutet **nicht automatisch Breaking Changes**, Kartentyp und Optionen bleiben kompatibel. Details
stehen im [Changelog](CHANGELOG.md).

### Manuell

`unifi-network-card.js` aus dem [neuesten Release](https://github.com/BeGiBue/home-assistant-unifi-card/releases/latest)
nach `/config/www/` kopieren und unter *Einstellungen → Dashboards → Ressourcen* als **JavaScript-Modul**
`/local/unifi-network-card.js` eintragen.

## Schnellstart

Karte hinzufügen und „UniFi Network Card“ wählen. Ohne weitere Einstellungen zeigt sie alle UniFi-Geräte an.
Kleinste Konfiguration per YAML:

```yaml
type: custom:unifi-network-card
```

Damit an den Verbindungen Werte stehen, braucht die Karte die **Port-Sensoren** des Switches (PoE-Leistung, Download/Upload
bzw. RX/TX). Sie sind in beiden Integrationen **standardmäßig deaktiviert** und müssen am Switch unter *Entitäten*
aktiviert werden.

## Wie die Karte dein Netzwerk erkennt

### Hierarchie (wer hängt woran)

Für jedes Gerät nimmt die Karte die erste Angabe, die vorhanden ist:

1. `devices[].parent` aus der Karte (im Editor „Übergeordnetes Gerät“)
2. die Beziehung aus der Geräte-Registry von Home Assistant
3. mit UniFi Network+: die erkannte Portbelegung (siehe unten)
4. bei `auto_parent: true` eine Faustregel: Switches hängen am Gateway, alle anderen Geräte am einzigen Switch. Gibt es
   mehrere Switches, hängen sie am Gateway, bis du per `parent` den richtigen Switch zuweist.

### Port (für PoE- und Datenwerte)

Die Werte einer Verbindung kommen von den Port-Sensoren des **übergeordneten** Geräts. Welcher Port gemeint ist, steht in
`devices[].switch_port` oder wird mit UniFi Network+ automatisch erkannt. Die Sensoren findet die Karte am Namen
(„Port 5 PoE Power“, „… Download“, „… RX“). Passen die Namen nicht, gibst du `poe_entity`, `down_entity` und `up_entity`
am Gerät direkt an.

Ein Port-Sensor misst aus Sicht des Switches: Empfang am Port ist der **Upload des angeschlossenen Geräts**. Die Karte
rechnet das um. Sind die Pfeile bei dir trotzdem vertauscht, setze `swap_port_direction: true`.

### Mit UniFi Network+

Die Karte liest Geräte aus der Core-Integration und aus Network+, auch wenn beide parallel laufen. Gleichnamige Geräte
werden dann zusammengeführt. Network+ bringt diese Erkennung mit:

- **Portbelegung:** Die Sensoren „Port N Link Speed“ nennen das Gerät am anderen Kabelende. Damit ordnet die Karte
  Access Points, Kameras und Switches dem richtigen Port zu, mehrere Ports zum selben Gerät als Link Aggregation.
- **Uplink:** Der Sensor „Uplink“ je Access Point und Switch (ab Network+ 0.3, standardmäßig aktiv) nennt das
  übergeordnete Gerät und den Port. Er reicht auch ohne Link-Speed-Sensoren und erkennt Switches, die an einem anderen
  Switch hängen. Sind beide Quellen da, gewinnen die Link-Speed-Sensoren.
- **Benannte Ports:** Hast du Ports in UniFi umbenannt („NAS“), funktioniert das ebenfalls. In `switch_port` kannst du
  dann den Namen eintragen.
- **WAN-Durchsatz und WAN-Latenz** für die Internet- und Ping-Kacheln.

Manuelle Angaben haben immer Vorrang vor der Erkennung.

### Automatische Erkennung im Editor

Der Button **„Automatische Erkennung neu starten“** (unter der Geräteliste) schreibt alles Erkannte als Einträge in die
Konfiguration: je UniFi-Gerät einen Eintrag in `devices`, die Ping-Sensoren in `latency_entities` und die
Internet-Sensoren. Dabei wird `managed: true` gesetzt. Ab dann zeigt die Karte nur, was in der Liste steht, und **ein
gelöschter Eintrag blendet das Gerät aus**.

Ein erneuter Klick aktualisiert nur die Felder, die die Erkennung selbst geschrieben hat (gemerkt unter `auto_detected`),
etwa nach dem Umstecken eines Kabels. Von dir eingetragene Werte bleiben unangetastet. Bei einer neuen Karte läuft die
Erkennung beim ersten Öffnen des Editors einmal von selbst. Mit `managed: false` zeigt die Karte wieder alles an.

## Funktionen

### Geräte-Fenster und PoE-Steuerung

- **Klick auf ein Gerät** öffnet ein Fenster mit Status, IP-Adresse, Betriebszeit und Neustart (mit Rückfrage). Die IP
  kommt aus `devices[].ip`, einem Tracker-Attribut oder dem Uplink-Port (Network+). Die Betriebszeit entfällt, wenn das
  Gerät keinen Uptime-Sensor hat.
- **Klick auf eine Verbindung** bietet **PoE aus/ein** und **PoE-Neustart** (Power Cycle) für den Port an. Die Entitäten
  gehören zum Switch, sind standardmäßig deaktiviert und brauchen Admin-Rechte im Controller. Abweichende Entitäten gibst
  du mit `poe_switch_entity` und `poe_cycle_entity` an.
- **Neustart-Symbol** oben links an der Kachel, wenn das Gerät einen Neustart-Button hat (muss aktiviert sein). Anderen
  Button wählen mit `restart_entity`, alle ausblenden mit `show_restart: false`.

Ohne PoE-Versorgung (0 W oder kein Sensor) zeigt die Verbindung keine PoE-Anzeige.

### Verbundene Geräte

Access Points und Switches zeigen die Anzahl verbundener Clients, wenn es einen passenden Sensor gibt (Name enthält
„Clients“). Einen anderen Sensor, etwa einen Template-Sensor, wählst du mit `devices[].clients_entity`.

### Internet und Ping

Unter dem Baum stehen die Kacheln **Internet ↓/↑** (WAN-Durchsatz) und **Ping** (WAN-Latenz), jeweils mit Verlauf aus dem
Home-Assistant-Recorder (`latency_hours`, Standard 24). Die Core-Integration liefert keinen WAN-Durchsatz, dafür brauchst du
Network+ oder eigene Sensoren (`wan_down_entity`, `wan_up_entity`). Ping-Sensoren werden automatisch gefunden. Eigene
Auswahl:

```yaml
latency_entities:
  - entity: sensor.ucg_ultra_cloudflare_wan_latency
    name: Cloudflare
    icon: mdi:cloud-outline
```

### Externe Geräte

Geräte außerhalb von UniFi (NAS, Drucker, Server …) legst du unter `external_devices` an. Sie hängen am gewählten
UniFi-Gerät, haben einen gestrichelten Rand und bekommen PoE- und Datenwerte über `switch_port` wie UniFi-Geräte.

```yaml
external_devices:
  - name: NAS
    model: Synology DS923+
    icon: mdi:nas                       # oder image: <URL>
    parent: 3f2a…                       # UniFi-Gerät (im Editor per Auswahl)
    switch_port: "6, 7"                 # zwei Ports = Link Aggregation
    entity: binary_sensor.nas_online    # optional: Status
```

**Status:** Ohne `entity` gilt das Gerät als online, solange am Port ein Link besteht (Link-Speed-Sensor von Network+),
sonst immer. Ist der Port aktiv (Link, PoE oder Datenverkehr), zeigt die Karte das Gerät online, auch wenn `entity` etwas
anderes meldet.

**Vorschläge:** Mit Network+ schlägt der Editor-Button **„Externe Geräte aus der Portbelegung vorschlagen“** alle Geräte
an Switch-Ports vor, die keine UniFi-Geräte sind, mit Name, Port, Symbol und IP. Du wählst aus, was übernommen wird.

**Zwei Verbindungen** (z. B. ein Mac per LAN und WLAN): Die zweite Verbindung gibst du mit `parent2` an. Das Gerät
erscheint an beiden Stellen im Baum, zählt in der Zusammenfassung aber nur einmal.

```yaml
external_devices:
  - name: MacBook
    icon: mdi:laptop
    parent: <Switch>
    switch_port: 9
    link_type: lan
    parent2: <Access Point>
    link_type2: wifi
    down_entity2: sensor.macbook_tx     # für WLAN gibt es keine Port-Sensoren
    up_entity2: sensor.macbook_rx
```

### Link Aggregation

Mehrere Ports in `switch_port` (`"6, 7"` oder `NAS 1; NAS 2`) werden addiert, die Verbindung trägt „LAG ×2“. Das gilt für
UniFi-Geräte, externe Geräte und Switch-Uplinks. Mit Network+ wird Link Aggregation automatisch erkannt.

### Schmale Displays

Passt der Baum nicht in die Breite, wechselt die Karte auf **kompakte Kacheln** und bei noch weniger Platz auf eine
**Liste** (Geräte untereinander, eingerückt). Beim Drehen des Tablets wird neu gemessen. Fest einstellen mit
`density: normal | compact | list`.

### Bilder

Die Integrationen liefern keine Produktbilder. Lege PNGs unter `/config/www/unifi/` ab, benannt nach dem Modell
(`U6-Pro.png`, Leerzeichen → `-`), und setze `image_base: /local/unifi/`. Einzelne Geräte überschreibst du mit
`devices[].image`. Ohne Bild zeigt die Karte ein Symbol passend zum Gerätetyp, abgeleitet aus dem Modell (UDM/UDR →
Gateway, USW/US → Switch, U6/U7/UAP → Access Point, UVC/G4/G5 → Kamera).

Bild-URLs dürfen lokale/relative Pfade, HTTP(S)-URLs ohne eingebettete Zugangsdaten oder Base64-Rasterbilder
(PNG, JPEG, GIF, WebP, AVIF) sein. Andere Schemata und SVG-Daten-URLs werden verworfen; dann erscheint das Gerätesymbol.
Externe Bilder lädt der Browser direkt vom angegebenen Host. Für rein lokale Nutzung Bilder unter `/local/` ablegen.

## Optionen

### Karte

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `title` | `UniFi Netzwerk` | Kartentitel |
| `layout` | `tree` | `tree` (Topologie) oder `grid` (nach Gerätetyp gruppiert) |
| `density` | `auto` | `auto`, `normal`, `compact` oder `list` |
| `config_entry` | – | Nur Geräte dieses UniFi-Konfigurationseintrags |
| `managed` | `false` | Nur Geräte und Sensoren aus den Einträgen zeigen (setzt die automatische Erkennung) |
| `auto_parent` | `true` | Hierarchie per Faustregel ergänzen, wenn nichts anderes bekannt ist |
| `show_offline` | `true` | Offline-Geräte anzeigen |
| `show_flows` | `true` | PoE- und Datenwerte an den Verbindungen |
| `animate_flows` | `true` | Linien animieren (respektiert „Bewegung reduzieren“) |
| `show_summary` | `true` | Zusammenfassung im Kopf (Geräte online, PoE gesamt, Download/Upload am Gateway) |
| `show_legend` | `true` | Legende unter dem Baum |
| `show_clients` | `true` | Anzahl verbundener Clients |
| `show_restart` | `true` | Neustart-Symbole |
| `show_wan` | `true` | Internet-Kacheln |
| `wan_down_entity` / `wan_up_entity` | automatisch | Sensoren für den WAN-Durchsatz |
| `show_latency` | `true` | Ping-Kacheln |
| `latency_entities[]` | automatisch | Ping-Sensoren (`entity`, `name`, `icon`) |
| `latency_hours` | `24` | Zeitraum des Verlaufs in Stunden |
| `swap_port_direction` | `false` | Download und Upload der Port-Sensoren tauschen |
| `image_base` | – | Ordner mit Gerätebildern (`{Modell}.png`) |
| `poe_color` / `down_color` / `up_color` | Theme | Linienfarben (HA-Farbname, Hex oder `rgb()`) |
| `devices[]` | – | Einstellungen je UniFi-Gerät |
| `external_devices[]` | – | Geräte außerhalb von UniFi |

### `devices[]` (UniFi-Geräte)

| Feld | Beschreibung |
| --- | --- |
| `device` | Geräte-ID (Pflicht, im Editor per Auswahl) |
| `name`, `image` | Anzeigename und Bild |
| `parent` | Übergeordnetes Gerät |
| `switch_port` | Port(s) am übergeordneten Gerät, Nummer oder Name, mehrere mit Komma oder Semikolon |
| `poe_entity`, `down_entity`, `up_entity` | Sensoren der Verbindung, wenn die Automatik sie nicht findet |
| `link_type` | Kennzeichnung der Verbindung: `lan`, `wifi` oder `none` |
| `poe_budget` | Nur Switches: PoE-Budget in W, zeigt einen Balken |
| `clients_entity` | Sensor für die Anzahl verbundener Clients |
| `restart_entity` | Neustart-Button |
| `ip` | IP-Adresse für das Geräte-Fenster |
| `poe_switch_entity`, `poe_cycle_entity` | PoE-Schalter und Power-Cycle-Button des Ports |

### `external_devices[]`

Wie `devices[]` (ohne `device`), dazu:

| Feld | Beschreibung |
| --- | --- |
| `name` | Name (Pflicht) |
| `model`, `icon` | Untertitel und Symbol (`mdi:…`) |
| `entity` | Status-Entität (on/home/Zahl = online) |
| `parent2`, `switch_port2`, `link_type2`, `down_entity2`, `up_entity2` | Zweite Verbindung |

## Fehlersuche

- **Keine Werte an den Verbindungen:** Port-Sensoren am Switch aktivieren (siehe Schnellstart). Ohne Network+ zusätzlich
  `switch_port` am Gerät eintragen.
- **Geräte stehen nebeneinander statt im Baum:** `parent` setzen oder Network+ installieren.
- **Neue Version wird nicht geladen:** In HACS *Informationen aktualisieren*, herunterladen, Browser- bzw. App-Cache leeren.
  Die geladene Version steht in der Browser-Konsole (`UNIFI-NETWORK-CARD 1.0.0`).
- **Dashboard springt beim Scrollen** (vor allem iPad/Companion App): `animate_flows: false` setzen.

## Anforderungen

- Home Assistant mit der UniFi-Integration und/oder UniFi Network+
- Eine aktuelle Home-Assistant-Version (der Editor nutzt den `object`-Selektor mit `fields`)

## Lizenz

AGPL-3.0-only
