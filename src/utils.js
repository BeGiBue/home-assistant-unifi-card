/**
 * Reine Hilfsfunktionen (ohne DOM), damit sie mit `node --test` getestet werden können.
 */

export const TYPE_RULES = [
  ["gateway", /^(UDM|UDR|UXG|UCG|UDW|USG|UDMA|EFG|UCK|UNVR)/i],
  ["switch", /^(USW|US-|US\d|USL|USM|USF|ECS|Flex|Switch)/i],
  ["camera", /^(UVC|G3|G4|G5|G6|AI ?Port|Camera|UP-?Cam)/i],
  ["phone", /^(UP-|UTP|Talk)/i],
  ["access", /^(UA-|Access|UAH)/i],
  ["ap", /^(U6|U7|UAP|UWB|UAL|UK|E7|U5|nano|AC-|BeaconHD|FlexHD|IW|Mesh|AP)/i],
];

/** Integrationen, aus denen die Karte Geräte liest (Core-Integration und Community-Integration UniFi Network+) */
export const UNIFI_PLATFORMS = ["unifi", "unifi_network_plus"];

export const TYPE_ORDER = ["gateway", "switch", "ap", "camera", "phone", "access", "other", "external"];

/**
 * Die UniFi-Integration legt neben echten Geräten auch Dienst-Einträge an
 * (z. B. WLAN-SSIDs mit Modell "UniFi WLAN" oder den Controller). Die gehören nicht in die Topologie.
 */
export function isNetworkDevice(device) {
  if (!device) return false;
  if (device.entry_type === "service") return false;
  // "Network Controller" ist der Sammel-Eintrag von UniFi Network+, kein echtes Gerät
  return !/^(UniFi\s*(WLAN|Network|Protect|Client|Controller)|Network Controller$)/i.test(device.model || "");
}

/** Modellname -> Gerätetyp */
export function typeOf(model = "") {
  for (const [type, re] of TYPE_RULES) if (re.test(model)) return type;
  return "other";
}

const RATE_FACTORS = {
  "bit/s": 1e-6,
  "kbit/s": 1e-3,
  "mbit/s": 1,
  "gbit/s": 1e3,
  "b/s": 8e-6,
  "kb/s": 8e-3,
  "mb/s": 8,
  "gb/s": 8e3,
  "kib/s": 8.192e-3,
  "mib/s": 8.388608,
};

/** Wert + Einheit -> Mbit/s (null wenn nicht umrechenbar) */
export function toMbit(value, unit = "Mbit/s") {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const f = RATE_FACTORS[String(unit).toLowerCase()];
  return f === undefined ? n : n * f;
}

/** Datenrate für die Anzeige formatieren (Mbit/s) */
export function formatRate(mbit, locale) {
  if (mbit === null || mbit === undefined || !Number.isFinite(mbit)) return "–";
  if (mbit >= 1000) return `${(mbit / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} Gb/s`;
  if (mbit >= 100) return `${Math.round(mbit).toLocaleString(locale)} Mb/s`;
  if (mbit >= 1) return `${mbit.toLocaleString(locale, { maximumFractionDigits: 1 })} Mb/s`;
  return `${(mbit * 1000).toLocaleString(locale, { maximumFractionDigits: 0 })} kb/s`;
}

/** Leistung formatieren (W) */
export function formatPower(watt, locale) {
  if (watt === null || watt === undefined || !Number.isFinite(watt)) return "–";
  return `${watt.toLocaleString(locale, { maximumFractionDigits: 1 })} W`;
}

/**
 * Sucht beim Switch den Sensor für einen Port.
 * `states`: Array von { entity_id, attributes: { friendly_name, device_class, unit_of_measurement } }
 * `kind`: "poe" | "rx" | "tx"
 */
export function findPortEntity(states, port, kind, opts = {}) {
  if (port === undefined || port === null || port === "") return undefined;
  const wantClass = kind === "poe" ? "power" : "data_rate";
  // Port mit eigenem Namen (z. B. "NAS"): über Gerätenamen und Sensor-Art zuordnen
  if (typeof port === "string" && !/^\d+$/.test(port)) {
    const want = port.trim().toLowerCase();
    return states.find((s) => {
      const k = portSensorKey(s, opts);
      if (!k || k.kind !== kind) return false;
      const dc = s.attributes?.device_class;
      return k.label.toLowerCase() === want && (!dc || dc === wantClass);
    });
  }
  const portRe = new RegExp(`(?:port|anschluss)[\\s_]*0*${Number(port)}(?!\\d)`, "i");
  const kindRe = {
    poe: /poe/i,
    rx: /(^|[\s_])rx([\s_]|$)|download|empfang/i,
    tx: /(^|[\s_])tx([\s_]|$)|upload|sende/i,
  }[kind];
  return states.find((s) => {
    const name = `${s.attributes?.friendly_name || ""} ${s.entity_id}`;
    if (!portRe.test(name) || !kindRe.test(name)) return false;
    const dc = s.attributes?.device_class;
    return !dc || dc === wantClass;
  });
}

const PORT_TK = { port_link_speed: "link", port_poe_power: "poe", port_download: "rx", port_upload: "tx" };
const PORT_SUFFIX = [
  ["link", /\s*(link[\s-]*speed|verbindungsgeschwindigkeit)$/i],
  ["poe", /\s*poe[\s-]*(power|leistung)$/i],
  ["rx", /\s*download$/i],
  ["tx", /\s*upload$/i],
];

/**
 * Port-Sensor (UniFi Network+) in Art und Port-Namen zerlegen. Die Sensoren heißen
 * "{Gerät} {Portname} {Messwert}", der Portname ist der in UniFi vergebene Name ("Port 5", "NAS", …).
 * opts: { deviceName, entities } – entities = hass.entities (translation_key macht die Art sprachunabhängig)
 */
export function portSensorKey(s, opts = {}) {
  if (!s || !String(s.entity_id).startsWith("sensor.")) return null;
  let name = String(s.attributes?.friendly_name || "").trim();
  const dn = String(opts.deviceName || "").trim();
  if (dn && name.toLowerCase().startsWith(dn.toLowerCase())) name = name.slice(dn.length).trim();
  const tk = PORT_TK[opts.entities?.[s.entity_id]?.translation_key];
  for (const [kind, re] of PORT_SUFFIX) {
    if (re.test(name) && (!tk || tk === kind)) return { kind, label: name.replace(re, "").trim() };
  }
  return null;
}

/** Zahl aus einem State lesen (null bei unavailable/unknown) */
export function numericState(stateObj) {
  if (!stateObj) return null;
  const n = Number(stateObj.state);
  return Number.isFinite(n) ? n : null;
}

/** HA-Farbwert (ui_color liefert z.B. "red" oder "#ff0000") in CSS umwandeln */
export function resolveColor(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "string") {
    if (/^(#|rgb|hsl|var\()/i.test(value)) return value;
    // HA-Farbnamen (primary, accent, red, …) -> --{name}-color bzw. --{name}-color
    if (/^[a-z-]+$/i.test(value)) return `var(--${value}-color, ${fallback})`;
  }
  if (Array.isArray(value) && value.length === 3) return `rgb(${value.join(",")})`;
  return fallback;
}

/** Geräteliste in einen Baum nach Elternbeziehung bringen */
export function buildTree(devices) {
  const ids = new Set(devices.map((d) => d.id));
  const children = {};
  devices.forEach((d) => {
    if (d.parent && ids.has(d.parent)) (children[d.parent] ||= []).push(d);
  });
  const rank = (d) => TYPE_ORDER.indexOf(d.type);
  const sortFn = (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name);
  Object.values(children).forEach((list) => list.sort(sortFn));
  const roots = devices.filter((d) => !d.parent || !ids.has(d.parent)).sort(sortFn);
  return { roots, children };
}

/**
 * Bestimmt das übergeordnete Gerät jedes Geräts.
 * Reihenfolge: 1. in der Karte gesetzt (`cfgParent`), 2. aus der Geräte-Registry (`viaParent`),
 * 3. wenn `auto` aktiv ist: Switches hängen am Gateway, alle anderen am einzigen Switch
 *    (gibt es mehrere Switches, hängen sie am Gateway und können per `parent` zugeordnet werden).
 */
export function resolveParents(devices, auto = true) {
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
  const valid = (id, self) => id && id !== self && byId[id];
  const parentOf = {};
  devices.forEach((d) => {
    parentOf[d.id] = valid(d.cfgParent, d.id) ? d.cfgParent : valid(d.viaParent, d.id) ? d.viaParent : null;
  });

  if (auto) {
    const gateway = devices.find((d) => d.type === "gateway");
    const switches = devices.filter((d) => d.type === "switch");
    devices.forEach((d) => {
      if (parentOf[d.id] || d.type === "gateway") return;
      if (d.type === "switch") parentOf[d.id] = gateway ? gateway.id : null;
      else if (switches.length === 1) parentOf[d.id] = switches[0].id;
      else parentOf[d.id] = gateway ? gateway.id : null;
    });
  }

  // Zyklen auflösen (z. B. A -> B -> A durch falsche Konfiguration)
  devices.forEach((d) => {
    const seen = new Set([d.id]);
    let cur = parentOf[d.id];
    while (cur) {
      if (seen.has(cur)) {
        parentOf[d.id] = null;
        break;
      }
      seen.add(cur);
      cur = parentOf[cur];
    }
  });

  return devices.map((d) => ({ ...d, parent: parentOf[d.id] }));
}

/**
 * Alle UniFi-Netzwerkgeräte aus der Geräte-/Entitäts-Registry von Home Assistant
 * (`hass.devices` / `hass.entities`, auch für Nicht-Administratoren verfügbar).
 * Liefert die Geräteliste und die Entitäten pro Gerät.
 */
export function collectUnifiDevices(hass, configEntry) {
  const byDevice = {};
  Object.values(hass?.entities || {}).forEach((e) => {
    if (e.device_id) (byDevice[e.device_id] ||= []).push(e);
  });
  let list = Object.values(hass?.devices || {}).filter((d) => {
    const own = byDevice[d.id] || [];
    if (!own.some((e) => UNIFI_PLATFORMS.includes(e.platform)) || !isNetworkDevice(d)) return false;
    if (configEntry && !(d.config_entries || []).includes(configEntry)) return false;
    const ubnt = /ubiquiti|ubnt|unifi/i.test(d.manufacturer || "");
    return ubnt || typeOf(d.model || "") !== "other";
  });
  // Laufen Core-Integration und UniFi Network+ parallel, gibt es dasselbe Gerät doppelt:
  // Das Network+-Gerät wird (über den Namen) in das Core-Gerät eingemischt, seine Entitäten bleiben nutzbar.
  const isPlus = (d) => (byDevice[d.id] || []).some((e) => e.platform === "unifi_network_plus");
  const isCore = (d) => (byDevice[d.id] || []).some((e) => e.platform === "unifi");
  const norm = (s) => String(s || "").trim().toLowerCase();
  const core = new Map();
  list.filter((d) => isCore(d) && !isPlus(d)).forEach((d) => {
    [d.name, d.name_by_user].filter(Boolean).forEach((n) => core.set(norm(n), d));
  });
  list = list.filter((d) => {
    if (!isPlus(d) || isCore(d)) return true;
    const target = core.get(norm(d.name_by_user)) || core.get(norm(d.name));
    if (!target) return true;
    byDevice[target.id] = [...(byDevice[target.id] || []), ...(byDevice[d.id] || [])];
    return false;
  });
  return { list, byDevice };
}

/**
 * Erkennt automatisch, welches Gerät an welchem Port eines Switches/Gateways hängt.
 * Quelle: die Port-Sensoren „Port N Link Speed“ von UniFi Network+ (Attribute connected_mac / connected_device).
 * devices: [{id, name, type, mac, entityIds}], states: hass.states
 * Ergebnis: { [kindId]: { parent, ports: [..] } } – mehrere Ports zum selben Elternteil = Link Aggregation.
 */
export function detectLinks(devices, states, entities = {}) {
  const norm = (s) => String(s || "").trim().toLowerCase();
  const byMac = {};
  const byName = {};
  devices.forEach((d) => {
    if (d.mac) byMac[norm(d.mac)] = d;
    if (d.name) byName[norm(d.name)] = d;
  });
  const rank = { gateway: 0, switch: 1 };
  const rankOf = (d) => rank[d.type] ?? 2;
  const found = {};
  devices.forEach((p) => {
    if (!(p.type in rank)) return;
    (p.entityIds || []).forEach((id) => {
      const s = states?.[id];
      if (!s) return;
      const a = s.attributes || {};
      const k = portSensorKey({ entity_id: id, attributes: a }, { deviceName: p.haName || p.name, entities });
      if (!k || k.kind !== "link" || !k.label) return;
      // "Port 5" -> 5, eigener Name ("NAS") bleibt als Name
      const m = /^(?:port|anschluss)\s*0*(\d+)$/i.exec(k.label);
      const portId = m ? Number(m[1]) : k.label;
      const child = (a.connected_mac && byMac[norm(a.connected_mac)]) || (a.connected_device && byName[norm(a.connected_device)]);
      if (!child || child.id === p.id) return;
      (((found[child.id] ||= {})[p.id]) ||= []).push(portId);
    });
  });
  const out = {};
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
  Object.entries(found).forEach(([cid, parents]) => {
    const child = byId[cid];
    // Nur Eltern, die in der Hierarchie über dem Kind stehen (Gateway > Switch > Rest);
    // gleichrangige Geräte (zwei Switches sehen sich gegenseitig) bleiben der manuellen Zuordnung überlassen.
    const cands = Object.keys(parents)
      .filter((pid) => rankOf(byId[pid]) < rankOf(child))
      .sort((x, y) => rankOf(byId[x]) - rankOf(byId[y]));
    if (!cands.length) return;
    const ports = [...new Set(parents[cands[0]])].sort((x, y) =>
      typeof x === "number" && typeof y === "number" ? x - y : typeof x === "number" ? -1 : typeof y === "number" ? 1 : String(x).localeCompare(String(y))
    );
    out[cid] = { parent: cands[0], ports };
  });
  return out;
}

/**
 * Erkannte Port-Zuordnung als Geräte-Einträge für die Konfiguration (Editor-Button).
 * Es werden nur leere Felder gefüllt; was der Nutzer selbst eingetragen hat, bleibt unverändert.
 * Bei Link Aggregation (mehrere Ports) werden nur Eltern und Ports eingetragen – die Karte addiert die Ports selbst.
 * Ergebnis: { devices: neue devices[]-Liste, changed: Anzahl betroffener Geräte }
 */
export function buildAutoDeviceEntries(list, byDevice, states, existing = [], entities = {}) {
  const devs = list.map((d) => ({
    id: d.id,
    name: d.name_by_user || d.name || "",
    haName: d.name_by_user || d.name || "",
    type: typeOf(d.model || ""),
    mac: ((d.connections || []).find((c) => c && c[0] === "mac") || [])[1] || "",
    entityIds: (byDevice[d.id] || []).map((e) => e.entity_id),
  }));
  const links = detectLinks(devs, states, entities);
  const out = (existing || []).map((e) => ({ ...e }));
  let changed = 0;
  Object.entries(links).forEach(([cid, l]) => {
    const parentStates = (byDevice[l.parent] || []).map((e) => states[e.entity_id]).filter(Boolean);
    const wanted = { parent: l.parent, switch_port: l.ports.join(", ") };
    if (l.ports.length === 1) {
      const p = l.ports[0];
      const o = { deviceName: devs.find((x) => x.id === l.parent)?.haName, entities };
      wanted.poe_entity = findPortEntity(parentStates, p, "poe", o)?.entity_id;
      wanted.down_entity = findPortEntity(parentStates, p, "tx", o)?.entity_id;
      wanted.up_entity = findPortEntity(parentStates, p, "rx", o)?.entity_id;
    }
    let entry = out.find((e) => e.device === cid);
    if (!entry) {
      entry = { device: cid };
      out.push(entry);
    }
    let touched = false;
    Object.entries(wanted).forEach(([k, v]) => {
      if (v && (entry[k] === undefined || entry[k] === null || entry[k] === "")) {
        entry[k] = v;
        touched = true;
      }
    });
    if (touched) changed++;
  });
  return { devices: out, changed };
}

/** Port-Angabe als Liste: 5, "5", "6, 7" oder [6, 7] -> [6, 7] (mehrere Ports = Link Aggregation) */
export function parsePorts(value) {
  if (value === undefined || value === null || value === "") return [];
  let raw;
  if (Array.isArray(value)) raw = value;
  else {
    const str = String(value).trim();
    // nur Zahlen: "6 7", "6, 7"; sonst Namen, getrennt durch Komma/Semikolon ("NAS 1; NAS 2")
    raw = /^[\d\s,;]+$/.test(str) ? str.split(/[,;\s]+/) : str.split(/[,;]/);
  }
  const out = [];
  raw.forEach((x) => {
    const t = String(x).trim();
    if (!t) return;
    const n = Number(t);
    const v = /^\d+$/.test(t) ? n : t;
    if (v === 0 || out.includes(v)) return;
    out.push(v);
  });
  return out;
}

/** Reduziert eine Messreihe auf höchstens n Punkte (Mittelwert je Abschnitt). */
export function downsample(values, n = 120) {
  const v = (values || []).filter(Number.isFinite);
  if (v.length <= n) return v;
  const step = v.length / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const chunk = v.slice(Math.floor(i * step), Math.floor((i + 1) * step) || undefined);
    if (chunk.length) out.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
  }
  return out;
}

/** SVG-Pfade (Linie und Fläche) für einen kleinen Verlaufsgraphen. */
export function sparkline(values, w = 100, h = 30, pad = 2) {
  const v = (values || []).filter(Number.isFinite);
  if (v.length < 2) return null;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * w, h - pad - ((y - min) / span) * (h - 2 * pad)]);
  const line = "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L");
  return { line, area: `${line} L${w},${h} L0,${h} Z`, min, max };
}
