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
  assert.match(html, /↓ 38 Mb\/s/);
  assert.match(html, /↑ 12 Mb\/s/);
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
