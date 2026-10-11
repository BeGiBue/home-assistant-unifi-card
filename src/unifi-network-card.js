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
};

const BOLT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>';
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
      devices: [],
      ...config,
    };
    this._sig = "";
    this._devRef = null;
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
        cfg,
      };
    });
    this._devices = resolveParents(base, this._config.auto_parent !== false);
  }

  _status(d) {
    const st = this._hass.states;
    const states = d.entityIds.map((id) => st[id]).filter(Boolean);
    const tracker = states.find((s) => s.entity_id.startsWith("device_tracker."));
    const online = tracker
      ? tracker.state === "home"
      : states.some((s) => !["unavailable", "unknown"].includes(s.state));
    const update = states.some((s) => s.entity_id.startsWith("update.") && s.state === "on");
    return { online, update };
  }

  _flow(d, parent) {
    if (!parent) return null;
    const c = d.cfg || {};
    const st = this._hass.states;
    const parentStates = parent.entityIds.map((id) => st[id]).filter(Boolean);
    const port = c.switch_port;
    // Switch-Port: RX = vom Gerät empfangen (= Upload des Geräts), TX = zum Gerät gesendet (= Download)
    const poe = (c.poe_entity && st[c.poe_entity]) || findPortEntity(parentStates, port, "poe");
    const down = (c.down_entity && st[c.down_entity]) || findPortEntity(parentStates, port, "tx");
    const up = (c.up_entity && st[c.up_entity]) || findPortEntity(parentStates, port, "rx");
    if (!poe && !down && !up) return port ? { port, poe: null, down: null, up: null } : null;
    const watt = (s) => {
      const n = numericState(s);
      if (n === null) return null;
      const u = String(s.attributes?.unit_of_measurement || "W");
      return u === "mW" ? n / 1000 : u === "kW" ? n * 1000 : n;
    };
    const rate = (s) => (s ? toMbit(numericState(s), s.attributes?.unit_of_measurement) : null);
    return { port, poe: poe ? watt(poe) : null, down: rate(down), up: rate(up) };
  }

  _model() {
    const hass = this._hass;
    const cfg = this._config;
    if (this._devRef !== hass.devices || this._entRef !== hass.entities) {
      this._devRef = hass.devices;
      this._entRef = hass.entities;
      this._collectDevices();
    }
    const byId = Object.fromEntries(this._devices.map((d) => [d.id, d]));
    const items = this._devices.map((d) => {
      const s = this._status(d);
      const flow = cfg.show_flows ? this._flow(d, byId[d.parent]) : null;
      return { ...d, ...s, flow };
    });
    // PoE-Verbrauch pro Switch (Summe der Kinder)
    const used = {};
    items.forEach((d) => {
      if (d.parent && d.flow && d.flow.poe) used[d.parent] = (used[d.parent] || 0) + d.flow.poe;
    });
    items.forEach((d) => {
      d.poeUsed = used[d.id] || 0;
      d.poeBudget = Number(d.cfg?.poe_budget) || 0;
    });
    const visible = items.filter((d) => cfg.show_offline || d.online);
    const summary = {
      online: items.filter((d) => d.online).length,
      total: items.length,
      poe: Object.values(used).reduce((a, b) => a + b, 0),
      down: items.filter((d) => byId[d.parent]?.type === "gateway").reduce((a, d) => a + (d.flow?.down || 0), 0),
      up: items.filter((d) => byId[d.parent]?.type === "gateway").reduce((a, d) => a + (d.flow?.up || 0), 0),
      hasUplink: items.some((d) => byId[d.parent]?.type === "gateway" && (d.flow?.down != null || d.flow?.up != null)),
    };
    return { items: visible, summary };
  }

  _update() {
    if (!this._config || !this._hass) {
      if (this._config) this._render(null);
      return;
    }
    const model = this._model();
    const sig = JSON.stringify([
      model.items.map((d) => [d.id, d.name, d.online, d.update, d.flow, d.poeUsed, d.poeBudget, d.cfg?.image]),
      model.summary,
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

  _link(d, locale, t) {
    const f = d.flow;
    if (!this._config.show_flows || !f) return `<div class="link"><div class="stem"></div></div>`;
    const hasData = f.down != null || f.up != null;
    if (!d.online) {
      return `<div class="link"><div class="stem"></div><div class="chip" style="left:calc(50% + 10px)"><span class="off">${esc(t("no_link"))}</span></div></div>`;
    }
    const lines = [];
    const dur = (v) => (v >= 100 ? 0.5 : v >= 10 ? 0.8 : v >= 1 ? 1.2 : 2);
    if (f.poe !== null && f.poe !== undefined) {
      lines.push(`<div class="fl p dn${f.poe > 0.05 ? "" : " idle"}" style="--dur:1s"></div>`);
    }
    if (f.down != null) lines.push(`<div class="fl d dn${f.down > 0.01 ? "" : " idle"}" style="--dur:${dur(f.down)}s"></div>`);
    if (f.up != null) lines.push(`<div class="fl u upw${f.up > 0.01 ? "" : " idle"}" style="--dur:${dur(f.up)}s"></div>`);
    if (!lines.length) return `<div class="link"><div class="stem"></div></div>`;
    const width = lines.length * 4 + (lines.length - 1) * 2;
    return `<div class="link"><div class="lines" style="width:${width}px;left:calc(50% - ${width / 2}px)">${lines.join("")}</div><div class="chip" style="left:calc(50% + ${width / 2 + 7}px)">${this._chip(f, t, locale)}</div></div>`;
  }

  _tile(d, locale, t, inGrid = false) {
    const img = this._imageUrl(d);
    const icon = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[d.type] || ICONS.other}</svg>`;
    const port = d.flow?.port ? ` · ${esc(t("port"))} ${esc(d.flow.port)}` : "";
    const pct = d.poeBudget ? Math.min(100, (d.poeUsed / d.poeBudget) * 100) : 0;
    const budget = d.poeBudget
      ? `<div class="budget"><div class="bar"><div style="width:${pct.toFixed(1)}%"></div></div><div class="txt">${esc(t("poe"))} ${esc(formatPower(d.poeUsed, locale))} / ${esc(formatPower(d.poeBudget, locale))}</div></div>`
      : "";
    const meta = inGrid && d.flow ? `<div class="meta">${this._chip(d.flow, t, locale)}</div>` : "";
    return `
      <div class="tile ${d.online ? "on" : "off"}" data-id="${esc(d.id)}" title="${esc(d.model)}" role="button" tabindex="0">
        <div class="img">
          ${img ? `<img src="${esc(img)}" alt="${esc(d.model)}" loading="lazy"><div class="fb" hidden>${icon}</div>` : `<div class="fb">${icon}</div>`}
          <span class="dot"></span>
          ${d.update ? `<span class="upd" title="${esc(t("update"))}">${ARROW}</span>` : ""}
        </div>
        <div class="name">${esc(d.name)}</div>
        <div class="sub">${esc(d.model)}${d.sw ? " · " + esc(d.sw) : ""}${port}</div>
        ${budget}${meta}
      </div>`;
  }

  _treeHtml(items, locale, t) {
    const { roots, children } = buildTree(items);
    const node = (d, isRoot) => `
      <li>${isRoot ? "" : this._link(d, locale, t)}${this._tile(d, locale, t)}
        ${children[d.id] ? `<ul>${children[d.id].map((c) => node(c, false)).join("")}</ul>` : ""}
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
        ${header}${body}${legend}
      </ha-card>`;

    // Bild-Fallback ohne Inline-Handler
    this.shadowRoot.querySelectorAll(".img img").forEach((img) => {
      img.addEventListener("error", () => {
        img.hidden = true;
        const fb = img.nextElementSibling;
        if (fb) fb.hidden = false;
      });
    });

    const open = (el) => {
      const d = this._devices.find((x) => x.id === el.dataset.id);
      const entityId = d && (d.entityIds.find((e) => e.startsWith("device_tracker.")) || d.entityIds[0]);
      if (entityId) {
        const ev = new Event("hass-more-info", { bubbles: true, composed: true });
        ev.detail = { entityId };
        this.dispatchEvent(ev);
      }
    };
    this.shadowRoot.querySelectorAll(".tile").forEach((el) => {
      el.addEventListener("click", () => open(el));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(el);
        }
      });
    });
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
