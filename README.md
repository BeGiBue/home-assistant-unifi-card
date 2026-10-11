# UniFi Network Card

Lovelace-Karte für Home Assistant, die dein UniFi-Netzwerk als Topologie darstellt:
Gateway → Switches → Access Points / Kameras, mit Geräte-Bildern sowie **Daten- und PoE-Flüssen**.

- Liest die Geräte direkt aus der **UniFi-Integration** (kein extra Backend nötig)
- **Theme-sensitiv**: alle Farben stammen aus dem aktiven Home-Assistant-Theme (Hell/Dunkel inklusive)
- **Visueller Editor** mit nativen HA-Selektoren (Geräte-, Entitäts-, Farb-Auswahl), YAML bleibt möglich
- Animierte Linien: PoE-Leistung, Download, Upload je Verbindung, PoE-Budget je Switch
- Status (online/offline), Update-Hinweis, Klick öffnet die Geräte-Details

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
| `image_base` | – | Ordner mit Geräte-Bildern, Dateiname `{Modell}.png` (Leerzeichen → `-`) |
| `poe_color` / `down_color` / `up_color` | Theme | Farbe (HA-Farbname, Hex oder `rgb()`) |
| `devices[]` | – | Einstellungen pro Gerät, siehe unten |

`devices[]`-Felder: `device` (Pflicht), `name`, `image`, `switch_port`, `poe_entity`, `down_entity`,
`up_entity`, `poe_budget`.

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
