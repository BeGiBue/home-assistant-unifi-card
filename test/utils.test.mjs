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
  detectLatency,
  detectWan,
  suggestExternalDevices,
  mergeLatencyEntries,
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
  assert.deepEqual(nas, { device: "nas", name: "NAS", parent: "sw", switch_port: "6, 7", auto_detected: { name: "NAS", parent: "sw", switch_port: "6, 7" } });
  assert.ok(r.devices.find((d) => d.device === "sw")); // jedes UniFi-Gerät bekommt einen Eintrag
  assert.equal(r.changed, 3);
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
  const get = (r, id) => r.devices.find((d) => d.device === id);
  const r1 = buildAutoDeviceEntries(list, byDevice, at(5), []);
  assert.equal(get(r1, "ap").switch_port, "5");
  assert.equal(get(r1, "ap").up_entity, "sensor.d5");
  // Kabel umgesteckt: automatische Felder folgen
  const r2 = buildAutoDeviceEntries(list, byDevice, at(6), r1.devices);
  assert.equal(get(r2, "ap").switch_port, "6");
  assert.equal(get(r2, "ap").up_entity, "sensor.d6");
  // Nutzer ändert den Port von Hand: bleibt beim nächsten Lauf erhalten
  const manual = r2.devices.map((d) => (d.device === "ap" ? { ...d, switch_port: "9" } : d));
  const r3 = buildAutoDeviceEntries(list, byDevice, at(5), manual);
  assert.equal(get(r3, "ap").switch_port, "9");
  assert.equal(get(r3, "ap").auto_detected.switch_port, undefined);
  // Gerät nicht mehr erkannt: nur automatische Felder verschwinden, Eintrag mit Namen bleibt
  const named = r1.devices.map((d) => (d.device === "ap" ? { ...d, name: "Mein AP" } : d));
  const r4 = buildAutoDeviceEntries(list, byDevice, at(0), named);
  const ap4 = get(r4, "ap");
  assert.equal(ap4.name, "Mein AP");
  assert.equal(ap4.switch_port, undefined);
  assert.equal(ap4.parent, undefined);
});

test("formatDuration und uptimeSeconds", () => {
  assert.equal(formatDuration(3 * 86400 + 4 * 3600 + 12 * 60, "de"), "3 T 4 Std 12 Min");
  assert.equal(formatDuration(5 * 60, "en"), "5m");
  assert.equal(uptimeSeconds({ state: "2026-10-10T00:00:00+00:00", attributes: { device_class: "timestamp" } }, Date.parse("2026-10-11T00:00:00Z")), 86400);
  assert.equal(uptimeSeconds({ state: "2", attributes: { unit_of_measurement: "h" } }), 7200);
  assert.equal(uptimeSeconds({ state: "unavailable", attributes: {} }), null);
});

test("mergeLatencyEntries ergänzt nur fehlende Ping-Sensoren; detectWan erkennt Durchsatz", () => {
  const st = (id, n) => [id, { entity_id: id, state: "5", attributes: { friendly_name: n } }];
  const states = Object.fromEntries([
    st("sensor.gw_cloudflare_wan_latency", "Router Cloudflare WAN latency"),
    st("sensor.gw_google_wan_latency", "Router Google WAN latency"),
    st("sensor.wan_download", "WAN Download"),
    st("sensor.wan_upload", "WAN Upload"),
    st("sensor.speedtest_download", "Speedtest Download"),
  ]);
  const defs = detectLatency([{ name: "Router", entityIds: ["sensor.gw_cloudflare_wan_latency", "sensor.gw_google_wan_latency"] }], states);
  const r1 = mergeLatencyEntries([], defs, states, "WAN");
  assert.deepEqual(r1.entries.map((e) => e.name), ["Cloudflare", "Google"]);
  // Eintrag gelöscht -> bleibt weg, bis die Erkennung neu gestartet wird
  const r2 = mergeLatencyEntries([r1.entries[0]], defs, states, "WAN");
  assert.equal(r2.added, 1);
  assert.deepEqual(detectWan(states), { down: "sensor.wan_download", up: "sensor.wan_upload" });
});

test("suggestExternalDevices schlägt Nicht-UniFi-Geräte an belegten Ports vor", () => {
  const list = [
    { id: "gw", name: "Router", model: "UDRULT" },
    { id: "sw", name: "Keller", model: "US16P150" },
    { id: "ap", name: "Werkstatt", model: "U7PG2", connections: [["mac", "aa:00"]] },
  ];
  const ids = ["l1", "l2", "l5", "l6", "l7", "l9"].map((x) => `sensor.k_${x}`);
  const byDevice = { gw: [], sw: ids.map((id) => ({ entity_id: id, device_id: "sw" })), ap: [] };
  const mk = (n, a) => ({ entity_id: "", state: "1000", attributes: { friendly_name: n, ...a } });
  const states = {
    "sensor.k_l1": mk("Keller Port 1 Verbindungsgeschwindigkeit", { connected_device: "Router" }),
    "sensor.k_l2": mk("Keller Port 2 Verbindungsgeschwindigkeit", { connected_mac: "AA:00" }),
    "sensor.k_l5": mk("Keller NAS Verbindungsgeschwindigkeit", { connected_device: "Synology DS923", connected_mac: "00:11", connected_ip: "192.168.1.30" }),
    "sensor.k_l6": mk("Keller NAS 2 Verbindungsgeschwindigkeit", { connected_device: "Synology DS923", connected_mac: "00:11" }),
    "sensor.k_l7": mk("Keller Port 7 Verbindungsgeschwindigkeit", { connected_device: "Drucker" }),
    "sensor.k_l9": mk("Keller Port 9 Verbindungsgeschwindigkeit", {}), // nicht belegt
    "device_tracker.nas": { entity_id: "device_tracker.nas", state: "home", attributes: { friendly_name: "Synology DS923", mac: "00:11" } },
  };
  Object.keys(states).forEach((k) => (states[k].entity_id = k));
  const r = suggestExternalDevices(list, byDevice, states, {}, []);
  assert.deepEqual(r.map((g) => g.name).sort(), ["Drucker", "Synology DS923"]); // Router und AP sind UniFi-Geräte
  const nas = r.find((g) => g.name.startsWith("Syn"));
  assert.deepEqual(nas.ports, ["NAS", "NAS 2"]);
  assert.equal(nas.ip, "192.168.1.30");
  assert.equal(nas.icon, "mdi:nas");
  assert.equal(nas.entity, "sensor.k_l5"); // Status: Link-Speed-Sensor des Ports
  assert.equal(r.find((g) => g.name === "Drucker").icon, "mdi:printer");
  // bereits vorhandene externe Geräte werden nicht erneut vorgeschlagen
  const r2 = suggestExternalDevices(list, byDevice, states, {}, [{ name: "Drucker" }, { name: "x", parent: "sw", switch_port: "NAS" }]);
  assert.deepEqual(r2, []);
});

test("findPortEntity: „PoE Standard“ wird nicht mit „PoE Power“ verwechselt (UniFi Network+ 0.3)", () => {
  const e = (id, name, dc, state) => ({ entity_id: id, state, attributes: { friendly_name: name, ...(dc ? { device_class: dc } : {}) } });
  const std = e("sensor.k_port_5_poe_standard", "Keller Port 5 PoE Standard", null, "802.3at");
  const pwr = e("sensor.k_port_5_poe_power", "Keller Port 5 PoE Power", "power", "8.9");
  // Reihenfolge darf keine Rolle spielen
  assert.equal(findPortEntity([std, pwr], 5, "poe").entity_id, "sensor.k_port_5_poe_power");
  assert.equal(findPortEntity([pwr, std], 5, "poe").entity_id, "sensor.k_port_5_poe_power");
  // mit translation_key (auch bei fremdsprachigen Namen)
  const de = e("sensor.k_port_5_x", "Keller Port 5 PoE-Norm", null, "802.3at");
  const ents = { "sensor.k_port_5_x": { translation_key: "port_poe_standard" }, "sensor.k_port_5_poe_power": { translation_key: "port_poe_power" } };
  assert.equal(findPortEntity([de, pwr], 5, "poe", { entities: ents }).entity_id, "sensor.k_port_5_poe_power");
  // ohne Leistungssensor: lieber nichts als den Text-Sensor
  assert.equal(findPortEntity([std], 5, "poe"), undefined);
  assert.equal(findPortEntity([std, de], 5, "poe", { entities: ents }), undefined);
});

test("detectLinks nutzt den Uplink-Sensor (UniFi Network+), Link-Speed hat Vorrang", () => {
  const st = (id, name, state, attrs = {}) => [id, { entity_id: id, state, attributes: { friendly_name: name, ...attrs } }];
  const devs = [
    { id: "gw", name: "Router", haName: "Router", type: "gateway", mac: "", entityIds: [] },
    { id: "sw", name: "Keller", haName: "Keller", type: "switch", mac: "aa:01", entityIds: ["sensor.sw_uplink"] },
    { id: "sw2", name: "Büro Switch", haName: "Büro", type: "switch", mac: "aa:02", entityIds: ["sensor.sw2_uplink", "sensor.sw2_p3_link"] },
    { id: "ap", name: "AP Werkstatt", haName: "AP Werkstatt", type: "ap", mac: "aa:03", entityIds: ["sensor.ap_uplink"] },
    { id: "ap2", name: "AP Büro", haName: "AP Büro", type: "ap", mac: "aa:04", entityIds: ["sensor.ap2_uplink"] },
    { id: "ap3", name: "AP Garten", haName: "AP Garten", type: "ap", mac: "aa:05", entityIds: ["sensor.ap3_uplink"] },
    { id: "ap4", name: "AP Dach", haName: "AP Dach", type: "ap", mac: "aa:06", entityIds: ["sensor.ap4_uplink"] },
  ];
  const states = Object.fromEntries([
    st("sensor.sw_uplink", "Keller Uplink", "Router", { port: 8 }),
    st("sensor.sw2_uplink", "Büro Switch Uplink", "Keller", { port: 12 }), // Switch an Switch
    st("sensor.ap_uplink", "AP Werkstatt Uplink", "keller", { port: 5 }), // Groß-/Kleinschreibung egal
    st("sensor.ap2_uplink", "AP Büro Uplink", "Keller", { port: 9 }), // widerspricht Link Speed -> Link Speed gewinnt
    st("sensor.sw2_p3_link", "Büro Port 3 Link Speed", "1000", { connected_mac: "aa:04" }),
    st("sensor.ap3_uplink", "AP Garten Uplink", "Büro", {}), // Name über haName, ohne Port
    st("sensor.ap4_uplink", "AP Dach Uplink", "unavailable", { port: 2 }),
  ]);
  const out = detectLinks(devs, states);
  assert.deepEqual(out.sw, { parent: "gw", ports: [8] });
  assert.deepEqual(out.sw2, { parent: "sw", ports: [12] });
  assert.deepEqual(out.ap, { parent: "sw", ports: [5] });
  assert.deepEqual(out.ap2, { parent: "sw2", ports: [3] }); // Link Speed am Büro-Switch hat Vorrang
  assert.deepEqual(out.ap3, { parent: "sw2", ports: [] });
  assert.equal(out.ap4, undefined); // unavailable
  assert.equal(out.gw, undefined);
  // mit translation_key, auch wenn der Name nicht auf „Uplink“ endet
  const out2 = detectLinks(
    [devs[0], devs[1], { ...devs[3], entityIds: ["sensor.x"] }],
    { ...states, ...Object.fromEntries([st("sensor.x", "AP Werkstatt Anbindung", "Keller", { port: 7 })]) },
    { "sensor.x": { translation_key: "device_uplink" } }
  );
  assert.deepEqual(out2.ap, { parent: "sw", ports: [7] });
});
