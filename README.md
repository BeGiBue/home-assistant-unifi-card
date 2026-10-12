# UniFi Network Card

Lovelace-Karte für Home Assistant, die dein UniFi-Netzwerk als Topologie darstellt:
Gateway → Switches → Access Points / Kameras, mit Geräte-Bildern sowie **Daten- und PoE-Flüssen**.

- Liest die Geräte direkt aus der **UniFi-Integration** (kein extra Backend nötig)
- **Theme-sensitiv**: alle Farben stammen aus dem aktiven Home-Assistant-Theme (Hell/Dunkel inklusive)
- **Visueller Editor** mit nativen HA-Selektoren (Geräte-, Entitäts-, Farb-Auswahl), YAML bleibt möglich
- Animierte Linien: PoE-Leistung, Download, Upload je Verbindung, PoE-Budget je Switch
- Status (online/offline), Update-Hinweis, Klick öffnet die Geräte-Details
- **Neustart-Buttons** an den Geräten (mit Bestätigung) und **Ping/Latenz** der WAN-Ziele mit 24-h-Verlauf

## Installation

### HACS (empfohlen)

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=BeGiBue&repository=unifi-custom-card&category=plugin)

Per Klick auf den Button (öffnet die Repository-Seite in deiner Home-Assistant-Instanz) oder manuell:

1. HACS → Frontend → ⋮ → *Benutzerdefinierte Repositories*
2. `https://github.com/BeGiBue/unifi-custom-card`, Kategorie **Dashboard** hinzufügen
3. „UniFi Network Card“ installieren, Browser-Cache leeren

### Manuell

`unifi-network-card.js` aus dem [neuesten Release](https://github.com/BeGiBue/unifi-custom-card/releases/latest)
nach `/config/www/` kopieren und unter *Einstellungen → Dashboards → Ressourcen* als **JavaScript-Modul**
`/local/unifi-network-card.js` hinzufügen.

## Verwendung

Die Karte lässt sich über den Karten-Dialog („UniFi Network Card“) mit dem visuellen Editor konfigurieren.
Per YAML:

```yaml
type: custom:unifi-network-card
title: UniFi Netzwerk
layout: tree            # tree | grid
show_offline: true
show_flows: true
animate_flows: true
show_summary: true
show_legend: true
auto_parent: true       # Hierarchie automatisch ableiten
show_clients: true      # Anzahl verbundener Geräte an Switches/APs
config_entry: 01H…      # optional: nur einen UniFi-Controller anzeigen
image_base: /local/unifi/   # optional, Datei: {Modell}.png
poe_color: orange       # optional, sonst --warning-color
down_color: blue        # optional, sonst --info-color
up_color: green         # optional, sonst --success-color
devices:
  - device: 3f2a…       # Geräte-ID (im Editor per Auswahl)
    name: Switch Keller
    poe_budget: 400     # nur Switches: PoE-Budget in W
  - device: 9c1b…
    name: AP Wohnzimmer
    switch_port: 5      # Port am übergeordneten Switch
  - device: 77de…
    switch_port: 9
    poe_entity: sensor.switch_keller_port_9_poe_power   # optional, überschreibt die Automatik
    down_entity: sensor.switch_keller_port_9_tx
    up_entity: sensor.switch_keller_port_9_rx
```

### Optionen

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `title` | `UniFi Netzwerk` | Kartentitel |
| `config_entry` | – | Nur Geräte dieses UniFi-Konfigurationseintrags |
| `layout` | `tree` | `tree` (Topologie) oder `grid` (gruppiert nach Typ) |
| `show_offline` | `true` | Offline-Geräte anzeigen |
| `show_flows` | `true` | Daten-/PoE-Flüsse anzeigen |
| `animate_flows` | `true` | Linien animieren (respektiert „Bewegung reduzieren“) |
| `show_summary` | `true` | Zusammenfassung im Kopf (Online, PoE, Down/Up) |
| `show_legend` | `true` | Legende unter der Topologie |
| `show_clients` | `true` | Anzahl verbundener Geräte an Access Points und Switches anzeigen |
| `show_restart` | `true` | Neustart-Button an Geräten mit Restart-Entität anzeigen |
| `show_latency` | `true` | Ping-/Latenz-Sensoren anzeigen |
| `latency_entities[]` | automatisch | Eigene Latenz-Sensoren (`entity`, `name`, `icon`) |
| `managed` | `false` | Nur Geräte, Ping- und Internet-Sensoren aus den Einträgen anzeigen (vom Erkennungs-Button gesetzt) |
| `swap_port_direction` | `false` | Download/Upload der Port-Sensoren vertauschen |
| `latency_hours` | `24` | Zeitraum des Verlaufs in Stunden |
| `external_devices[]` | – | Geräte außerhalb von UniFi manuell anzeigen (siehe unten) |
| `auto_parent` | `true` | Hierarchie automatisch ableiten, wenn Home Assistant sie nicht liefert (siehe unten) |
| `image_base` | – | Ordner mit Geräte-Bildern, Dateiname `{Modell}.png` (Leerzeichen → `-`) |
| `poe_color` / `down_color` / `up_color` | Theme | Farbe (HA-Farbname, Hex oder `rgb()`) |
| `devices[]` | – | Einstellungen pro Gerät, siehe unten |

`devices[]`-Felder: `device` (Pflicht), `name`, `image`, `parent`, `switch_port`, `poe_entity`, `down_entity`,
`up_entity`, `poe_budget`, `clients_entity`, `restart_entity`.

## Verbundene Geräte

An Access Points und Switches zeigt die Karte die Anzahl verbundener Geräte (Personen-Symbol), wenn die
UniFi-Integration dafür einen Sensor liefert (Name enthält „Clients“, z. B. `sensor.ap_buero_clients`).
Fehlt er oder soll ein anderer Sensor gelten, wählst du ihn pro Gerät unter `devices[].clients_entity`
(auch ein Template-Sensor ist möglich, z. B. für zusammengefasste Verbindungen). Abschalten mit
`show_clients: false`.

## UniFi Network+ (Community-Integration)

Die Karte liest Geräte aus der Core-Integration **und** aus [UniFi Network+](https://github.com/42bios/unifi-network-plus).
Laufen beide parallel, werden gleichnamige Geräte zusammengeführt (Status und Update-Hinweis aus der Core-Integration,
zusätzliche Sensoren aus Network+). Der Sammel-Eintrag „Network Controller“ erscheint nicht als Gerät.

Network+ liefert zusätzlich: **WAN Download/Upload** (Kacheln „Internet“), **WAN Latency**, Neustart-Buttons (standardmäßig
deaktiviert) und je Port **Download/Upload/PoE Power** (standardmäßig deaktiviert; bitte aktivieren). Die Port-Sensoren
heißen „{Portname} Download/Upload“. Erkannt wird der Port über den Namen „Port N“. Hast du Ports in UniFi umbenannt,
gib die Sensoren am Gerät direkt an (`poe_entity`, `down_entity`, `up_entity`).

**Einträge statt unsichtbarer Automatik:** Der Button „Automatische Erkennung neu starten“ (im Editor unter der Geräteliste)
legt für **jedes UniFi-Gerät** einen Eintrag in `devices` an (Name, bei erkannter Zuordnung auch übergeordnetes Gerät, Port und
bei einem Port die Sensoren für PoE, Download und Upload), für jeden **Ping-Sensor** einen Eintrag in `latency_entities` und trägt
die **Internet-Sensoren** (`wan_down_entity`, `wan_up_entity`) ein. Dabei wird `managed: true` gesetzt: Die Karte zeigt dann nur
noch, was in der Liste steht. **Einen Eintrag zu löschen blendet das Gerät oder den Ping-Sensor aus.** Nur ein erneuter Klick auf
den Button ergänzt gelöschte Einträge wieder. Bei einer neuen, leeren Karte läuft die Erkennung beim ersten Öffnen des Editors
einmal automatisch. Mit `managed: false` zeigt die Karte wieder alles automatisch an.

Was die Automatik geschrieben hat, merkt sich der Eintrag unter `auto_detected`. Ein erneuter Klick aktualisiert genau diese
Felder (z. B. nach dem Umstecken eines Kabels). Selbst eingetragene oder nachträglich geänderte Werte werden nie
überschrieben. Ist ein Gerät nicht mehr erkennbar, verschwinden nur die automatisch geschriebenen Felder.

**PoE:** Wird ein Gerät nicht über PoE versorgt (Leistung 0 W oder kein PoE-Sensor), entfällt die PoE-Anzeige und die
orangefarbene Linie an der Verbindung.

**Benannte Ports und deutsche Namen:** Network+ benennt die Sensoren nach dem Port-Namen aus UniFi
(„Keller NAS Download“, „Keller Port 5 PoE-Leistung“). Die Karte erkennt sowohl „Port N“ als auch eigene Namen und
die deutschen Bezeichnungen („Verbindungsgeschwindigkeit“, „PoE-Leistung“). Bei `switch_port` kannst du deshalb auch den
Port-Namen eintragen, mehrere durch Komma oder Semikolon getrennt (`NAS 1; NAS 2`).

**Automatische Port-Zuordnung:** Die Sensoren „Port N Link Speed“ von Network+ nennen das angeschlossene Gerät
(`connected_mac` / `connected_device`). Die Karte ordnet damit APs, Kameras und Switches automatisch dem richtigen
Port (und bei mehreren Ports zum selben Gerät einer Link Aggregation) sowie dem richtigen Uplink zu. Voraussetzung:
die Link-Speed-Sensoren der Ports sind aktiviert und heißen „… Port N …“. Manuelle Angaben (`switch_port`, `parent`) haben
immer Vorrang. Gleichrangige Geräte (zwei Switches) ordnest du weiterhin per `parent` zu.

Hinweis zur Richtung: „Download“ eines Ports ist der Empfang am Switch, also der **Upload des angeschlossenen Geräts**.
Die Karte berücksichtigt das. Zeigt sie bei dir die Pfeile vertauscht, schalte `swap_port_direction: true` ein.

## Geräte-Fenster und PoE-Steuerung

- **Klick auf ein Gerät** öffnet ein kleines Fenster mit Status, IP-Adresse, Betriebszeit und Neustart (mit Rückfrage), ohne
  Sensor-Details. Die IP stammt aus `devices[].ip`, einem Tracker-Attribut oder (UniFi Network+) vom Switch-Port des Uplinks.
  Die Betriebszeit kommt aus einem Uptime-Sensor des Geräts und entfällt, wenn es keinen gibt.
- **Klick auf eine Verbindung** bietet für den Port **PoE ausschalten/einschalten** (Schalter „Port PoE“) und **PoE neu starten**
  (Button „Power Cycle“) an. Beides sind Entitäten des übergeordneten Switches, in Home Assistant standardmäßig deaktiviert und
  nur mit Admin-Rechten nutzbar. Mit `poe_switch_entity` und `poe_cycle_entity` gibst du sie am Gerät direkt an.

## Neustart

Hat ein Gerät in der UniFi-Integration einen Neustart-Button (z. B. `button.keller_restart`), erscheint oben links an
der Kachel ein kleines Neustart-Symbol. Ein Klick fragt „… wirklich neu starten?“ – erst nach Bestätigung wird
`button.press` aufgerufen. Die Erkennung ist automatisch; mit `devices[].restart_entity` (auch bei externen Geräten)
wählst du einen anderen Button, mit `show_restart: false` blendest du alles aus. Der Button muss in Home Assistant
aktiviert sein.

## Internet-Durchsatz (WAN)

Die Core-Integration liefert keinen WAN-Durchsatz. Mit einer Community-Integration wie
[UniFi Network+](https://github.com/42bios/unifi-network-plus) (Sensoren „WAN Download/Upload“) zeigt die Karte
unter der Topologie zwei Kacheln „Internet ↓/↑“ mit Verlauf. Die Sensoren werden am Namen erkannt
(`WAN` + `Download`/`Upload`, ohne Speedtest); sonst wählst du sie mit `wan_down_entity` und `wan_up_entity`.
Abschalten mit `show_wan: false`.

## Ping / Latenz

Unter der Topologie zeigt die Karte die WAN-Latenz-Sensoren des Gateways (z. B.
`sensor.ucg_ultra_cloudflare_wan_latency`) mit aktuellem Wert und Verlaufsgraph (`latency_hours`, Standard 24 h;
Daten aus dem Home-Assistant-Verlauf). Name und Symbol werden aus dem Sensor abgeleitet (Cloudflare, Google,
Microsoft bekommen passende Symbole). Eigene Auswahl:

```yaml
latency_entities:
  - entity: sensor.ucg_ultra_cloudflare_wan_latency
    name: Cloudflare
    icon: mdi:cloud-outline
```

## Externe Geräte

Geräte, die nicht in UniFi vorkommen (NAS, Drucker, Server, Smart-Home-Bridge …), legst du unter
`external_devices` an. Sie hängen am gewählten UniFi-Gerät und erscheinen mit gestricheltem Rand:

```yaml
external_devices:
  - name: NAS
    model: Synology DS923+
    icon: mdi:nas              # beliebiges Home-Assistant-Symbol (oder `image:` mit URL)
    parent: 3f2a…              # UniFi-Gerät (im Editor per Auswahl)
    switch_port: 6             # Port am übergeordneten Gerät -> PoE/Daten wie bei UniFi-Geräten
    entity: binary_sensor.nas_online   # optional: Status (on/home/Zahl = online)
```

Ohne `entity` gilt das Gerät als online. `poe_entity`, `down_entity` und `up_entity` funktionieren wie bei
UniFi-Geräten. Ohne `parent` ordnet die Automatik das Gerät wie einen Access Point ein.

## Link Aggregation und zwei Verbindungen

**Link Aggregation (z. B. NAS mit zwei Kabeln):** Trage bei `switch_port` mehrere Ports ein, etwa `"6, 7"`.
Die Karte addiert PoE-Leistung und Datenraten aller Ports und kennzeichnet die Verbindung mit „LAG ×2“.
Das gilt für UniFi- und externe Geräte (auch für Switch-Uplinks).

**Zwei Verbindungen (z. B. Mac per LAN und WLAN):** Lege das Gerät als externes Gerät an. Die erste
Verbindung (LAN) über `parent` und `switch_port`, die zweite über `parent2` (z. B. der Access Point) mit
`link_type2: wifi`. Das Gerät erscheint dann an beiden Stellen im Baum (zweite Kachel unter dem
Access Point); es wird in den Summen nur einmal gezählt. Für die WLAN-Verbindung gibt es keine
Port-Sensoren, dafür kannst du `down_entity2` und `up_entity2` (z. B. die Client-Bandbreitensensoren des
Mac) angeben.

```yaml
external_devices:
  - name: NAS
    icon: mdi:nas
    parent: <Switch>
    switch_port: "6, 7"        # Link Aggregation
  - name: MacBook
    icon: mdi:laptop
    parent: <Switch>
    switch_port: 9
    link_type: lan
    parent2: <Access Point>
    link_type2: wifi
    down_entity2: sensor.macbook_tx
    up_entity2: sensor.macbook_rx
```

`link_type` (`lan` | `wifi` | `none`) blendet eine Kennzeichnung an der Verbindung ein.

## Hierarchie (Baumansicht)

Die Karte nimmt die Uplink-Beziehung aus der Geräte-Registry (`via_device`). Liefert die UniFi-Integration
sie nicht, würden alle Geräte nebeneinander stehen. Deshalb gilt:

1. `devices[].parent` (im Editor: „Übergeordnetes Gerät (Uplink)“) hat Vorrang.
2. Sonst die Beziehung aus der Geräte-Registry.
3. Sonst, bei `auto_parent: true`: Switches hängen am Gateway, alle anderen Geräte am einzigen Switch.
   Gibt es mehrere Switches, hängen Access Points und Kameras am Gateway, bis du ihnen per `parent`
   den richtigen Switch zuweist.

Dienst-Einträge der Integration (WLAN-SSIDs, Controller) werden nicht angezeigt.

## Wie kommen die Flüsse zustande?

Die UniFi-Integration stellt PoE-Leistung und Datenrate **pro Switch-Port** bereit, aber nicht, welches
Gerät an welchem Port hängt. Deshalb ordnest du jedem Gerät **einmalig den Port am übergeordneten Gerät**
zu (`switch_port`, im Editor ein Zahlenfeld). Die Karte sucht dann beim Switch automatisch die Sensoren
dieses Ports (PoE-Leistung, RX, TX). Alternativ gibst du die Entitäten direkt an.

Hinweise:

- Die Port-Bandbreitensensoren (RX/TX) sind in der UniFi-Integration **standardmäßig deaktiviert** und
  müssen in den Entitäts-Einstellungen aktiviert werden.
- Aus Sicht des Switch-Ports ist **RX = Upload des Geräts**, **TX = Download des Geräts**; die Karte
  berücksichtigt das.
- Datenraten in anderen Einheiten (kbit/s, Gbit/s, MB/s …) werden automatisch umgerechnet.
- Die automatische Suche erkennt Sensoren am Namen (`Port 5 … PoE`, `… RX`, `… TX`). Weichen die
  Namen bei dir ab, gib die Entitäten im Gerät direkt an.

## Bilder

Die UniFi-Integration liefert keine Produktbilder. Lege deine Bilder (PNG) unter `/config/www/unifi/` ab,
z. B. `U6-Pro.png`, und setze `image_base: /local/unifi/`. Einzelne Geräte überschreibst du mit
`devices[].image`. Fehlt ein Bild, zeigt die Karte ein Icon passend zum Gerätetyp. Der Gerätetyp wird aus
dem Modellnamen abgeleitet (UDM/UDR → Gateway, USW → Switch, U6/U7 → Access Point, UVC/G4 → Kamera …).

## Anforderungen

- Home Assistant mit eingerichteter [UniFi-Integration](https://www.home-assistant.io/integrations/unifi/)
- Aktuelle Home-Assistant-Version (der Editor nutzt den `object`-Selektor mit `fields` sowie `ui_color`)

## Entwicklung

```bash
npm install
npm test          # Unit-Tests (node:test)
npm run build     # -> dist/unifi-network-card.js
npm run watch
```

Quellcode: `src/` (Karte, Editor, Styles, Übersetzungen, Hilfsfunktionen).

## Releases

Workflows unter `.github/workflows/`:

- **CI** (`ci.yml`): Tests, Build und HACS-Validierung bei jedem Push/Pull-Request.
- **Release** (`release.yml`): baut die Karte und veröffentlicht ein GitHub-Release mit
  `unifi-network-card.js` als Asset (genau das lädt HACS).

Release auslösen:

1. **Per Tag:** `git tag v1.2.3 && git push origin v1.2.3`
2. **Per Klick:** *Actions → Release → Run workflow*, Version `1.2.3` eintragen. Der Workflow legt den Tag
   selbst an. Versionen mit Suffix (`1.3.0-beta.1`) werden automatisch als Pre-release veröffentlicht.

Die Versionsnummer wird beim Build in die Datei eingebettet (sichtbar in der Browser-Konsole).

## Lizenz

MIT
