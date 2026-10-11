import test from "node:test";
import assert from "node:assert/strict";

// Minimale DOM-Attrappen, damit die Karte ohne Browser gerendert werden kann
const defined = {};
globalThis.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = { innerHTML: "", querySelectorAll: () => [] };
    return this.shadowRoot;
  }
  dispatchEvent() {}
};
globalThis.customElements = { get: (n) => defined[n], define: (n, c) => (defined[n] = c) };
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({}) };
globalThis.Event = class {};
globalThis.CustomEvent = class {};

await import("../src/unifi-network-card.js");
const Card = defined["unifi-network-card"];

const ent = (entity_id, device_id, platform = "unifi") => ({ entity_id, device_id, platform });
const state = (state, attributes = {}) => ({ state, attributes });
// echte HA-State-Objekte tragen ihre entity_id
const withIds = (obj) => Object.fromEntries(Object.entries(obj).map(([id, st]) => [id, { entity_id: id, ...st }]));

const hass = {
  language: "de",
  locale: { language: "de" },
  devices: {
    gw: { id: "gw", name: "Gateway", manufacturer: "Ubiquiti", model: "UDM-Pro", sw_version: "4.0.6" },
    sw: { id: "sw", name: "Switch Keller", manufacturer: "Ubiquiti", model: "USW-Pro-24-PoE", via_device_id: "gw" },
    ap: { id: "ap", name: "AP <Büro>", manufacturer: "Ubiquiti", model: "U6-Pro", via_device_id: "sw" },
    other: { id: "other", name: "Lampe", manufacturer: "Philips", model: "Hue" },
  },
  entities: {
    "device_tracker.gw": ent("device_tracker.gw", "gw"),
    "device_tracker.sw": ent("device_tracker.sw", "sw"),
    "device_tracker.ap": ent("device_tracker.ap", "ap"),
    "sensor.sw_port_5_poe_power": ent("sensor.sw_port_5_poe_power", "sw"),
    "sensor.sw_port_5_rx": ent("sensor.sw_port_5_rx", "sw"),
    "sensor.sw_port_5_tx": ent("sensor.sw_port_5_tx", "sw"),
    "light.lampe": ent("light.lampe", "other", "hue"),
  },
  states: withIds({
    "device_tracker.gw": state("home"),
    "device_tracker.sw": state("home"),
    "device_tracker.ap": state("home"),
    "sensor.sw_port_5_poe_power": state("8.9", { friendly_name: "Switch Keller Port 5 PoE Power", device_class: "power", unit_of_measurement: "W" }),
    "sensor.sw_port_5_rx": state("12", { friendly_name: "Switch Keller Port 5 RX", device_class: "data_rate", unit_of_measurement: "Mbit/s" }),
    "sensor.sw_port_5_tx": state("38", { friendly_name: "Switch Keller Port 5 TX", device_class: "data_rate", unit_of_measurement: "Mbit/s" }),
  }),
};

test("rendert ohne hass nicht mit einem Fehler (Editor-Vorschau)", () => {
  const card = new Card();
  card.setConfig({ type: "custom:unifi-network-card" });
  assert.match(card.shadowRoot.innerHTML, /Loading|Lade/);
});

test("rendert Baum, Fluesse und escaped Namen", () => {
  const card = new Card();
  card.setConfig({ devices: [{ device: "ap", switch_port: 5 }, { device: "sw", poe_budget: 400 }] });
  card.hass = hass;
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /UDM-Pro/);
  assert.match(html, /USW-Pro-24-PoE/);
  assert.doesNotMatch(html, /Hue/);
  assert.match(html, /AP &lt;Büro&gt;/);
  assert.match(html, /8,9 W/);
  assert.match(html, /↓<\/b> 38 Mb\/s/);
  assert.match(html, /↑<\/b> 12 Mb\/s/);
  assert.match(html, /PoE 8,9 W \/ 400 W/);
  assert.match(html, /3\/3 Online/);
});

test("Raster-Layout und ohne Fluesse", () => {
  const card = new Card();
  card.setConfig({ layout: "grid", show_flows: false });
  card.hass = hass;
  assert.match(card.shadowRoot.innerHTML, /class="grid"/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /fl p/);
});

test("Offline-Geraet bekommt keinen Fluss", () => {
  const card = new Card();
  card.setConfig({ devices: [{ device: "ap", switch_port: 5 }] });
  card.hass = { ...hass, states: withIds({ ...hass.states, "device_tracker.ap": state("not_home") }) };
  assert.match(card.shadowRoot.innerHTML, /kein Link/);
});

const withClients = {
  ...hass,
  entities: { ...hass.entities, "sensor.ap_clients": ent("sensor.ap_clients", "ap"), "sensor.sw_port_6_poe_power": ent("sensor.sw_port_6_poe_power", "sw") },
  states: withIds({
    ...hass.states,
    "sensor.ap_clients": state("14", { friendly_name: "AP Büro Clients" }),
    "sensor.sw_port_6_poe_power": state("4.4", { friendly_name: "Switch Keller Port 6 PoE Power", device_class: "power", unit_of_measurement: "W" }),
    "binary_sensor.nas": state("on"),
  }),
};

test("zeigt die Anzahl verbundener Geraete am Access Point", () => {
  const card = new Card();
  card.setConfig({});
  card.hass = withClients;
  assert.match(card.shadowRoot.innerHTML, /class="cl"[^>]*>[^<]*<svg[^>]*>.*?<\/svg> 14/s);
});

test("Anzahl verbundener Geraete laesst sich abschalten oder per Sensor vorgeben", () => {
  const off = new Card();
  off.setConfig({ show_clients: false });
  off.hass = withClients;
  assert.doesNotMatch(off.shadowRoot.innerHTML, /class="cl"/);

  const manual = new Card();
  manual.setConfig({ devices: [{ device: "sw", clients_entity: "sensor.ap_clients" }] });
  manual.hass = withClients;
  assert.equal((manual.shadowRoot.innerHTML.match(/class="cl"/g) || []).length, 2); // AP (auto) + Switch (manuell)
});

test("externe Geraete erscheinen am gewaehlten Switch mit Status und PoE", () => {
  const card = new Card();
  card.setConfig({
    external_devices: [
      { name: "NAS <Keller>", model: "Synology", icon: "mdi:nas", parent: "sw", switch_port: 6, entity: "binary_sensor.nas" },
      { name: "Drucker", parent: "sw", entity: "binary_sensor.printer" },
    ],
  });
  card.hass = withClients;
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /NAS &lt;Keller&gt;/);
  assert.match(html, /<ha-icon icon="mdi:nas">/);
  assert.match(html, /tile on ext/);
  assert.match(html, /4,4 W/); // PoE-Leistung von Port 6 des Switches
  assert.match(html, /tile off ext/); // Drucker: Status-Entitaet existiert nicht -> offline
  assert.match(html, /4\/5 Online/);
});

const lagHass = {
  ...withClients,
  entities: {
    ...withClients.entities,
    "sensor.sw_port_7_rx": ent("sensor.sw_port_7_rx", "sw"),
    "sensor.sw_port_7_tx": ent("sensor.sw_port_7_tx", "sw"),
  },
  states: withIds({
    ...withClients.states,
    "sensor.sw_port_7_rx": state("8", { friendly_name: "Switch Keller Port 7 RX", device_class: "data_rate", unit_of_measurement: "Mbit/s" }),
    "sensor.sw_port_7_tx": state("20", { friendly_name: "Switch Keller Port 7 TX", device_class: "data_rate", unit_of_measurement: "Mbit/s" }),
    "sensor.mac_wifi_rx": state("5", { friendly_name: "Mac RX", device_class: "data_rate", unit_of_measurement: "Mbit/s" }),
    "sensor.mac_wifi_tx": state("40", { friendly_name: "Mac TX", device_class: "data_rate", unit_of_measurement: "Mbit/s" }),
  }),
};

test("Link Aggregation: mehrere Ports werden addiert und gekennzeichnet", () => {
  const card = new Card();
  card.setConfig({ external_devices: [{ name: "NAS", parent: "sw", switch_port: "5, 7" }] });
  card.hass = lagHass;
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /LAG ×2/);
  assert.match(html, /↓<\/b> 58 Mb\/s/); // TX Port 5 (38) + Port 7 (20)
  assert.match(html, /↑<\/b> 20 Mb\/s/); // RX Port 5 (12) + Port 7 (8)
  assert.match(html, /Port 5, 7/);
});

test("Zweite Verbindung (LAN + WLAN): zweite Kachel, nicht doppelt gezaehlt", () => {
  const card = new Card();
  card.setConfig({
    external_devices: [
      {
        name: "MacBook",
        parent: "sw",
        switch_port: 5,
        link_type: "lan",
        parent2: "ap",
        link_type2: "wifi",
        down_entity2: "sensor.mac_wifi_tx",
        up_entity2: "sensor.mac_wifi_rx",
      },
    ],
  });
  card.hass = lagHass;
  const html = card.shadowRoot.innerHTML;
  assert.equal((html.match(/MacBook/g) || []).length, 2); // zwei Kacheln
  assert.match(html, /tile on ext ghost/);
  assert.match(html, /WLAN/);
  assert.match(html, />LAN</);
  assert.match(html, /↓<\/b> 40 Mb\/s/); // WLAN-Verbindung über eigene Sensoren
  assert.match(html, /4\/4 Online/); // Gateway, Switch, AP, Mac – die zweite Kachel zählt nicht mit
});
