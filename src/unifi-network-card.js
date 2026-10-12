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
  buildTree,
  resolveParents,
  collectUnifiDevices,
  parsePorts,
  downsample,
  sparkline,
  detectLinks,
} from "./utils.js";
import "./unifi-network-card-editor.js";

/* global __VERSION__ */
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

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
      swap_port_direction: false,
      latency_entities: [],
      devices: [],
      external_devices: [],
      ...config,
    };
    this._sig = "";
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
    const { list, byDevice } = collectUnifiDevices(this._hass, this._config.config_entry);
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
        mac: ((d.connections || []).find((c) => c && c[0] === "mac") || [])[1] || "",
        cfg,
      };
    });
    // Automatische Zuordnung Gerät -> Switch-Port (UniFi Network+), nur wenn nichts konfiguriert ist
    this._links = detectLinks(base, this._hass.states);
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
    if (!defs.length) {
      this._devices
        .filter((d) => !d.external)
        .forEach((d) =>
          d.entityIds.forEach((id) => {
            if (id.startsWith("sensor.") && /latency/i.test(id) && st[id]) defs.push({ entity: id, dev: d.name });
          })
        );
    }
    if (!(cfg.latency_entities || []).length) {
      // WAN-Latenz der Community-Integration UniFi Network+ (hängt am Controller-Eintrag, nicht an einem Gerät)
      Object.values(st).forEach((s) => {
        const id = s.entity_id;
        if (id.startsWith("sensor.") && /wan.*latency/i.test(id) && !defs.some((x) => x.entity === id)) {
          defs.push({ entity: id, global: true });
        }
      });
    }
    return defs
      .map((x) => {
        const s = st[x.entity];
        if (!s) return null;
        const fn = s.attributes?.friendly_name || x.entity;
        let name = x.name;
        if (!name && x.global) name = localize(this._hass)("wan_latency");
        if (!name) {
          name = fn;
          if (x.dev && name.toLowerCase().startsWith(x.dev.toLowerCase())) name = name.slice(x.dev.length);
          name = name.replace(/\s*(wan\s*)?latency\s*$/i, "").replace(/^\s*(wan\s*)?latency\s*/i, "").trim() || fn;
        }
        const guess = /cloudflare/i.test(name) ? "mdi:cloud-outline" : /google/i.test(name) ? "mdi:google" : /microsoft/i.test(name) ? "mdi:microsoft" : null;
        const n = Number(s.state);
        return {
          entity: x.entity,
          name,
          icon: x.icon || s.attributes?.icon || guess || "mdi:network-outline",
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
    const find = (re) =>
      Object.values(st)
        .filter((s) => s.entity_id.startsWith("sensor."))
        .filter((s) => {
          const txt = `${s.entity_id} ${s.attributes?.friendly_name || ""}`;
          return /wan/i.test(txt) && re.test(txt) && !/speed_?test|usage|total|volume|latency|availab/i.test(txt) && !/wan_?[2-9]/i.test(s.entity_id);
        })
        .map((s) => s.entity_id)
        .sort()[0];
    const mk = (kind, own, re, label) => {
      const id = own || find(re);
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
      mk("down", cfg.wan_down_entity, /(download|downstream|_down\b|\bdown\b)/i, "legend_down"),
      mk("up", cfg.wan_up_entity, /(upload|upstream|_up\b|\bup\b)/i, "legend_up"),
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

  _flow(d, parent) {
    if (!parent) return null;
    const c = d.cfg || {};
    const st = this._hass.states;
    const parentStates = parent.entityIds.map((id) => st[id]).filter(Boolean);
    // Mehrere Ports (Link Aggregation): Leistung und Datenraten werden addiert
    let ports = parsePorts(c.switch_port);
    if (!ports.length && d.autoLink && d.autoLink.parent === parent.id) ports = d.autoLink.ports;
    const type = c.link_type && c.link_type !== "none" ? c.link_type : null;
    // Switch-Port: RX = vom Gerät empfangen (= Upload des Geräts), TX = zum Gerät gesendet (= Download)
    const pick = (explicit, kind) =>
      explicit && st[explicit] ? [st[explicit]] : ports.map((p) => findPortEntity(parentStates, p, kind)).filter(Boolean);
    const poe = pick(c.poe_entity, "poe");
    // swap_port_direction: falls eine Integration RX/TX (bzw. Download/Upload) je Port andersherum liefert
    const swap = this._config.swap_port_direction === true;
    const down = pick(c.down_entity, swap ? "rx" : "tx");
    const up = pick(c.up_entity, swap ? "tx" : "rx");
    const base = { ports, port: ports.join(", "), links: Math.max(ports.length, 1), type };
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
    return { ...base, poe: sum(poe, watt), down: sum(down, rate), up: sum(up, rate) };
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
    const liveSig = JSON.stringify(detectLinks(this._devices.filter((d) => !d.external), hass.states));
    if (liveSig !== this._linkSig) this._collectDevices();
    const byId = Object.fromEntries(this._devices.map((d) => [d.id, d]));
    const items = this._devices.map((d) => {
      const s = this._status(d);
      const flow = cfg.show_flows ? this._flow(d, byId[d.parent]) : null;
      return { ...d, ...s, flow, clients: this._clients(d), restart: this._restart(d) };
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
      model.items.map((d) => [d.id, d.name, d.online, d.update, d.flow, d.poeUsed, d.poeBudget, d.cfg?.image, d.clients, d.secondary, d.restart]),
      model.summary,
      model.latency.map((l) => [l.entity, l.name, l.icon, l.value, l.unit]),
      model.wan.map((w) => [w.entity, w.value]),
      this._histVer,
      this._confirm,
      this._config,
      this._hass.locale?.language,
    ]);
    if (sig === this._sig) return;
    this._sig = sig;
    this._render(model);
  }

  /* ---- Darstellung ---- */

  _imageUrl(d) {
    const c = this._config;
    if (d.cfg?.image) return d.cfg.image;
    if (d.external) return null;
    if (c.image_base && d.model) {
      const base = c.image_base.endsWith("/") ? c.image_base : `${c.image_base}/`;
      return `${base}${encodeURIComponent(d.model.replace(/\s+/g, "-"))}.png`;
    }
    return null;
  }

  _chip(flow, t, locale) {
    const parts = [];
    if (flow.poe !== null && flow.poe !== undefined) parts.push(`<div class="poe">${BOLT} ${esc(formatPower(flow.poe, locale))}</div>`);
    if (flow.down != null || flow.up != null) {
      parts.push(
        `<div><b class="ar down">↓</b> ${esc(formatRate(flow.down, locale))} <b class="ar up">↑</b> ${esc(formatRate(flow.up, locale))}</div>`
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
    if (!this._config.show_flows || !f) return `<div class="link"><div class="stem ${d.online ? 'on' : 'off'}"></div></div>`;
    const hasData = f.down != null || f.up != null;
    if (!d.online) {
      return `<div class="link"><div class="stem ${d.online ? 'on' : 'off'}"></div><div class="chip" style="left:calc(50% + 10px)"><span class="off">${esc(t("no_link"))}</span></div></div>`;
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
      return `<div class="link"><div class="stem ${d.online ? 'on' : 'off'}"></div>${tag ? `<div class="chip" style="left:calc(50% + 10px)">${tag}</div>` : ""}</div>`;
    }
    const width = lines.length * 4 + (lines.length - 1) * 2;
    return `<div class="link"><div class="lines" style="width:${width}px;left:calc(50% - ${width / 2}px)">${lines.join("")}</div><div class="chip" style="left:calc(50% + ${width / 2 + 7}px)">${this._tag(f, t)}${this._chip(f, t, locale)}</div></div>`;
  }

  _tile(d, locale, t, inGrid = false) {
    const img = this._imageUrl(d);
    const icon = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[d.type] || ICONS.other}</svg>`;
    const port = d.flow?.port ? ` · ${esc(t("port"))} ${esc(d.flow.port)}` : "";
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

  _wanHtml(list, locale, t) {
    if (!list || !list.length) return "";
    const arrow = { down: "↓", up: "↑" };
    const cells = list
      .map((w) => {
        const sp = sparkline(w.hist);
        const svg = sp
          ? `<svg class="sp" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="sa" d="${sp.area}"/><path class="sl" d="${sp.line}" vector-effect="non-scaling-stroke"/></svg>`
          : "";
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
        const sp = sparkline(l.hist);
        const svg = sp
          ? `<svg class="sp" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="sa" d="${sp.area}"/><path class="sl" d="${sp.line}" vector-effect="non-scaling-stroke"/></svg>`
          : "";
        return `<div class="pg" data-entity="${esc(l.entity)}" role="button" tabindex="0" title="${esc(l.entity)}">${svg}<div class="pc"><ha-icon icon="${esc(l.icon)}"></ha-icon><div class="pn">${esc(l.name)}</div><div class="pv">${esc(fmt(l))}</div></div></div>`;
      })
      .join("");
    return `<h3 class="ph">${esc(t("ping"))}</h3><div class="ping">${cells}</div>`;
  }

  _confirmHtml(t) {
    const c = this._confirm;
    if (!c) return "";
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
      <ha-card class="${cfg.animate_flows ? "anim" : ""}" style="${esc(vars)}">
        ${header}${body}${this._wanHtml(model?.wan, locale, t)}${this._latencyHtml(model?.latency, locale, t)}${legend}${this._confirmHtml(t)}
      </ha-card>`;

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
    this.shadowRoot.querySelectorAll(".tile").forEach((el) =>
      bind(el, () => {
        const d = this._devices.find((x) => x.id === el.dataset.id);
        moreInfo(d && (d.entityIds.find((e) => e.startsWith("device_tracker.")) || d.entityIds[0]));
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
    this.shadowRoot.querySelectorAll(".dlg [data-act]").forEach((el) =>
      el.addEventListener("click", () => {
        const c = this._confirm;
        this._confirm = null;
        if (el.dataset.act === "ok" && c) this._hass.callService("button", "press", { entity_id: c.entity });
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
    documentationURL: "https://github.com/BeGiBue/unifi-custom-card",
  });
}

console.info(
  `%c UNIFI-NETWORK-CARD %c ${VERSION} `,
  "color:white;background:#03a9f4;font-weight:700;",
  "color:#03a9f4;background:white;font-weight:700;"
);
