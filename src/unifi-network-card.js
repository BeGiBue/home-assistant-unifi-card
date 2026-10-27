import { styles } from "./styles.js";
import { localize } from "./localize.js";
import {
  TYPE_ORDER,
  typeOf,
  toMbit,
  formatRate,
  formatPower,
  findPortEntity,
  numericState,
  resolveColor,
  safeImageUrl,
  buildTree,
  resolveParents,
  collectUnifiDevices,
  linkDevice,
  macOf,
  parsePorts,
  downsample,
  sparkline,
  detectLinks,
  formatDuration,
  uptimeSeconds,
  detectLatency,
  latencyLabel,
  detectWan,
} from "./utils.js";
import "./unifi-network-card-editor.js";

/* global __VERSION__ */
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "1.0.0";

const ICONS = {
  gateway: '<rect x="6" y="22" width="52" height="20" rx="4"/><circle cx="16" cy="32" r="2.4" fill="currentColor"/><circle cx="24" cy="32" r="2.4" fill="currentColor"/><path d="M38 28h14M38 36h14"/>',
  switch: '<rect x="4" y="24" width="56" height="16" rx="3"/><path d="M12 29h4M20 29h4M28 29h4M36 29h4M44 29h4M12 35h4M20 35h4M28 35h4M36 35h4M44 35h4"/>',
  ap: '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="11" style="stroke:var(--primary-color)"/><circle cx="32" cy="32" r="2" fill="currentColor"/>',
  camera: '<rect x="10" y="22" width="34" height="20" rx="5"/><path d="M44 29l10-5v16l-10-5z"/>',
  phone: '<rect x="20" y="8" width="24" height="48" rx="5"/><path d="M28 50h8"/>',
  access: '<rect x="18" y="8" width="28" height="48" rx="4"/><circle cx="32" cy="26" r="7"/><path d="M26 44h12"/>',
  other: '<rect x="12" y="16" width="40" height="32" rx="5"/><path d="M24 32h16"/>',
  external: '<rect x="12" y="16" width="40" height="32" rx="5"/><path d="M24 32h16"/>',
};

const BOLT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>';
const USERS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.2.9 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="update"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

class UnifiNetworkCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._devices = [];
    this._sig = "";
    this._density = "normal";
  }

  /**
   * Scroll-Schutz: Während die Seite gescrollt oder berührt wird, baut die Karte ihr DOM nicht neu auf.
   * Ein Austausch der berührten Elemente mitten in der Geste bricht das Scrollen in WebKit ab und
   * lässt die Seite springen. Die Liveswerte werden danach nachgezogen.
   */
  _hold(ms) {
    this._holdUntil = Math.max(this._holdUntil || 0, Date.now() + ms);
  }

  _bindScrollGuard() {
    if (this._guard || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const opts = { capture: true, passive: true };
    // touch- und wheel-Ereignisse sind „composed“ und erreichen das Fenster auch aus dem Shadow DOM
    this._guard = [
      ["touchstart", () => this._hold(1500)],
      ["touchmove", () => this._hold(1500)],
      ["touchend", () => this._hold(1200)], // Auslaufen der Wischbewegung (Momentum)
      ["touchcancel", () => this._hold(1200)],
      ["wheel", () => this._hold(300)],
      ["scroll", () => this._hold(300)],
    ];
    this._guard.forEach(([ev, fn]) => window.addEventListener(ev, fn, opts));
  }

  _unbindScrollGuard() {
    if (this._guard && typeof window.removeEventListener === "function") {
      this._guard.forEach(([ev, fn]) => window.removeEventListener(ev, fn, { capture: true }));
    }
    this._guard = null;
    clearTimeout(this._deferTimer);
    this._deferTimer = null;
  }

  connectedCallback() {
    this._bindScrollGuard();
    if (typeof ResizeObserver === "undefined" || this._ro) return;
    // Bei Breitenänderung (Drehen des iPads, Fenstergröße, Layout) neu einpassen
    this._ro = new ResizeObserver(() => {
      const w = Math.round(this.clientWidth || 0);
      if (w && w !== this._lastW) this._fit();
    });
    this._ro.observe(this);
  }

  disconnectedCallback() {
    if (this._ro) this._ro.disconnect();
    this._ro = null;
    this._unbindScrollGuard();
  }

  /**
   * Wählt die Dichte (normal -> kompakt -> Liste), sodass der Baum ohne seitliches Scrollen passt.
   * Feste Vorgabe über die Option `density`; „auto“ misst den Baum im DOM.
   */
  _fit() {
    const card = this.shadowRoot?.querySelector?.("ha-card");
    if (!card?.querySelector || !this._config) return;
    const want = this._config.density || "auto";
    const levels = ["normal", "compact", "list"];
    const tree = card.querySelector("ul.tree.root");
    if (want !== "auto") {
      this._density = levels.includes(want) ? want : "normal";
    } else if (!tree) {
      this._density = "normal";
    } else {
      // Verfügbare Breite: Karte, begrenzt durch den Bildschirm (falls das Layout mit dem Inhalt mitwächst)
      const view = (typeof document !== "undefined" && document.documentElement?.clientWidth) || (typeof window !== "undefined" && window.innerWidth) || 0;
      const cw = card.clientWidth || this.clientWidth || 0;
      const avail = Math.min(cw || view, view || cw);
      if (!avail) {
        this._density = "normal";
      } else {
        this._lastW = Math.round(this.clientWidth || 0);
        // Größte Kachelanzahl auf einer Ebene des Baums (für die Breitenabschätzung)
        const perLevel = {};
        tree.querySelectorAll("li").forEach((li) => {
          let depth = 0;
          for (let n = li.parentElement; n && n !== tree; n = n.parentElement) if (n.tagName === "UL") depth++;
          perLevel[depth] = (perLevel[depth] || 0) + 1;
        });
        const widest = Math.max(1, ...Object.values(perLevel));
        const tileW = { normal: 165, compact: 96 };
        const inner = avail - 24; // Kartenrand
        let chosen = "list";
        for (const l of levels) {
          card.dataset.d = l;
          const measured = tree.scrollWidth <= tree.clientWidth + 1;
          const estimated = l === "list" || widest * tileW[l] <= inner;
          if (measured && estimated) {
            chosen = l;
            break;
          }
        }
        this._density = chosen;
      }
    }
    card.dataset.d = this._density;
  }

  /* ---- Home-Assistant-Schnittstelle ---- */

  static getConfigElement() {
    return document.createElement("unifi-network-card-editor");
  }

  static getStubConfig() {
    return { layout: "tree", show_offline: true, show_flows: true, animate_flows: true };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = {
      layout: "tree",
      show_offline: true,
      show_flows: true,
      animate_flows: true,
      show_summary: true,
      show_legend: true,
      auto_parent: true,
      show_clients: true,
      show_restart: true,
      show_latency: true,
      show_wan: true,
      managed: false,
      swap_port_direction: false,
      density: "auto",
      latency_entities: [],
      devices: [],
      external_devices: [],
      ...config,
    };
    this._sig = "";
    this._fitKey = null;
    this._devRef = null;
    this._histKey = null;
    this._confirm = null;
    this._update();
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  /* ---- Datenmodell ---- */

  _overrides(deviceId) {
    return (this._config.devices || []).find((x) => x && x.device === deviceId) || {};
  }

  _collectDevices() {
    const { list: all, byDevice } = collectUnifiDevices(this._hass, this._config.config_entry);
    // Verwaltete Liste: nur Geräte anzeigen, die als Eintrag in `devices` stehen (Löschen blendet ein Gerät aus)
    const listed = new Set((this._config.devices || []).map((x) => x && x.device));
    const list = this._config.managed === true ? all.filter((d) => listed.has(d.id)) : all;
    this._allUnifi = all.map((d) => ({ ...linkDevice(d, byDevice), name: d.name_by_user || d.name || d.model || "" }));
    const known = new Set(list.map((d) => d.id));
    const base = list.map((d) => {
      const cfg = this._overrides(d.id);
      const model = d.model || "";
      return {
        id: d.id,
        name: cfg.name || d.name_by_user || d.name || model,
        model,
        sw: d.sw_version || "",
        viaParent: d.via_device_id && known.has(d.via_device_id) ? d.via_device_id : null,
        cfgParent: cfg.parent || null,
        type: typeOf(model),
        entityIds: (byDevice[d.id] || []).map((e) => e.entity_id),
        haName: d.name_by_user || d.name || "",
        mac: macOf(d),
        cfg,
      };
    });
    // Automatische Zuordnung Gerät -> Switch-Port (UniFi Network+), nur wenn nichts konfiguriert ist
    this._links = detectLinks(this._allUnifi, this._hass.states, this._hass.entities);
    this._linkSig = JSON.stringify(this._links);
    base.forEach((d) => {
      const l = this._links[d.id];
      if (l) {
        d.autoLink = l;
        d.viaParent = d.viaParent || l.parent;
      }
    });
    // Manuell angelegte Geräte außerhalb von UniFi
    const known2 = new Set(base.map((d) => d.id));
    const external = [];
    (this._config.external_devices || []).forEach((x, i) => {
      if (!x || !x.name) return;
      const common = {
        name: x.name,
        model: x.model || "",
        sw: "",
        viaParent: null,
        type: "external",
        external: true,
        entityIds: x.entity ? [x.entity] : [],
      };
      external.push({ ...common, id: `ext:${i}`, cfgParent: x.parent || null, cfg: x });
      // Zweite Verbindung (z. B. Mac per LAN und WLAN): zweite Kachel unter dem anderen Gerät
      if (x.parent2 && known2.has(x.parent2)) {
        external.push({
          ...common,
          id: `ext:${i}:2`,
          secondary: true,
          cfgParent: x.parent2,
          cfg: {
            ...x,
            switch_port: x.switch_port2,
            poe_entity: undefined,
            down_entity: x.down_entity2,
            up_entity: x.up_entity2,
            link_type: x.link_type2 || "wifi",
          },
        });
      }
    });
    this._devices = resolveParents([...base, ...external], this._config.auto_parent !== false);
  }

  _status(d) {
    const st = this._hass.states;
    if (d.external) {
      // Status-Entität (optional): on/home/Zahl/… = online; off/not_home/unavailable/unknown = offline
      const s = d.entityIds[0] && st[d.entityIds[0]];
      const online = d.entityIds[0] ? !!s && !["unavailable", "unknown", "off", "not_home", "none"].includes(s.state) : true;
      return { online, update: false };
    }
    const states = d.entityIds.map((id) => st[id]).filter(Boolean);
    const tracker = states.find((s) => s.entity_id.startsWith("device_tracker."));
    const online = tracker
      ? tracker.state === "home"
      : states.some((s) => !["unavailable", "unknown"].includes(s.state));
    const update = states.some((s) => s.entity_id.startsWith("update.") && s.state === "on");
    return { online, update };
  }

  /** Anzahl verbundener Geräte (Clients) eines Switches/Access Points */
  _clients(d) {
    if (this._config.show_clients === false) return null;
    const st = this._hass.states;
    const own = d.cfg?.clients_entity;
    if (own) return numericState(st[own]);
    if (d.external || !["switch", "ap"].includes(d.type)) return null;
    const re = /(^|[\s_])(clients?|stations?|stationen|verbundene)([\s_]|$)/i;
    const s = d.entityIds
      .map((id) => st[id])
      .filter(Boolean)
      .find(
        (x) =>
          x.entity_id.startsWith("sensor.") &&
          re.test(`${x.attributes?.friendly_name || ""} ${x.entity_id}`) &&
          !/(rx|tx|poe|port)/i.test(x.entity_id) &&
          Number.isFinite(Number(x.state))
      );
    return s ? Number(s.state) : null;
  }

  /** Neustart-Button (button.press) eines Geräts: Konfiguration oder Auto-Erkennung */
  _restart(d) {
    if (this._config.show_restart === false || d.secondary) return null;
    const st = this._hass.states;
    const own = d.cfg?.restart_entity;
    if (own) return st[own] ? own : null;
    if (d.external) return null;
    const s = d.entityIds
      .map((id) => st[id])
      .filter(Boolean)
      .find((x) => x.entity_id.startsWith("button.") && (x.attributes?.device_class === "restart" || /restart|neustart/i.test(x.entity_id)));
    return s ? s.entity_id : null;
  }

  /** WAN-Latenz-/Ping-Sensoren: konfiguriert oder automatisch an den UniFi-Geräten erkannt */
  _latency() {
    const cfg = this._config;
    if (cfg.show_latency === false) return [];
    const st = this._hass.states;
    let defs = (cfg.latency_entities || [])
      .map((x) => (typeof x === "string" ? { entity: x } : x))
      .filter((x) => x && x.entity);
    // Automatik nur in der nicht verwalteten Ansicht; verwaltet: ausschließlich die Einträge in `latency_entities`
    if (!defs.length && cfg.managed !== true) defs = detectLatency(this._devices.filter((d) => !d.external), st);
    return defs
      .map((x) => {
        const s = st[x.entity];
        if (!s) return null;
        const lab = latencyLabel(x, s, localize(this._hass)("wan_latency"));
        const n = Number(s.state);
        return {
          entity: x.entity,
          name: lab.name,
          icon: lab.icon,
          value: Number.isFinite(n) && s.state !== "" ? n : null,
          unit: s.attributes?.unit_of_measurement || "ms",
          hist: (this._hist && this._hist[x.entity]) || [],
        };
      })
      .filter(Boolean);
  }

  /** Internet-Durchsatz (WAN Download/Upload): konfiguriert oder am Namen erkannt */
  _wan() {
    const cfg = this._config;
    if (cfg.show_wan === false) return [];
    const st = this._hass.states;
    const det = cfg.managed === true ? {} : detectWan(st);
    const mk = (kind, own, auto, label) => {
      const id = own || auto;
      const s = id && st[id];
      if (!s) return null;
      const unit = s.attributes?.unit_of_measurement;
      return {
        kind,
        entity: id,
        label,
        value: toMbit(numericState(s), unit || "Mbit/s"),
        hist: (this._hist && this._hist[id]) || [],
      };
    };
    return [
      mk("down", cfg.wan_down_entity, det.down, "legend_down"),
      mk("up", cfg.wan_up_entity, det.up, "legend_up"),
    ].filter(Boolean);
  }

  /** Verlauf der Latenz-Sensoren über die History-API laden (höchstens alle 5 Minuten) */
  _loadHistory(list) {
    const ids = list.map((l) => l.entity);
    if (!ids.length || !this._hass?.callWS) return;
    const hours = Number(this._config.latency_hours) || 24;
    const key = `${ids.join(",")}|${hours}`;
    const now = Date.now();
    if (this._histKey === key && now - this._histAt < 300000) return;
    this._histKey = key;
    this._histAt = now;
    Promise.resolve(
      this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(now - hours * 3600000).toISOString(),
        end_time: new Date(now).toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      })
    )
      .then((res) => {
        const out = {};
        ids.forEach((id) => {
          const rows = (res && res[id]) || [];
          out[id] = downsample(rows.map((r) => Number(r.s ?? r.state)).filter(Number.isFinite), 120);
        });
        this._hist = out;
        this._histVer = (this._histVer || 0) + 1;
        this._update();
      })
      .catch(() => {
        this._histKey = null; // beim nächsten Update erneut versuchen
      });
  }

  /** Sensor-Suche am übergeordneten Gerät (für PoE, Datenraten, Link und PoE-Steuerung) */
  _portFinder(parent) {
    const parentStates = parent.entityIds.map((id) => this._hass.states[id]).filter(Boolean);
    const opts = { deviceName: parent.haName, entities: this._hass.entities };
    return (port, kind) => findPortEntity(parentStates, port, kind, opts);
  }

  _flow(d, parent) {
    if (!parent) return null;
    const c = d.cfg || {};
    const t0 = localize(this._hass);
    const st = this._hass.states;
    const find = this._portFinder(parent);
    // Mehrere Ports (Link Aggregation): Leistung und Datenraten werden addiert
    let ports = parsePorts(c.switch_port);
    if (!ports.length && d.autoLink && d.autoLink.parent === parent.id) ports = d.autoLink.ports;
    const type = c.link_type && c.link_type !== "none" ? c.link_type : null;
    // Switch-Port: RX = vom Gerät empfangen (= Upload des Geräts), TX = zum Gerät gesendet (= Download)
    const pick = (explicit, kind) =>
      explicit && st[explicit]
        ? [st[explicit]]
        : ports.map((p) => find(p, kind)).filter(Boolean);
    const poe = pick(c.poe_entity, "poe");
    // swap_port_direction: falls eine Integration RX/TX (bzw. Download/Upload) je Port andersherum liefert
    const swap = this._config.swap_port_direction === true;
    const down = pick(c.down_entity, swap ? "rx" : "tx");
    const up = pick(c.up_entity, swap ? "tx" : "rx");
    const base = {
      ports,
      port: ports.join(", "),
      portText: ports.every((p) => typeof p === "number") ? `${t0("port")} ${ports.join(", ")}` : ports.join(", "),
      links: Math.max(ports.length, 1),
      type,
    };
    if (!poe.length && !down.length && !up.length) {
      return ports.length || type ? { ...base, poe: null, down: null, up: null } : null;
    }
    const watt = (s) => {
      const n = numericState(s);
      if (n === null) return null;
      const u = String(s.attributes?.unit_of_measurement || "W");
      return u === "mW" ? n / 1000 : u === "kW" ? n * 1000 : n;
    };
    const rate = (s) => toMbit(numericState(s), s.attributes?.unit_of_measurement);
    const sum = (list, conv) => {
      const vals = list.map(conv).filter((v) => v !== null && v !== undefined);
      return vals.length ? vals.reduce((x, y) => x + y, 0) : null;
    };
    // Wird das Gerät nicht über PoE versorgt (Leistung 0 oder nicht verfügbar), entfällt die PoE-Anzeige
    const power = sum(poe, watt);
    return { ...base, poe: power !== null && power > 0.05 ? power : null, down: sum(down, rate), up: sum(up, rate) };
  }

  /** Hängt das Gerät aktiv am Port? Link-Speed-Sensor mit Zahl > 0, PoE-Leistung oder Datenverkehr */
  _portActive(d, parent, flow) {
    if (flow && ((flow.poe || 0) > 0.05 || (flow.down || 0) > 0.01 || (flow.up || 0) > 0.01)) return true;
    return this._linkUp(d, parent) === true;
  }

  /** Link-Speed-Sensor der Ports: true/false, oder null wenn kein solcher Sensor existiert */
  _linkUp(d, parent) {
    if (!parent) return null;
    const find = this._portFinder(parent);
    const sensors = parsePorts(d.cfg?.switch_port).map((p) => find(p, "link")).filter(Boolean);
    if (!sensors.length) return null;
    return sensors.some((s) => Number(s.state) > 0);
  }

  /** PoE-Steuerung der Ports eines Geräts: Schalter "Port PoE" und Button "Power Cycle" am übergeordneten Gerät */
  _poeControls(d, parent) {
    if (!parent || d.secondary || !d.flow) return null;
    const c = d.cfg || {};
    const st = this._hass.states;
    const find = this._portFinder(parent);
    const pick = (explicit, kind) =>
      explicit && st[explicit] ? [explicit] : (d.flow.ports || []).map((p) => find(p, kind)?.entity_id).filter(Boolean);
    const switches = pick(c.poe_switch_entity, "poe_switch");
    const cycles = pick(c.poe_cycle_entity, "cycle");
    if (!switches.length && !cycles.length) return null;
    return { switches, cycles, on: switches.some((id) => st[id]?.state === "on") };
  }

  /** IP-Adresse eines Geräts: Konfiguration, Tracker-Attribut oder das, was der Switch-Port des Uplinks meldet */
  _ip(d) {
    if (d.cfg?.ip) return d.cfg.ip;
    const st = this._hass.states;
    const norm = (v) => String(v || "").trim().toLowerCase();
    for (const id of d.entityIds || []) {
      const a = st[id]?.attributes;
      const ip = a && (a.ip || a.ip_address || a.ipv4);
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(String(ip))) return String(ip);
    }
    const parent = this._devices.find((x) => x.id === d.parent);
    for (const id of parent?.entityIds || []) {
      const a = st[id]?.attributes;
      if (!a || !a.connected_ip) continue;
      if ((a.connected_mac && d.mac && norm(a.connected_mac) === norm(d.mac)) || (a.connected_device && [d.name, d.haName].some((n) => n && norm(n) === norm(a.connected_device)))) {
        return a.connected_ip;
      }
    }
    return null;
  }

  _uptime(d) {
    const st = this._hass.states;
    const s = (d.entityIds || [])
      .map((id) => st[id])
      .filter(Boolean)
      .find((x) => x.entity_id.startsWith("sensor.") && /uptime|betriebszeit|laufzeit/i.test(`${x.entity_id} ${x.attributes?.friendly_name || ""}`));
    return uptimeSeconds(s);
  }

  _model() {
    const hass = this._hass;
    const cfg = this._config;
    if (this._devRef !== hass.devices || this._entRef !== hass.entities) {
      this._devRef = hass.devices;
      this._entRef = hass.entities;
      this._collectDevices();
    }
    // Port-Sensoren können später aktiviert werden: Zuordnung bei Änderung neu aufbauen
    const liveSig = JSON.stringify(detectLinks(this._allUnifi || [], hass.states, hass.entities));
    if (liveSig !== this._linkSig) this._collectDevices();
    const byId = Object.fromEntries(this._devices.map((d) => [d.id, d]));
    const items = this._devices.map((d) => {
      const s = this._status(d);
      const flow = cfg.show_flows ? this._flow(d, byId[d.parent]) : null;
      // Externes Gerät mit Status-Entität, die „offline“ meldet, aber am Port aktiv ist (Link, PoE oder Datenverkehr): online
      if (d.external && !s.online && this._portActive(d, byId[d.parent], flow)) s.online = true;
      // Ohne eigene Status-Entität: Standard ist der Link-Speed-Sensor des Ports (Verkabelung steht, nicht Gerätezustand)
      if (d.external && !d.entityIds[0]) {
        const up = this._linkUp(d, byId[d.parent]);
        if (up !== null) s.online = up || this._portActive(d, byId[d.parent], flow);
      }
      const item = { ...d, ...s, flow, clients: this._clients(d), restart: this._restart(d) };
      item.poeCtl = this._poeControls(item, byId[d.parent]);
      return item;
    });
    // PoE-Verbrauch pro Switch (Summe der Kinder)
    const used = {};
    items.forEach((d) => {
      if (d.parent && !d.secondary && d.flow && d.flow.poe) used[d.parent] = (used[d.parent] || 0) + d.flow.poe;
    });
    items.forEach((d) => {
      d.poeUsed = used[d.id] || 0;
      d.poeBudget = Number(d.cfg?.poe_budget) || 0;
    });
    const visible = items.filter((d) => cfg.show_offline || d.online);
    const real = items.filter((d) => !d.secondary); // Zweitverbindungen nicht doppelt zählen
    const summary = {
      online: real.filter((d) => d.online).length,
      total: real.length,
      poe: Object.values(used).reduce((a, b) => a + b, 0),
      down: real.filter((d) => byId[d.parent]?.type === "gateway").reduce((a, d) => a + (d.flow?.down || 0), 0),
      up: real.filter((d) => byId[d.parent]?.type === "gateway").reduce((a, d) => a + (d.flow?.up || 0), 0),
      hasUplink: real.some((d) => byId[d.parent]?.type === "gateway" && (d.flow?.down != null || d.flow?.up != null)),
    };
    const latency = this._latency();
    const wan = this._wan();
    return { items: visible, summary, latency, wan };
  }

  _update() {
    if (!this._config || !this._hass) {
      if (this._config) this._render(null);
      return;
    }
    const model = this._model();
    this._loadHistory([...model.latency, ...model.wan]);
    const sig = JSON.stringify([
      model.items.map((d) => [d.id, d.name, d.online, d.update, d.flow, d.poeUsed, d.poeBudget, d.cfg?.image, d.clients, d.secondary, d.restart, d.poeCtl]),
      model.summary,
      model.latency.map((l) => [l.entity, l.name, l.icon, l.value, l.unit]),
      model.wan.map((w) => [w.entity, w.value]),
      this._histVer,
      this._confirm,
      this._config,
      this._hass.locale?.language,
    ]);
    if (sig === this._sig) return;
    // Nutzeraktionen (Dialoge) sofort zeigen; reine Liveswerte erst, wenn nicht gescrollt wird
    const confirmKey = JSON.stringify(this._confirm ?? null);
    if (Date.now() < (this._holdUntil || 0) && confirmKey === this._confirmKey) {
      if (!this._deferTimer) {
        this._deferTimer = setTimeout(() => {
          this._deferTimer = null;
          this._update();
        }, Math.max(100, this._holdUntil - Date.now()));
      }
      return;
    }
    this._confirmKey = confirmKey;
    this._sig = sig;
    this._lastModel = model;
    this._render(model);
  }

  /* ---- Darstellung ---- */

  _imageUrl(d) {
    const c = this._config;
    if (d.cfg?.image) return safeImageUrl(d.cfg.image);
    if (d.external) return null;
    if (c.image_base && d.model) {
      const base = c.image_base.endsWith("/") ? c.image_base : `${c.image_base}/`;
      return safeImageUrl(`${base}${encodeURIComponent(d.model.replace(/\s+/g, "-"))}.png`);
    }
    return null;
  }

  _chip(flow, t, locale) {
    const parts = [];
    if (flow.poe !== null && flow.poe !== undefined) parts.push(`<div class="poe">${BOLT} ${esc(formatPower(flow.poe, locale))}</div>`);
    if (flow.down != null || flow.up != null) {
      parts.push(
        `<div><span class="r"><b class="ar down">↓</b> ${esc(formatRate(flow.down, locale))}</span> <span class="r"><b class="ar up">↑</b> ${esc(formatRate(flow.up, locale))}</span></div>`
      );
    }
    return parts.join("");
  }

  /** Kleine Kennzeichnung der Verbindung: LAN / WLAN / LAG ×2 */
  _tag(f, t) {
    const parts = [];
    if (f.type === "wifi") parts.push(t("link_wifi"));
    else if (f.type === "lan") parts.push(t("link_lan"));
    if (f.links > 1) parts.push(`${t("lag")} ×${f.links}`);
    return parts.length ? `<div><span class="lt">${esc(parts.join(" · "))}</span></div>` : "";
  }

  _link(d, locale, t) {
    const f = d.flow;
    const act = d.poeCtl ? ` act" data-id="${esc(d.id)}" role="button" tabindex="0" title="${esc(t("poe_manage"))}` : "";
    if (!this._config.show_flows || !f) return `<div class="link${act}"><div class="stem ${d.online ? 'on' : 'off'}"></div></div>`;
    if (!d.online) {
      return `<div class="link${act}"><div class="stem off"></div><div class="chip" style="left:calc(50% + 10px)"><span class="off">${esc(t("no_link"))}</span></div></div>`;
    }
    const lines = [];
    const dur = (v) => (v >= 100 ? 0.5 : v >= 10 ? 0.8 : v >= 1 ? 1.2 : 2);
    if (f.poe !== null && f.poe !== undefined) {
      lines.push(`<div class="fl p dn${f.poe > 0.05 ? "" : " idle"}" style="--dur:1s"></div>`);
    }
    if (f.down != null) lines.push(`<div class="fl d dn${f.down > 0.01 ? "" : " idle"}" style="--dur:${dur(f.down)}s"></div>`);
    if (f.up != null) lines.push(`<div class="fl u upw${f.up > 0.01 ? "" : " idle"}" style="--dur:${dur(f.up)}s"></div>`);
    if (!lines.length) {
      const tag = this._tag(f, t);
      return `<div class="link${act}"><div class="stem on"></div>${tag ? `<div class="chip" style="left:calc(50% + 10px)">${tag}</div>` : ""}</div>`;
    }
    const width = lines.length * 4 + (lines.length - 1) * 2;
    return `<div class="link${act}"><div class="lines" style="width:${width}px;left:calc(50% - ${width / 2}px)">${lines.join("")}</div><div class="chip" style="left:calc(50% + ${width / 2 + 7}px)">${this._tag(f, t)}${this._chip(f, t, locale)}</div></div>`;
  }

  _tile(d, locale, t, inGrid = false) {
    const img = this._imageUrl(d);
    const icon = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[d.type] || ICONS.other}</svg>`;
    const port = d.flow?.portText ? ` · ${esc(d.flow.portText)}` : "";
    const pct = d.poeBudget ? Math.min(100, (d.poeUsed / d.poeBudget) * 100) : 0;
    const budget = d.poeBudget
      ? `<div class="budget"><div class="bar"><div style="width:${pct.toFixed(1)}%"></div></div><div class="txt">${esc(t("poe"))} ${esc(formatPower(d.poeUsed, locale))} / ${esc(formatPower(d.poeBudget, locale))}</div></div>`
      : "";
    const clients = d.clients != null ? `<div class="cl" title="${esc(t("clients"))}">${USERS} ${esc(d.clients)}</div>` : "";
    const restart = d.restart
      ? `<button class="rs" type="button" data-entity="${esc(d.restart)}" data-name="${esc(d.name)}" title="${esc(t("restart"))}" aria-label="${esc(t("restart"))}: ${esc(d.name)}"><ha-icon icon="mdi:restart"></ha-icon></button>`
      : "";
    const visual = d.external && d.cfg.icon ? `<ha-icon icon="${esc(d.cfg.icon)}"></ha-icon>` : `<div class="fb">${icon}</div>`;
    const meta = inGrid && d.flow ? `<div class="meta">${this._chip(d.flow, t, locale)}</div>` : "";
    return `
      <div class="tile ${d.online ? "on" : "off"}${d.external ? " ext" : ""}${d.secondary ? " ghost" : ""}" data-id="${esc(d.id)}" title="${esc(d.model)}" role="button" tabindex="0">
        <div class="img">
          ${img ? `<img src="${esc(img)}" alt="${esc(d.model)}" loading="lazy"><div class="fb" hidden>${icon}</div>` : visual}
          <span class="dot"></span>
          ${restart}
          ${d.update ? `<span class="upd" title="${esc(t("update"))}">${ARROW}</span>` : ""}
        </div>
        <div class="name">${esc(d.name)}</div>
        <div class="sub">${esc(d.model)}${d.sw ? " · " + esc(d.sw) : ""}${port}</div>
        ${clients}${budget}${meta}
      </div>`;
  }

  _treeHtml(items, locale, t) {
    const { roots, children } = buildTree(items);
    const node = (d, isRoot) => `
      <li class="${d.online ? "on" : "off"}">${isRoot ? "" : this._link(d, locale, t)}${this._tile(d, locale, t)}
        ${children[d.id] ? `<ul class="${children[d.id].some((c) => c.online) ? "on" : "off"}">${children[d.id].map((c) => node(c, false)).join("")}</ul>` : ""}
      </li>`;
    return `<ul class="tree root">${roots.map((d) => node(d, true)).join("")}</ul>`;
  }

  _gridHtml(items, locale, t) {
    return TYPE_ORDER.map((type) => {
      const group = items.filter((d) => d.type === type);
      if (!group.length) return "";
      return `<h3>${esc(t(type))} (${group.length})</h3><div class="grid">${group.map((d) => this._tile(d, locale, t, true)).join("")}</div>`;
    }).join("");
  }

  _sparkSvg(hist) {
    const sp = sparkline(hist);
    return sp
      ? `<svg class="sp" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="sa" d="${sp.area}"/><path class="sl" d="${sp.line}" vector-effect="non-scaling-stroke"/></svg>`
      : "";
  }

  _wanHtml(list, locale, t) {
    if (!list || !list.length) return "";
    const arrow = { down: "↓", up: "↑" };
    const cells = list
      .map((w) => {
        const svg = this._sparkSvg(w.hist);
        return `<div class="pg ${w.kind}" data-entity="${esc(w.entity)}" role="button" tabindex="0" title="${esc(w.entity)}">${svg}<div class="pc"><b class="ar ${w.kind} big">${arrow[w.kind]}</b><div><div class="pn">${esc(t(w.label))}</div><div class="pv">${esc(formatRate(w.value, locale))}</div></div></div></div>`;
      })
      .join("");
    return `<h3 class="ph">${esc(t("internet"))}</h3><div class="ping">${cells}</div>`;
  }

  _latencyHtml(list, locale, t) {
    if (!list || !list.length) return "";
    const fmt = (l) =>
      l.value === null ? "–" : `${new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: 1 }).format(l.value)} ${l.unit}`;
    const cells = list
      .map((l) => {
        const svg = this._sparkSvg(l.hist);
        return `<div class="pg" data-entity="${esc(l.entity)}" role="button" tabindex="0" title="${esc(l.entity)}">${svg}<div class="pc"><ha-icon icon="${esc(l.icon)}"></ha-icon><div class="pn">${esc(l.name)}</div><div class="pv">${esc(fmt(l))}</div></div></div>`;
      })
      .join("");
    return `<h3 class="ph">${esc(t("ping"))}</h3><div class="ping">${cells}</div>`;
  }

  _confirmHtml(t) {
    const c = this._confirm;
    if (!c) return "";
    if (c.type === "device") {
      const d = (this._lastModel?.items || []).find((x) => x.id === c.id);
      if (!d) return "";
      const lang = this._hass?.locale?.language || this._hass?.language;
      const up = this._uptime(d);
      const ip = this._ip(d);
      const rows = [
        [t("info_status"), `${esc(t(d.online ? "online" : "offline"))}${d.update ? ` · ${esc(t("update"))}` : ""}`],
        [t("info_ip"), ip ? esc(ip) : "–"],
        [t("info_uptime"), up === null ? "–" : esc(formatDuration(up, lang))],
      ];
      const rs = d.restart ? `<button type="button" class="danger" data-act="dev-restart" data-entity="${esc(d.restart)}" data-name="${esc(d.name)}">${esc(t("restart"))}</button>` : "";
      return `<div class="dlg" role="dialog" aria-modal="true"><div class="box"><p><b>${esc(d.name)}</b><br><span class="sub">${esc([d.model, d.sw].filter(Boolean).join(" · "))}</span></p><dl class="info">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl><div class="acts col">${rs}<button type="button" data-act="cancel">${esc(t("close"))}</button></div></div></div>`;
    }
    if (c.type === "poe") {
      const st = this._hass.states;
      const on = c.switches.some((id) => st[id]?.state === "on");
      const sw = c.switches.length
        ? `<button type="button" class="${on ? "danger" : ""}" data-act="poe-toggle">${esc(t(on ? "poe_off" : "poe_on"))}</button>`
        : "";
      const cy = c.cycles.length ? `<button type="button" data-act="poe-cycle">${esc(t("poe_cycle"))}</button>` : "";
      return `<div class="dlg" role="dialog" aria-modal="true"><div class="box"><p><b>${esc(c.name)}</b>${c.port ? `<br><span class="sub">${esc(c.port)}</span>` : ""}</p><div class="acts col">${sw}${cy}<button type="button" data-act="cancel">${esc(t("cancel"))}</button></div></div></div>`;
    }
    const text = t("restart_confirm").replace("{name}", () => esc(c.name));
    return `<div class="dlg" role="alertdialog" aria-modal="true"><div class="box"><p>${text}</p><div class="acts"><button type="button" data-act="cancel">${esc(t("cancel"))}</button><button type="button" class="danger" data-act="ok">${esc(t("restart_do"))}</button></div></div></div>`;
  }

  _render(model) {
    const cfg = this._config;
    const hass = this._hass;
    const t = localize(hass);
    const locale = hass?.locale?.language || hass?.language;
    let body;
    if (!model) body = `<div class="msg">${esc(t("loading"))}</div>`;
    else if (!model.items.length) body = `<div class="msg">${esc(t("empty"))}</div>`;
    else body = cfg.layout === "grid" ? this._gridHtml(model.items, locale, t) : this._treeHtml(model.items, locale, t);

    // Ohne hass (z. B. beim ersten Rendern im Editor) gibt es noch kein Modell
    const s = model?.summary || { online: 0, total: 0, poe: 0, down: 0, up: 0, hasUplink: false };
    const pills = [`<span class="pill">${s.online}/${s.total} ${esc(t("online"))}</span>`];
    if (cfg.show_flows && s.poe > 0) pills.push(`<span class="pill">${BOLT} ${esc(formatPower(s.poe, locale))}</span>`);
    if (cfg.show_flows && s.hasUplink) {
      pills.push(`<span class="pill"><b class="ar down">↓</b> ${esc(formatRate(s.down, locale))}</span>`);
      pills.push(`<span class="pill"><b class="ar up">↑</b> ${esc(formatRate(s.up, locale))}</span>`);
    }
    const header = `<div class="head"><h2>${esc(cfg.title ?? t("title"))}</h2>${cfg.show_summary && model ? `<div class="pills">${pills.join("")}</div>` : ""}</div>`;
    const legend =
      cfg.show_flows && cfg.show_legend && cfg.layout !== "grid"
        ? `<div class="legend"><span><i style="background:var(--unifi-poe)"></i>${esc(t("legend_poe"))}</span><span><i style="background:var(--unifi-down)"></i>${esc(t("legend_down"))}</span><span><i style="background:var(--unifi-up)"></i>${esc(t("legend_up"))}</span></div>`
        : "";

    const vars = [
      `--unifi-poe:${resolveColor(cfg.poe_color, "var(--warning-color, #ff9800)")}`,
      `--unifi-down:${resolveColor(cfg.down_color, "var(--info-color, var(--primary-color, #039be5))")}`,
      `--unifi-up:${resolveColor(cfg.up_color, "var(--success-color, #4caf50)")}`,
    ].join(";");

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <ha-card class="${cfg.animate_flows ? "anim" : ""}" data-d="${cfg.layout === "grid" ? "normal" : this._density || "normal"}" style="${esc(vars)}">
        ${header}${body}${this._wanHtml(model?.wan, locale, t)}${this._latencyHtml(model?.latency, locale, t)}${legend}${this._confirmHtml(t)}
      </ha-card>`;

    if (cfg.layout !== "grid") {
      // Die Dichte-Messung schaltet testweise zwischen den Stufen um und ändert dabei die Kartenhöhe.
      // Das nur bei geänderter Breite/Struktur tun; bei reinen Wertänderungen genügt ein Überlauf-Check.
      const fitKey = [Math.round(this.clientWidth || 0), cfg.density, model ? model.items.map((d) => d.id).join(",") : ""].join("|");
      const tree = this.shadowRoot.querySelector?.("ul.tree.root");
      const overflow = !!tree && this._density !== "list" && tree.scrollWidth > tree.clientWidth + 1;
      if (fitKey !== this._fitKey || overflow) {
        this._fitKey = fitKey;
        this._fit();
      }
    }

    // Bild-Fallback ohne Inline-Handler
    this.shadowRoot.querySelectorAll(".img img").forEach((img) => {
      img.addEventListener("error", () => {
        img.hidden = true;
        const fb = img.nextElementSibling;
        if (fb) fb.hidden = false;
      });
    });

    const moreInfo = (entityId) => {
      if (!entityId) return;
      const ev = new Event("hass-more-info", { bubbles: true, composed: true });
      ev.detail = { entityId };
      this.dispatchEvent(ev);
    };
    const bind = (el, fn) => {
      el.addEventListener("click", fn);
      el.addEventListener("keydown", (e) => {
        if (e.target === el && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          fn(e);
        }
      });
    };
    // Klick auf ein Gerät: kleines Info-Fenster (Status, IP, Betriebszeit, Neustart) statt Sensor-Details
    this.shadowRoot.querySelectorAll(".tile").forEach((el) =>
      bind(el, () => {
        this._confirm = { type: "device", id: el.dataset.id };
        this._update();
      })
    );
    this.shadowRoot.querySelectorAll(".pg").forEach((el) => bind(el, () => moreInfo(el.dataset.entity)));
    // Neustart: erst nach Bestätigung wird button.press ausgelöst
    this.shadowRoot.querySelectorAll(".rs").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this._confirm = { entity: el.dataset.entity, name: el.dataset.name };
        this._update();
      })
    );
    // Klick auf eine Verbindung: PoE ein/aus und PoE-Neustart (Power Cycle) des Ports anbieten
    this.shadowRoot.querySelectorAll(".link.act").forEach((el) =>
      bind(el, () => {
        const d = this._devices.find((x) => x.id === el.dataset.id);
        const parent = d && this._devices.find((x) => x.id === d.parent);
        const model = this._lastModel?.items.find((x) => x.id === el.dataset.id);
        const ctl = model?.poeCtl;
        if (!d || !ctl) return;
        this._confirm = {
          type: "poe",
          name: d.name,
          port: [parent?.name, model.flow?.portText].filter(Boolean).join(" · "),
          switches: ctl.switches,
          cycles: ctl.cycles,
        };
        this._update();
      })
    );
    this.shadowRoot.querySelectorAll(".dlg").forEach((el) =>
      el.addEventListener("click", (e) => {
        if (e.target === el) {
          this._confirm = null;
          this._update();
        }
      })
    );
    this.shadowRoot.querySelectorAll(".dlg [data-act]").forEach((el) =>
      el.addEventListener("click", () => {
        const c = this._confirm;
        const act = el.dataset.act;
        this._confirm = null;
        if (act === "dev-restart") this._confirm = { entity: el.dataset.entity, name: el.dataset.name };
        else if (c && act === "ok") this._hass.callService("button", "press", { entity_id: c.entity });
        else if (c && act === "poe-cycle") this._hass.callService("button", "press", { entity_id: c.cycles });
        else if (c && act === "poe-toggle") {
          const on = c.switches.some((id) => this._hass.states[id]?.state === "on");
          this._hass.callService("switch", on ? "turn_off" : "turn_on", { entity_id: c.switches });
        }
        this._update();
      })
    );
  }
}

if (!customElements.get("unifi-network-card")) {
  customElements.define("unifi-network-card", UnifiNetworkCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "unifi-network-card")) {
  window.customCards.push({
    type: "unifi-network-card",
    name: "UniFi Network Card",
    description: "UniFi-Topologie mit Geräte-Bildern sowie Daten- und PoE-Flüssen.",
    preview: false,
    documentationURL: "https://github.com/BeGiBue/home-assistant-unifi-card",
  });
}

console.info(
  `%c UNIFI-NETWORK-CARD %c ${VERSION} `,
  "color:white;background:#03a9f4;font-weight:700;",
  "color:#03a9f4;background:white;font-weight:700;"
);
