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
  detectLinks,
  buildAutoDeviceEntries,
  portSensorKey,
  formatDuration,
  uptimeSeconds,
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
  assert.deepEqual(parsePorts("abc"), ["abc"]); // Port mit eigenem Namen
  assert.deepEqual(parsePorts("NAS 1; NAS 2"), ["NAS 1", "NAS 2"]);
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

test("detectLinks ordnet Geräte über die Link-Speed-Sensoren den Ports zu", () => {
  const devs = [
    { id: "gw", name: "Router", type: "gateway", mac: "", entityIds: ["sensor.gw_port_2_link_speed"] },
    { id: "sw", name: "Keller", type: "switch", mac: "aa:bb:cc:00:00:01", entityIds: ["sensor.sw_port_1_link_speed", "sensor.sw_port_5_link_speed", "sensor.sw_port_6_link_speed", "sensor.sw_port_9_link_speed"] },
    { id: "ap", name: "Werkstatt", type: "ap", mac: "aa:bb:cc:00:00:02", entityIds: [] },
    { id: "nas", name: "NAS", type: "other", mac: "", entityIds: [] },
  ];
  const mk = (name, attrs) => ({ state: "1000", attributes: { friendly_name: name, ...attrs } });
  const states = {
    "sensor.gw_port_2_link_speed": mk("Router Port 2 Link Speed", { connected_mac: "AA:BB:CC:00:00:01" }),
    "sensor.sw_port_1_link_speed": mk("Keller Port 1 Link Speed", { connected_device: "Router" }), // Uplink: gleichrangig/oberhalb -> ignorieren
    "sensor.sw_port_5_link_speed": mk("Keller Port 5 Link Speed", { connected_mac: "aa:bb:cc:00:00:02" }),
    "sensor.sw_port_6_link_speed": mk("Keller Port 6 Link Speed", { connected_device: "nas" }),
    "sensor.sw_port_9_link_speed": mk("Keller Port 9 Link Speed", { connected_device: "NAS" }),
  };
  const out = detectLinks(devs, states);
  assert.deepEqual(out.sw, { parent: "gw", ports: [2] });
  assert.deepEqual(out.ap, { parent: "sw", ports: [5] });
  assert.deepEqual(out.nas, { parent: "sw", ports: [6, 9] }); // Link Aggregation
  assert.equal(out.gw, undefined);
});

test("buildAutoDeviceEntries füllt nur leere Felder und lässt LAG-Entitäten weg", () => {
  const list = [
    { id: "sw", name: "Keller", model: "US16P150" },
    { id: "ap", name: "Werkstatt", model: "U7PG2", connections: [["mac", "aa:00"]] },
    { id: "nas", name: "NAS", model: "Foo" },
  ];
  const e = (id, device_id) => ({ entity_id: id, device_id });
  const byDevice = {
    sw: [e("sensor.sw_p5_link", "sw"), e("sensor.sw_p5_poe", "sw"), e("sensor.sw_p5_dl", "sw"), e("sensor.sw_p5_ul", "sw"), e("sensor.sw_p6_link", "sw"), e("sensor.sw_p7_link", "sw")],
    ap: [],
    nas: [],
  };
  const st = (n, a = {}) => ({ state: "1", attributes: { friendly_name: n, ...a } });
  const states = {
    "sensor.sw_p5_link": st("Keller Port 5 Link Speed", { connected_mac: "AA:00" }),
    "sensor.sw_p5_poe": st("Keller Port 5 PoE Power", { device_class: "power" }),
    "sensor.sw_p5_dl": st("Keller Port 5 Download", { device_class: "data_rate" }),
    "sensor.sw_p5_ul": st("Keller Port 5 Upload", { device_class: "data_rate" }),
    "sensor.sw_p6_link": st("Keller Port 6 Link Speed", { connected_device: "NAS" }),
    "sensor.sw_p7_link": st("Keller Port 7 Link Speed", { connected_device: "NAS" }),
  };
  Object.keys(states).forEach((k) => (states[k].entity_id = k));
  const r = buildAutoDeviceEntries(list, byDevice, states, [{ device: "ap", down_entity: "sensor.eigen" }]);
  const ap = r.devices.find((d) => d.device === "ap");
  assert.equal(ap.down_entity, "sensor.eigen"); // Nutzerwert bleibt
  assert.equal(ap.up_entity, "sensor.sw_p5_dl"); // RX/„Download“ am Port = Upload des Geräts
  assert.equal(ap.poe_entity, "sensor.sw_p5_poe");
  assert.equal(ap.switch_port, "5");
  const nas = r.devices.find((d) => d.device === "nas");
  assert.deepEqual(nas, { device: "nas", parent: "sw", switch_port: "6, 7", auto_detected: { parent: "sw", switch_port: "6, 7" } });
  assert.equal(r.changed, 2);
  // Zweiter Lauf ändert nichts mehr
  assert.equal(buildAutoDeviceEntries(list, byDevice, states, r.devices).changed, 0);
});

test("Ports mit eigenem Namen und deutsche Sensornamen (UniFi Network+)", () => {
  const devs = [
    { id: "sw", name: "Keller", haName: "Keller", type: "switch", mac: "", entityIds: ["sensor.k_nas_ls", "sensor.k_nas_poe", "sensor.k_nas_dl", "sensor.k_nas_ul", "sensor.k_p5_ls", "sensor.k_nas2_dl"] },
    { id: "ap", name: "Werkstatt", haName: "Werkstatt", type: "ap", mac: "aa:00", entityIds: [] },
    { id: "nas", name: "NAS", haName: "NAS", type: "other", mac: "", entityIds: [] },
  ];
  const st = (id, n, a = {}) => [id, { entity_id: id, state: "1", attributes: { friendly_name: n, ...a } }];
  const states = Object.fromEntries([
    st("sensor.k_nas_ls", "Keller NAS Verbindungsgeschwindigkeit", { connected_device: "NAS" }),
    st("sensor.k_nas_poe", "Keller NAS PoE-Leistung", { device_class: "power" }),
    st("sensor.k_nas_dl", "Keller NAS Download", { device_class: "data_rate" }),
    st("sensor.k_nas_ul", "Keller NAS Upload", { device_class: "data_rate" }),
    st("sensor.k_nas2_dl", "Keller NAS 2 Download", { device_class: "data_rate" }),
    st("sensor.k_p5_ls", "Keller Port 5 Verbindungsgeschwindigkeit", { connected_mac: "AA:00" }),
  ]);
  const links = detectLinks(devs, states);
  assert.deepEqual(links.nas, { parent: "sw", ports: ["NAS"] });
  assert.deepEqual(links.ap, { parent: "sw", ports: [5] });
  const list = Object.values(states);
  const o = { deviceName: "Keller" };
  assert.equal(findPortEntity(list, "NAS", "poe", o).entity_id, "sensor.k_nas_poe");
  assert.equal(findPortEntity(list, "NAS", "rx", o).entity_id, "sensor.k_nas_dl"); // nicht "NAS 2"
  assert.equal(findPortEntity(list, "NAS", "tx", o).entity_id, "sensor.k_nas_ul");
  // translation_key macht die Art sprachunabhängig
  const ents = { "sensor.k_nas_ls": { translation_key: "port_link_speed" } };
  assert.equal(portSensorKey(states["sensor.k_nas_ls"], { deviceName: "Keller", entities: ents }).label, "NAS");
});

test("Erneute Erkennung aktualisiert nur automatische Felder, manuelle bleiben", () => {
  const list = [
    { id: "sw", name: "Keller", model: "US16P150" },
    { id: "ap", name: "Werkstatt", model: "U7PG2", connections: [["mac", "aa:00"]] },
  ];
  const e = (id) => ({ entity_id: id, device_id: "sw" });
  const byDevice = { sw: [e("sensor.l5"), e("sensor.l6"), e("sensor.d5"), e("sensor.d6")], ap: [] };
  const mk = (id, n, a = {}) => [id, { entity_id: id, state: "1", attributes: { friendly_name: n, ...a } }];
  const base = {
    ...Object.fromEntries([mk("sensor.d5", "Keller Port 5 Download", { device_class: "data_rate" }), mk("sensor.d6", "Keller Port 6 Download", { device_class: "data_rate" })]),
  };
  const at = (port) => ({
    ...base,
    ...Object.fromEntries([
      mk("sensor.l5", "Keller Port 5 Link Speed", port === 5 ? { connected_mac: "AA:00" } : {}),
      mk("sensor.l6", "Keller Port 6 Link Speed", port === 6 ? { connected_mac: "AA:00" } : {}),
    ]),
  });
  const r1 = buildAutoDeviceEntries(list, byDevice, at(5), []);
  assert.equal(r1.devices[0].switch_port, "5");
  assert.equal(r1.devices[0].up_entity, "sensor.d5");
  // Kabel umgesteckt: automatische Felder folgen
  const r2 = buildAutoDeviceEntries(list, byDevice, at(6), r1.devices);
  assert.equal(r2.devices[0].switch_port, "6");
  assert.equal(r2.devices[0].up_entity, "sensor.d6");
  // Nutzer ändert den Port von Hand: bleibt beim nächsten Lauf erhalten
  const manual = r2.devices.map((d) => ({ ...d, switch_port: "9" }));
  const r3 = buildAutoDeviceEntries(list, byDevice, at(5), manual);
  assert.equal(r3.devices[0].switch_port, "9");
  assert.equal(r3.devices[0].auto_detected.switch_port, undefined);
  // Gerät nicht mehr erkannt: nur automatische Felder verschwinden, Eintrag mit Namen bleibt
  const named = r1.devices.map((d) => ({ ...d, name: "Mein AP" }));
  const r4 = buildAutoDeviceEntries(list, byDevice, at(0), named);
  assert.deepEqual(r4.devices, [{ device: "ap", name: "Mein AP" }]);
});

test("formatDuration und uptimeSeconds", () => {
  assert.equal(formatDuration(3 * 86400 + 4 * 3600 + 12 * 60, "de"), "3 T 4 Std 12 Min");
  assert.equal(formatDuration(5 * 60, "en"), "5m");
  assert.equal(uptimeSeconds({ state: "2026-10-10T00:00:00+00:00", attributes: { device_class: "timestamp" } }, Date.parse("2026-10-11T00:00:00Z")), 86400);
  assert.equal(uptimeSeconds({ state: "2", attributes: { unit_of_measurement: "h" } }), 7200);
  assert.equal(uptimeSeconds({ state: "unavailable", attributes: {} }), null);
});
