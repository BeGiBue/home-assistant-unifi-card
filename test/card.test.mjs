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

const restartHass = {
  ...hass,
  entities: {
    ...hass.entities,
    "button.sw_restart": ent("button.sw_restart", "sw"),
    "sensor.gw_cloudflare_wan_latency": ent("sensor.gw_cloudflare_wan_latency", "gw"),
    "sensor.gw_google_wan_latency": ent("sensor.gw_google_wan_latency", "gw"),
  },
  states: withIds({
    ...hass.states,
    "button.sw_restart": state("unknown", { friendly_name: "Switch Keller Restart", device_class: "restart" }),
    "sensor.gw_cloudflare_wan_latency": state("12.4", { friendly_name: "Gateway Cloudflare WAN latency", unit_of_measurement: "ms" }),
    "sensor.gw_google_wan_latency": state("9", { friendly_name: "Gateway Google WAN latency", unit_of_measurement: "ms" }),
  }),
};

test("Neustart-Button wird am Gerät erkannt und lässt sich abschalten", () => {
  const card = new Card();
  card.setConfig({});
  card.hass = restartHass;
  const html = card.shadowRoot.innerHTML;
  assert.equal((html.match(/class="rs"/g) || []).length, 1);
  assert.match(html, /data-entity="button.sw_restart"/);
  const off = new Card();
  off.setConfig({ show_restart: false });
  off.hass = restartHass;
  assert.doesNotMatch(off.shadowRoot.innerHTML, /class="rs"/);
});

test("Neustart verlangt Bestätigung, erst danach wird button.press ausgelöst", () => {
  const calls = [];
  const card = new Card();
  card.setConfig({});
  card.hass = { ...restartHass, callService: (...a) => calls.push(a) };
  card._confirm = { entity: "button.sw_restart", name: "Switch <Keller>" };
  card._update();
  assert.match(card.shadowRoot.innerHTML, /class="dlg"/);
  assert.match(card.shadowRoot.innerHTML, /Switch &lt;Keller&gt; wirklich neu starten\?/);
  assert.equal(calls.length, 0);
});

test("Ping-Sensoren werden automatisch erkannt, benannt und als Verlauf gezeichnet", async () => {
  const card = new Card();
  card.setConfig({});
  card.hass = {
    ...restartHass,
    callWS: async () => ({
      "sensor.gw_cloudflare_wan_latency": [{ s: "10" }, { s: "14" }, { s: "12" }],
      "sensor.gw_google_wan_latency": [],
    }),
  };
  await new Promise((r) => setTimeout(r, 5));
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /<div class="pn">Cloudflare<\/div>/);
  assert.match(html, /<div class="pn">Google<\/div>/);
  assert.match(html, /12,4 ms/);
  assert.equal((html.match(/class="sp"/g) || []).length, 1); // nur Cloudflare hat einen Verlauf
  assert.match(html, /mdi:cloud-outline/);
  const off = new Card();
  off.setConfig({ show_latency: false });
  off.hass = restartHass;
  assert.doesNotMatch(off.shadowRoot.innerHTML, /class="ping"/);
});

test("Internet-Durchsatz wird automatisch erkannt (Speedtest ignoriert) und ist überschreibbar", () => {
  const h = {
    ...restartHass,
    states: withIds({
      ...restartHass.states,
      "sensor.gw_wan_download": state("250", { friendly_name: "WAN Download", unit_of_measurement: "Mbit/s" }),
      "sensor.gw_wan_upload": state("40", { friendly_name: "WAN Upload", unit_of_measurement: "Mbit/s" }),
      "sensor.gw_speedtest_download": state("900", { friendly_name: "Speedtest Download", unit_of_measurement: "Mbit/s" }),
      "sensor.my_up": state("1", { friendly_name: "Mein Up", unit_of_measurement: "Gbit/s" }),
    }),
  };
  const card = new Card();
  card.setConfig({});
  card.hass = h;
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /Internet/);
  assert.match(html, /250 Mb\/s/);
  assert.match(html, /40,0 Mb\/s|40 Mb\/s/);
  assert.doesNotMatch(html, /900 Mb\/s/);
  const own = new Card();
  own.setConfig({ wan_up_entity: "sensor.my_up" });
  own.hass = h;
  assert.match(own.shadowRoot.innerHTML, /1,0 Gb\/s|1 Gb\/s/);
  const off = new Card();
  off.setConfig({ show_wan: false });
  off.hass = h;
  assert.doesNotMatch(off.shadowRoot.innerHTML, /Internet/);
});

test("Verbindungslinien tragen den Online-Status (verbunden / offline)", () => {
  const card = new Card();
  card.setConfig({});
  card.hass = { ...hass, states: withIds({ ...hass.states, "device_tracker.ap": state("not_home") }) };
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /<li class="on">/);
  assert.match(html, /<li class="off">/);
  assert.match(html, /class="stem on"/);
  assert.match(html, /class="stem off"/);
  assert.match(html, /<ul class="off">/); // Switch -> nur der (offline) AP darunter
});

test("UniFi Network+: Port-Sensoren Download/Upload, WAN-Latenz und Restart werden erkannt", () => {
  const h = {
    ...hass,
    devices: { ...hass.devices, ctrl: { id: "ctrl", name: "UniFi Network+", manufacturer: "Ubiquiti", model: "Network Controller" } },
    entities: {
      "device_tracker.gw": ent("device_tracker.gw", "gw"),
      "sensor.ap_cpu": ent("sensor.ap_cpu", "ap", "unifi_network_plus"),
      "sensor.sw_cpu": ent("sensor.sw_cpu", "sw", "unifi_network_plus"),
      "sensor.sw_port_5_poe_power": ent("sensor.sw_port_5_poe_power", "sw", "unifi_network_plus"),
      "sensor.sw_port_5_download": ent("sensor.sw_port_5_download", "sw", "unifi_network_plus"),
      "sensor.sw_port_5_upload": ent("sensor.sw_port_5_upload", "sw", "unifi_network_plus"),
      "sensor.sw_clients": ent("sensor.sw_clients", "sw", "unifi_network_plus"),
      "button.sw_restart": ent("button.sw_restart", "sw", "unifi_network_plus"),
      "sensor.unifi_network_wan_latency": ent("sensor.unifi_network_wan_latency", "ctrl", "unifi_network_plus"),
    },
    states: withIds({
      "device_tracker.gw": state("home"),
      "sensor.ap_cpu": state("9"),
      "sensor.sw_cpu": state("12"),
      "sensor.sw_port_5_poe_power": state("6", { friendly_name: "Switch Keller Port 5 PoE Power", device_class: "power", unit_of_measurement: "W" }),
      // Network+: "Download" = Empfang am Port = Upload des Geräts
      "sensor.sw_port_5_download": state("5", { friendly_name: "Switch Keller Port 5 Download", device_class: "data_rate", unit_of_measurement: "Mbit/s" }),
      "sensor.sw_port_5_upload": state("30", { friendly_name: "Switch Keller Port 5 Upload", device_class: "data_rate", unit_of_measurement: "Mbit/s" }),
      "sensor.sw_clients": state("7", { friendly_name: "Switch Keller Clients" }),
      "button.sw_restart": state("unknown", { friendly_name: "Switch Keller Restart" }),
      "sensor.unifi_network_wan_latency": state("11", { friendly_name: "UniFi Network+ WAN Latency", unit_of_measurement: "ms" }),
    }),
  };
  const card = new Card();
  card.setConfig({ devices: [{ device: "sw", parent: "gw" }, { device: "ap", parent: "sw", switch_port: 5 }] });
  card.hass = h;
  let html = card.shadowRoot.innerHTML;
  assert.doesNotMatch(html, /Network Controller/);
  assert.match(html, /↓<\/b> 30 Mb\/s/);
  assert.match(html, /↑<\/b> 5 Mb\/s/);
  assert.match(html, /6,0 W|6 W/);
  assert.match(html, /class="rs"/);
  assert.match(html, /WAN-Latenz/);
  const swapped = new Card();
  swapped.setConfig({ swap_port_direction: true, devices: [{ device: "ap", parent: "sw", switch_port: 5 }] });
  swapped.hass = h;
  assert.match(swapped.shadowRoot.innerHTML, /↓<\/b> 5 Mb\/s/);
});

test("Port am Switch wird automatisch zugeordnet (Link-Speed-Attribute von Network+)", () => {
  const h = {
    ...hass,
    entities: { ...hass.entities, "sensor.sw_port_5_link_speed": ent("sensor.sw_port_5_link_speed", "sw", "unifi_network_plus") },
    states: withIds({
      ...hass.states,
      "sensor.sw_port_5_link_speed": state("1000", { friendly_name: "Switch Keller Port 5 Link Speed", connected_device: "AP <Büro>" }),
    }),
  };
  const card = new Card();
  card.setConfig({});
  card.hass = h;
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /Port 5/);
  assert.match(html, /8,9 W/);
  assert.match(html, /↓<\/b> 38 Mb\/s/);
});

test("Ohne PoE-Versorgung entfällt die PoE-Anzeige", () => {
  const h = {
    ...hass,
    states: withIds({
      ...hass.states,
      "sensor.sw_port_5_poe_power": state("0", { friendly_name: "Switch Keller Port 5 PoE Power", device_class: "power", unit_of_measurement: "W" }),
    }),
  };
  const card = new Card();
  card.setConfig({ devices: [{ device: "ap", switch_port: 5 }] });
  card.hass = h;
  const html = card.shadowRoot.innerHTML;
  assert.doesNotMatch(html, /class="poe"/);
  assert.doesNotMatch(html, /fl p/);
  assert.match(html, /↓<\/b> 38 Mb\/s/); // Datenfluss bleibt
});

test("Klick auf die Verbindung bietet PoE aus/an und PoE-Neustart an", () => {
  const calls = [];
  const h = {
    ...hass,
    entities: {
      ...hass.entities,
      "switch.sw_port_5_poe": ent("switch.sw_port_5_poe", "sw", "unifi_network_plus"),
      "button.sw_port_5_power_cycle": ent("button.sw_port_5_power_cycle", "sw", "unifi_network_plus"),
    },
    states: withIds({
      ...hass.states,
      "switch.sw_port_5_poe": state("on", { friendly_name: "Switch Keller Port 5 PoE" }),
      "button.sw_port_5_power_cycle": state("unknown", { friendly_name: "Switch Keller Port 5 Power Cycle" }),
    }),
    callService: (...a) => calls.push(a),
  };
  const card = new Card();
  card.setConfig({ devices: [{ device: "ap", switch_port: 5 }] });
  card.hass = h;
  // Die PoE-Leistung (Sensor) darf nicht mit dem PoE-Schalter verwechselt werden
  assert.match(card.shadowRoot.innerHTML, /8,9 W/);
  assert.match(card.shadowRoot.innerHTML, /class="link act" data-id="ap"/);
  const ctl = card._lastModel.items.find((d) => d.id === "ap").poeCtl;
  assert.deepEqual(ctl, { switches: ["switch.sw_port_5_poe"], cycles: ["button.sw_port_5_power_cycle"], on: true });
  card._confirm = { type: "poe", name: "AP", port: "Switch Keller · Port 5", switches: ctl.switches, cycles: ctl.cycles };
  card._update();
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /data-act="poe-toggle"/);
  assert.match(html, /PoE ausschalten/);
  assert.match(html, /data-act="poe-cycle"/);
});

test("Klick auf ein Gerät zeigt Status, IP, Betriebszeit und Neustart – keine Sensordetails", () => {
  const h = {
    ...restartHass,
    entities: { ...restartHass.entities, "sensor.sw_uptime": ent("sensor.sw_uptime", "sw") },
    states: withIds({
      ...restartHass.states,
      "sensor.sw_uptime": state(new Date(Date.now() - (2 * 86400 + 3 * 3600 + 5 * 60) * 1000).toISOString(), { friendly_name: "Switch Keller Uptime", device_class: "timestamp" }),
      "sensor.sw_port_5_link_speed": state("1000", { friendly_name: "Switch Keller Port 5 Link Speed", connected_device: "AP <Büro>", connected_ip: "192.168.1.20" }),
    }),
    entities2: null,
  };
  h.entities["sensor.sw_port_5_link_speed"] = ent("sensor.sw_port_5_link_speed", "sw");
  const card = new Card();
  card.setConfig({});
  card.hass = h;
  card._confirm = { type: "device", id: "sw" };
  card._update();
  let html = card.shadowRoot.innerHTML;
  assert.match(html, /2 T 3 Std/);
  assert.match(html, /data-act="dev-restart"/);
  assert.match(html, /Betriebszeit/);
  // IP eines Geräts kommt vom Port des Uplinks
  card._confirm = { type: "device", id: "ap" };
  card._update();
  html = card.shadowRoot.innerHTML;
  assert.match(html, /192\.168\.1\.20/);
  assert.doesNotMatch(html, /data-act="dev-restart"/); // AP hat hier keinen Neustart-Button
});

test("Verwaltete Liste: nur Geräte mit Eintrag, Ping nur aus latency_entities", () => {
  const h = {
    ...restartHass,
    states: withIds({ ...restartHass.states }),
  };
  const card = new Card();
  card.setConfig({ managed: true, devices: [{ device: "gw" }, { device: "sw" }], latency_entities: [{ entity: "sensor.gw_google_wan_latency", name: "Google" }] });
  card.hass = h;
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /UDM-Pro/);
  assert.match(html, /USW-Pro-24-PoE/);
  assert.doesNotMatch(html, /U6-Pro/); // AP ohne Eintrag: ausgeblendet
  assert.match(html, /<div class="pn">Google<\/div>/);
  assert.doesNotMatch(html, /Cloudflare/); // nicht in latency_entities: nicht automatisch ergänzt
  const empty = new Card();
  empty.setConfig({ managed: true, devices: [{ device: "gw" }] });
  empty.hass = h;
  assert.doesNotMatch(empty.shadowRoot.innerHTML, /class="ping"/);
});

test("Externes Gerät mit veralteter Status-Entität bleibt online, wenn der Port aktiv ist", () => {
  const h = {
    ...hass,
    entities: { ...hass.entities, "sensor.sw_port_6_link_speed": ent("sensor.sw_port_6_link_speed", "sw", "unifi_network_plus") },
    states: withIds({
      ...hass.states,
      "device_tracker.nas": state("not_home"),
      "sensor.sw_port_6_link_speed": state("1000", { friendly_name: "Switch Keller Port 6 Link Speed" }),
    }),
  };
  const card = new Card();
  card.setConfig({ external_devices: [{ name: "NAS", parent: "sw", switch_port: "6", entity: "device_tracker.nas" }] });
  card.hass = h;
  assert.match(card.shadowRoot.innerHTML, /tile on ext/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /kein Link/);
  // Port nicht aktiv (Link-Speed nicht verfügbar): weiter offline
  const off = new Card();
  off.setConfig({ external_devices: [{ name: "NAS", parent: "sw", switch_port: "6", entity: "device_tracker.nas" }] });
  off.hass = { ...h, states: withIds({ ...h.states, "sensor.sw_port_6_link_speed": state("unavailable", { friendly_name: "Switch Keller Port 6 Link Speed" }) }) };
  assert.match(off.shadowRoot.innerHTML, /tile off ext/);
});

test("Externes Gerät ohne Status-Entität: Link-Speed-Sensor des Ports ist der Standard", () => {
  const mk = (speed) => ({
    ...hass,
    entities: { ...hass.entities, "sensor.sw_port_6_link_speed": ent("sensor.sw_port_6_link_speed", "sw", "unifi_network_plus") },
    states: withIds({ ...hass.states, "sensor.sw_port_6_link_speed": state(speed, { friendly_name: "Switch Keller Port 6 Link Speed" }) }),
  });
  const cfg = { external_devices: [{ name: "NAS", parent: "sw", switch_port: "6" }] };
  const up = new Card();
  up.setConfig(cfg);
  up.hass = mk("1000");
  assert.match(up.shadowRoot.innerHTML, /tile on ext/);
  const down = new Card();
  down.setConfig(cfg);
  down.hass = mk("0");
  assert.match(down.shadowRoot.innerHTML, /tile off ext/);
});

const liveHass = (rx) => ({ ...hass, states: withIds({ ...hass.states, "sensor.sw_port_5_rx": state(rx, { friendly_name: "Switch Keller Port 5 RX", device_class: "data_rate", unit_of_measurement: "Mbit/s" }) }) });

test("Scroll-Schutz: Liveswerte werden beim Scrollen zurückgestellt und danach nachgezogen", () => {
  const card = new Card();
  card.setConfig({ devices: [{ device: "ap", switch_port: 5 }] });
  card.hass = liveHass("12");
  assert.match(card.shadowRoot.innerHTML, /↑<\/b> 12 Mb\/s/);

  card._hold(60000); // Nutzer scrollt gerade
  card.hass = liveHass("20");
  assert.match(card.shadowRoot.innerHTML, /↑<\/b> 12 Mb\/s/, "DOM bleibt während des Scrollens unangetastet");
  assert.ok(card._deferTimer, "Nachziehen ist eingeplant");

  card._holdUntil = 0; // Scrollen beendet
  card._update();
  assert.match(card.shadowRoot.innerHTML, /↑<\/b> 20 Mb\/s/);
  card._unbindScrollGuard(); // Timer aufräumen
});

test("Scroll-Schutz: Dialoge nach Klick erscheinen sofort, auch beim Scrollen", () => {
  const card = new Card();
  card.setConfig({});
  card.hass = hass;
  card._hold(60000);
  card._confirm = { type: "device", id: "sw" };
  card._update();
  assert.match(card.shadowRoot.innerHTML, /data-act="dev-restart"|Betriebszeit/);
  card._unbindScrollGuard();
});

test("Dichte-Messung läuft nur bei geänderter Struktur/Breite, nicht bei reinen Wertänderungen", () => {
  const card = new Card();
  let fits = 0;
  card._fit = () => fits++;
  card.setConfig({ devices: [{ device: "ap", switch_port: 5 }] }); // rendert schon einmal ohne hass
  fits = 0;
  card.hass = liveHass("12");
  assert.equal(fits, 1);
  card.hass = liveHass("20");
  card.hass = liveHass("30");
  assert.equal(fits, 1, "Wertänderungen messen nicht neu");
  card.hass = { ...hass, devices: { ...hass.devices, ap2: { id: "ap2", name: "AP 2", manufacturer: "Ubiquiti", model: "U6-Lite", via_device_id: "sw" } }, entities: { ...hass.entities, "device_tracker.ap2": ent("device_tracker.ap2", "ap2") }, states: withIds({ ...hass.states, "device_tracker.ap2": state("home") }) };
  assert.equal(fits, 2, "neues Gerät misst neu");
});
