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

export const TYPE_ORDER = ["gateway", "switch", "ap", "camera", "phone", "access", "other"];

/**
 * Die UniFi-Integration legt neben echten Geräten auch Dienst-Einträge an
 * (z. B. WLAN-SSIDs mit Modell "UniFi WLAN" oder den Controller). Die gehören nicht in die Topologie.
 */
export function isNetworkDevice(device) {
  if (!device) return false;
  if (device.entry_type === "service") return false;
  return !/^UniFi\s*(WLAN|Network|Protect|Client|Controller)/i.test(device.model || "");
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
export function findPortEntity(states, port, kind) {
  if (port === undefined || port === null || port === "") return undefined;
  const portRe = new RegExp(`(?:port|anschluss)[\\s_]*0*${Number(port)}(?!\\d)`, "i");
  const kindRe = {
    poe: /poe/i,
    rx: /(^|[\s_])rx([\s_]|$)|download|empfang/i,
    tx: /(^|[\s_])tx([\s_]|$)|upload|sende/i,
  }[kind];
  const wantClass = kind === "poe" ? "power" : "data_rate";
  return states.find((s) => {
    const name = `${s.attributes?.friendly_name || ""} ${s.entity_id}`;
    if (!portRe.test(name) || !kindRe.test(name)) return false;
    const dc = s.attributes?.device_class;
    return !dc || dc === wantClass;
  });
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
  const list = Object.values(hass?.devices || {}).filter((d) => {
    const own = byDevice[d.id] || [];
    if (!own.some((e) => e.platform === "unifi") || !isNetworkDevice(d)) return false;
    if (configEntry && !(d.config_entries || []).includes(configEntry)) return false;
    const ubnt = /ubiquiti|ubnt|unifi/i.test(d.manufacturer || "");
    return ubnt || typeOf(d.model || "") !== "other";
  });
  return { list, byDevice };
}
