import test from "node:test";
import assert from "node:assert/strict";
import {
  typeOf,
  toMbit,
  formatRate,
  formatPower,
  findPortEntity,
  numericState,
  resolveColor,
  buildTree,
  resolveParents,
  isNetworkDevice,
  collectUnifiDevices,
  parsePorts,
  downsample,
  sparkline,
} from "../src/utils.js";

test("typeOf erkennt UniFi-Modelle", () => {
  assert.equal(typeOf("UDM-Pro"), "gateway");
  assert.equal(typeOf("UDR"), "gateway");
  assert.equal(typeOf("USW-Pro-24-PoE"), "switch");
  assert.equal(typeOf("US-8-150W"), "switch");
  assert.equal(typeOf("US16P150"), "switch");
  assert.equal(typeOf("US8P60"), "switch");
  assert.equal(typeOf("U6-Pro"), "ap");
  assert.equal(typeOf("U7-Pro"), "ap");
  assert.equal(typeOf("UVC-G4-Doorbell"), "camera");
  assert.equal(typeOf("UP-Phone"), "phone");
  assert.equal(typeOf("Irgendwas"), "other");
  assert.equal(typeOf(), "other");
});

test("toMbit rechnet Einheiten um", () => {
  assert.equal(toMbit(10, "Mbit/s"), 10);
  assert.equal(toMbit(1, "Gbit/s"), 1000);
  assert.equal(toMbit(500, "kbit/s"), 0.5);
  assert.equal(toMbit(1, "MB/s"), 8);
  assert.equal(toMbit("abc"), null);
});

test("formatRate / formatPower", () => {
  assert.equal(formatRate(null), "–");
  assert.equal(formatRate(0.25, "en"), "250 kb/s");
  assert.equal(formatRate(12.34, "en"), "12.3 Mb/s");
  assert.equal(formatRate(212.4, "en"), "212 Mb/s");
  assert.equal(formatRate(1500, "en"), "1.5 Gb/s");
  assert.equal(formatPower(8.94, "en"), "8.9 W");
  assert.equal(formatPower(undefined), "–");
});

const states = [
  { entity_id: "sensor.switch_port_5_poe_power", attributes: { friendly_name: "Switch Port 5 PoE Power", device_class: "power" } },
  { entity_id: "sensor.switch_port_5_rx", attributes: { friendly_name: "Switch Port 5 RX", device_class: "data_rate" } },
  { entity_id: "sensor.switch_port_5_tx", attributes: { friendly_name: "Switch Port 5 TX", device_class: "data_rate" } },
  { entity_id: "sensor.switch_port_15_poe_power", attributes: { friendly_name: "Switch Port 15 PoE Power", device_class: "power" } },
];

test("findPortEntity findet Port-Sensoren und verwechselt 5 nicht mit 15", () => {
  assert.equal(findPortEntity(states, 5, "poe").entity_id, "sensor.switch_port_5_poe_power");
  assert.equal(findPortEntity(states, 5, "rx").entity_id, "sensor.switch_port_5_rx");
  assert.equal(findPortEntity(states, 5, "tx").entity_id, "sensor.switch_port_5_tx");
  assert.equal(findPortEntity(states, 15, "poe").entity_id, "sensor.switch_port_15_poe_power");
  assert.equal(findPortEntity(states, 7, "poe"), undefined);
  assert.equal(findPortEntity(states, undefined, "poe"), undefined);
});

test("numericState", () => {
  assert.equal(numericState({ state: "12.5" }), 12.5);
  assert.equal(numericState({ state: "unavailable" }), null);
  assert.equal(numericState(undefined), null);
});

test("resolveColor", () => {
  assert.equal(resolveColor(undefined, "x"), "x");
  assert.equal(resolveColor("#ff0000", "x"), "#ff0000");
  assert.equal(resolveColor("red", "x"), "var(--red-color, x)");
  assert.equal(resolveColor([1, 2, 3], "x"), "rgb(1,2,3)");
});

test("buildTree ordnet nach Elternbeziehung", () => {
  const devs = [
    { id: "ap", name: "AP", type: "ap", parent: "sw" },
    { id: "sw", name: "SW", type: "switch", parent: "gw" },
    { id: "gw", name: "GW", type: "gateway", parent: null },
    { id: "orphan", name: "Orphan", type: "ap", parent: "missing" },
  ];
  const { roots, children } = buildTree(devs);
  assert.deepEqual(roots.map((d) => d.id), ["gw", "orphan"]);
  assert.deepEqual(children.gw.map((d) => d.id), ["sw"]);
  assert.deepEqual(children.sw.map((d) => d.id), ["ap"]);
});

test("isNetworkDevice blendet WLAN-/Controller-Einträge aus", () => {
  assert.equal(isNetworkDevice({ model: "UniFi WLAN" }), false);
  assert.equal(isNetworkDevice({ model: "UniFi Network" }), false);
  assert.equal(isNetworkDevice({ model: "U6-Pro", entry_type: "service" }), false);
  assert.equal(isNetworkDevice({ model: "US16P150" }), true);
});

const dev = (id, type, extra = {}) => ({ id, name: id, type, viaParent: null, cfgParent: null, ...extra });

test("resolveParents: Automatik haengt Switches ans Gateway und APs an den einzigen Switch", () => {
  const out = resolveParents([dev("gw", "gateway"), dev("sw", "switch"), dev("ap", "ap"), dev("cam", "camera")]);
  const p = Object.fromEntries(out.map((d) => [d.id, d.parent]));
  assert.deepEqual(p, { gw: null, sw: "gw", ap: "sw", cam: "sw" });
});

test("resolveParents: mehrere Switches -> APs ans Gateway, explizite Zuordnung gewinnt", () => {
  const out = resolveParents([
    dev("gw", "gateway"),
    dev("s1", "switch"),
    dev("s2", "switch"),
    dev("a1", "ap"),
    dev("a2", "ap", { cfgParent: "s2" }),
    dev("a3", "ap", { viaParent: "s1" }),
  ]);
  const p = Object.fromEntries(out.map((d) => [d.id, d.parent]));
  assert.deepEqual(p, { gw: null, s1: "gw", s2: "gw", a1: "gw", a2: "s2", a3: "s1" });
});

test("resolveParents: ohne Automatik bleiben Geraete ohne Eltern, Zyklen werden aufgeloest", () => {
  const flat = resolveParents([dev("gw", "gateway"), dev("sw", "switch")], false);
  assert.equal(flat.find((d) => d.id === "sw").parent, null);
  const cyc = resolveParents([dev("a", "ap", { cfgParent: "b" }), dev("b", "ap", { cfgParent: "a" })], false);
  assert.ok(cyc.some((d) => d.parent === null));
});

test("collectUnifiDevices filtert auf UniFi-Netzwerkgeraete", () => {
  const hass = {
    devices: {
      a: { id: "a", name: "Switch", manufacturer: "Ubiquiti", model: "US16P150", config_entries: ["e1"] },
      b: { id: "b", name: "SSID", manufacturer: "Ubiquiti", model: "UniFi WLAN", config_entries: ["e1"] },
      c: { id: "c", name: "Lampe", manufacturer: "Philips", model: "Hue", config_entries: ["e2"] },
      d: { id: "d", name: "AP", manufacturer: "Ubiquiti", model: "U6-Pro", config_entries: ["e2"] },
    },
    entities: {
      "sensor.a": { entity_id: "sensor.a", device_id: "a", platform: "unifi" },
      "sensor.b": { entity_id: "sensor.b", device_id: "b", platform: "unifi" },
      "light.c": { entity_id: "light.c", device_id: "c", platform: "hue" },
      "sensor.d": { entity_id: "sensor.d", device_id: "d", platform: "unifi" },
    },
  };
  assert.deepEqual(collectUnifiDevices(hass).list.map((d) => d.id), ["a", "d"]);
  assert.deepEqual(collectUnifiDevices(hass, "e2").list.map((d) => d.id), ["d"]);
  assert.deepEqual(collectUnifiDevices(hass).byDevice.a.map((e) => e.entity_id), ["sensor.a"]);
  assert.deepEqual(collectUnifiDevices(undefined).list, []);
});

test("parsePorts versteht Zahl, Text und Liste (Link Aggregation)", () => {
  assert.deepEqual(parsePorts(5), [5]);
  assert.deepEqual(parsePorts("6, 7"), [6, 7]);
  assert.deepEqual(parsePorts("6;7 8"), [6, 7, 8]);
  assert.deepEqual(parsePorts([3, "4", 3]), [3, 4]);
  assert.deepEqual(parsePorts(""), []);
  assert.deepEqual(parsePorts(undefined), []);
  assert.deepEqual(parsePorts("abc"), []);
});

test("downsample und sparkline", () => {
  assert.deepEqual(downsample([1, 2, 3], 10), [1, 2, 3]);
  assert.equal(downsample(Array.from({ length: 1000 }, (_, i) => i), 100).length, 100);
  assert.equal(sparkline([1]), null);
  const sp = sparkline([1, 3, 2], 100, 30, 2);
  assert.match(sp.line, /^M0\.0,28\.0 L50\.0,2\.0 L100\.0,15\.0$/);
  assert.match(sp.area, /Z$/);
});

test("UniFi Network+: Controller-Eintrag ausgeblendet, Duplikate zur Core-Integration zusammengeführt", () => {
  const hass = {
    devices: {
      ctrl: { id: "ctrl", name: "UniFi Network+", manufacturer: "Ubiquiti", model: "Network Controller", config_entries: ["p"] },
      coreSw: { id: "coreSw", name: "Keller", manufacturer: "Ubiquiti", model: "US16P150", config_entries: ["c"] },
      plusSw: { id: "plusSw", name: "keller", manufacturer: "Ubiquiti", model: "US16P150", config_entries: ["p"] },
      plusAp: { id: "plusAp", name: "Werkstatt", manufacturer: "Ubiquiti", model: "U7PG2", config_entries: ["p"] },
    },
    entities: {
      "sensor.ctrl_wan": { entity_id: "sensor.ctrl_wan", device_id: "ctrl", platform: "unifi_network_plus" },
      "device_tracker.keller": { entity_id: "device_tracker.keller", device_id: "coreSw", platform: "unifi" },
      "sensor.keller_port_5_download": { entity_id: "sensor.keller_port_5_download", device_id: "plusSw", platform: "unifi_network_plus" },
      "sensor.werkstatt_clients": { entity_id: "sensor.werkstatt_clients", device_id: "plusAp", platform: "unifi_network_plus" },
    },
  };
  const { list, byDevice } = collectUnifiDevices(hass);
  assert.deepEqual(list.map((d) => d.id).sort(), ["coreSw", "plusAp"]);
  assert.deepEqual(byDevice.coreSw.map((e) => e.entity_id).sort(), ["device_tracker.keller", "sensor.keller_port_5_download"]);
});
