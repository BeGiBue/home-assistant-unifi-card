import { localize } from "./localize.js";
import { collectUnifiDevices, typeOf, TYPE_ORDER, buildAutoDeviceEntries, detectLatency, detectWan, mergeLatencyEntries } from "./utils.js";

/**
 * Visueller Editor auf Basis von <ha-form>: alle Einstellungen laufen über
 * native Home-Assistant-Selektoren (Geräte-, Entitäts-, Farb-, Objekt-Selektor).
 */
class UnifiNetworkCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._form = null;
    this._lang = null;
    this._emitted = null;
  }

  connectedCallback() {
    // Der Dialog von Home Assistant scrollt selbst; der Editor darf keine eigene Höhe erzwingen.
    this.style.display = "block";
  }

  setConfig(config) {
    // Echo der eigenen Änderung (config-changed -> setConfig) ignorieren,
    // sonst wird das Formular neu aufgebaut und springt an den Anfang.
    if (this._emitted && JSON.stringify(config) === this._emitted) {
      this._config = { ...config };
      return;
    }
    this._config = { ...config };
    this._sync(true);
  }

  set hass(hass) {
    this._hass = hass;
    this._sync(false);
  }

  /**
   * Die Geräteauswahl als Dropdown mit eigener Beschriftung. Der HA-Geräte-Selektor zeigt seine
   * Beschriftung im leeren Zustand nicht an, zwei davon wären nicht zu unterscheiden.
   */
  _deviceOptions() {
    const { list } = collectUnifiDevices(this._hass, this._config.config_entry);
    return list
      .map((d) => ({
        value: d.id,
        label: `${d.name_by_user || d.name || d.model}${d.model ? ` (${d.model})` : ""}`,
        rank: TYPE_ORDER.indexOf(typeOf(d.model || "")),
      }))
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
      .map(({ value, label }) => ({ value, label }));
  }

  _schema() {
    const t = localize(this._hass);
    const deviceOptions = this._deviceOptions();
    const linkTypes = [
      { value: "none", label: t("e_link_none") },
      { value: "lan", label: t("link_lan") },
      { value: "wifi", label: t("link_wifi") },
    ];
    this._deviceSig = JSON.stringify(deviceOptions);
    return [
      { name: "title", selector: { text: {} } },
      { name: "config_entry", selector: { config_entry: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          {
            name: "layout",
            selector: {
              select: {
                mode: "dropdown",
                options: [
                  { value: "tree", label: t("e_layout_tree") },
                  { value: "grid", label: t("e_layout_grid") },
                ],
              },
            },
          },
          { name: "show_offline", selector: { boolean: {} } },
          { name: "show_flows", selector: { boolean: {} } },
          { name: "animate_flows", selector: { boolean: {} } },
          { name: "show_summary", selector: { boolean: {} } },
          { name: "show_legend", selector: { boolean: {} } },
          { name: "show_clients", selector: { boolean: {} } },
          { name: "show_restart", selector: { boolean: {} } },
          { name: "show_latency", selector: { boolean: {} } },
          { name: "show_wan", selector: { boolean: {} } },
          { name: "swap_port_direction", selector: { boolean: {} } },
          { name: "auto_parent", selector: { boolean: {} } },
          { name: "managed", selector: { boolean: {} } },
        ],
      },
      {
        type: "expandable",
        name: "",
        title: t("e_colors"),
        schema: [
          {
            type: "grid",
            name: "",
            schema: [
              { name: "poe_color", selector: { ui_color: {} } },
              { name: "down_color", selector: { ui_color: {} } },
              { name: "up_color", selector: { ui_color: {} } },
            ],
          },
        ],
      },
      {
        type: "expandable",
        name: "",
        title: t("e_images"),
        schema: [{ name: "image_base", selector: { text: {} } }],
      },
      { name: "wan_down_entity", selector: { entity: { filter: { domain: "sensor" } } } },
      { name: "wan_up_entity", selector: { entity: { filter: { domain: "sensor" } } } },
      { name: "latency_hours", selector: { number: { min: 1, max: 168, unit_of_measurement: "h", mode: "box" } } },
      {
        name: "latency_entities",
        selector: {
          object: {
            multiple: true,
            label_field: "name",
            description_field: "entity",
            fields: {
              entity: { label: t("e_latency_entity"), required: true, selector: { entity: { filter: { domain: "sensor" } } } },
              name: { label: t("e_latency_name"), selector: { text: {} } },
              icon: { label: t("e_latency_icon"), selector: { icon: {} } },
            },
          },
        },
      },
      {
        name: "devices",
        selector: {
          object: {
            multiple: true,
            label_field: "name",
            description_field: "device",
            fields: {
              device: { label: t("e_device"), required: true, selector: { select: { mode: "dropdown", options: deviceOptions } } },
              parent: { label: t("e_parent"), selector: { select: { mode: "dropdown", options: deviceOptions } } },
              name: { label: t("e_name"), selector: { text: {} } },
              image: { label: t("e_image"), selector: { text: {} } },
              switch_port: { label: t("e_switch_port"), selector: { text: {} } },
              poe_entity: {
                label: t("e_poe_entity"),
                selector: { entity: { filter: { domain: "sensor", device_class: "power" } } },
              },
              down_entity: {
                label: t("e_down_entity"),
                selector: { entity: { filter: { domain: "sensor", device_class: "data_rate" } } },
              },
              up_entity: {
                label: t("e_up_entity"),
                selector: { entity: { filter: { domain: "sensor", device_class: "data_rate" } } },
              },
              poe_budget: { label: t("e_poe_budget"), selector: { number: { min: 0, max: 5000, unit_of_measurement: "W", mode: "box" } } },
              link_type: { label: t("e_link_type"), selector: { select: { mode: "dropdown", options: linkTypes } } },
              restart_entity: { label: t("e_restart_entity"), selector: { entity: { filter: { domain: "button" } } } },
              ip: { label: t("e_ip"), selector: { text: {} } },
              poe_switch_entity: { label: t("e_poe_switch"), selector: { entity: { filter: { domain: "switch" } } } },
              poe_cycle_entity: { label: t("e_poe_cycle"), selector: { entity: { filter: { domain: "button" } } } },
              clients_entity: {
                label: t("e_clients_entity"),
                selector: { entity: { filter: { domain: "sensor" } } },
              },
            },
          },
        },
      },
      {
        name: "external_devices",
        selector: {
          object: {
            multiple: true,
            label_field: "name",
            description_field: "model",
            fields: {
              name: { label: t("e_ext_name"), required: true, selector: { text: {} } },
              model: { label: t("e_ext_model"), selector: { text: {} } },
              icon: { label: t("e_ext_icon"), selector: { icon: {} } },
              image: { label: t("e_image"), selector: { text: {} } },
              parent: { label: t("e_parent"), selector: { select: { mode: "dropdown", options: deviceOptions } } },
              switch_port: { label: t("e_switch_port"), selector: { text: {} } },
              link_type: { label: t("e_link_type"), selector: { select: { mode: "dropdown", options: linkTypes } } },
              entity: { label: t("e_ext_entity"), selector: { entity: {} } },
              restart_entity: { label: t("e_restart_entity"), selector: { entity: { filter: { domain: "button" } } } },
              ip: { label: t("e_ip"), selector: { text: {} } },
              poe_switch_entity: { label: t("e_poe_switch"), selector: { entity: { filter: { domain: "switch" } } } },
              poe_cycle_entity: { label: t("e_poe_cycle"), selector: { entity: { filter: { domain: "button" } } } },
              poe_entity: {
                label: t("e_poe_entity"),
                selector: { entity: { filter: { domain: "sensor", device_class: "power" } } },
              },
              down_entity: {
                label: t("e_down_entity"),
                selector: { entity: { filter: { domain: "sensor", device_class: "data_rate" } } },
              },
              up_entity: {
                label: t("e_up_entity"),
                selector: { entity: { filter: { domain: "sensor", device_class: "data_rate" } } },
              },
              parent2: { label: t("e_parent2"), selector: { select: { mode: "dropdown", options: deviceOptions } } },
              switch_port2: { label: t("e_port2"), selector: { text: {} } },
              link_type2: { label: t("e_link_type2"), selector: { select: { mode: "dropdown", options: linkTypes } } },
              down_entity2: {
                label: t("e_down2"),
                selector: { entity: { filter: { domain: "sensor", device_class: "data_rate" } } },
              },
              up_entity2: {
                label: t("e_up2"),
                selector: { entity: { filter: { domain: "sensor", device_class: "data_rate" } } },
              },
            },
          },
        },
      },
    ];
  }

  _label = (schema) => {
    const t = localize(this._hass);
    const key = {
      title: "e_title",
      config_entry: "e_config_entry",
      layout: "e_layout",
      show_offline: "e_show_offline",
      show_flows: "e_show_flows",
      animate_flows: "e_animate",
      show_summary: "e_show_summary",
      show_legend: "e_show_legend",
      auto_parent: "e_auto_parent",
      poe_color: "e_poe_color",
      down_color: "e_down_color",
      up_color: "e_up_color",
      image_base: "e_image_base",
      devices: "e_devices",
      external_devices: "e_external",
      show_clients: "e_show_clients",
      show_restart: "e_show_restart",
      show_latency: "e_show_latency",
      latency_entities: "e_latency",
      latency_hours: "e_latency_hours",
      show_wan: "e_show_wan",
      swap_port_direction: "e_swap",
      managed: "e_managed",
      wan_down_entity: "e_wan_down",
      wan_up_entity: "e_wan_up",
    }[schema.name];
    return key ? t(key) : schema.name;
  };

  /** Automatische Erkennung: Einträge für alle UniFi-Geräte, Ping- und WAN-Sensoren anlegen bzw. aktualisieren.
   *  Manuelle Werte bleiben unverändert; gelöschte Einträge werden hier (und nur hier) wieder ergänzt. */
  _detect() {
    const t = localize(this._hass);
    const { list, byDevice } = collectUnifiDevices(this._hass, this._config.config_entry);
    const { devices, changed } = buildAutoDeviceEntries(list, byDevice, this._hass.states, this._config.devices || [], this._hass.entities);
    const defs = detectLatency(
      list.map((d) => ({ name: d.name_by_user || d.name || "", entityIds: (byDevice[d.id] || []).map((e) => e.entity_id) })),
      this._hass.states
    );
    const lat = mergeLatencyEntries(this._config.latency_entities, defs, this._hass.states, t("wan_latency"));
    const wan = detectWan(this._hass.states);
    const config = { ...this._config, managed: true };
    if (devices.length) config.devices = devices;
    if (lat.entries.length) config.latency_entities = lat.entries;
    let wanAdded = 0;
    if (!config.wan_down_entity && wan.down) (config.wan_down_entity = wan.down), wanAdded++;
    if (!config.wan_up_entity && wan.up) (config.wan_up_entity = wan.up), wanAdded++;
    return { config, count: changed + lat.added + wanAdded + (this._config.managed === true ? 0 : 1) };
  }

  _applyLinks(silent = false) {
    const t = localize(this._hass);
    const { config, count } = this._detect();
    if (JSON.stringify(config) === JSON.stringify(this._config)) {
      if (!silent) this._status.textContent = t("e_apply_none");
      return;
    }
    this._config = config;
    this._emitted = JSON.stringify(config);
    this._setData();
    this._status.textContent = silent ? "" : t("e_applied").replace("{n}", String(count));
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  _data() {
    return {
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
      ...this._config,
    };
  }

  _setData() {
    const data = this._data();
    this._form.data = data;
    if (this._formB) this._formB.data = data;
  }

  _makeForm() {
    const form = document.createElement("ha-form");
    form.computeLabel = this._label;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const config = { ...ev.detail.value };
      // leere Werte entfernen, damit die YAML sauber bleibt
      Object.keys(config).forEach((k) => {
        const v = config[k];
        if (v === "" || v === undefined || v === null || (Array.isArray(v) && v.length === 0)) delete config[k];
      });
      this._config = config;
      this._emitted = JSON.stringify(config);
      // das jeweils andere Formular auf demselben Stand halten
      const other = form === this._form ? this._formB : this._form;
      if (other) other.data = this._data();
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
    });
    return form;
  }

  _sync(dataChanged) {
    if (!this._hass) return;
    const firstTime = !this._form;
    if (firstTime) {
      // Zwei Formulare mit dem Erkennungs-Button dazwischen: Geräte/Ping oben, externe Geräte darunter
      this._form = this._makeForm();
      this._formB = this._makeForm();
      this.appendChild(this._form);
      const row = document.createElement("div");
      row.style.cssText = "margin:8px 0 16px;display:flex;flex-direction:column;gap:8px;align-items:flex-start";
      this._applyBtn = document.createElement("ha-button");
      this._applyBtn.addEventListener("click", () => this._applyLinks());
      this._status = document.createElement("div");
      this._status.style.cssText = "font-size:.85em;color:var(--secondary-text-color)";
      row.append(this._applyBtn, this._status);
      this.appendChild(row);
      this.appendChild(this._formB);
    }
    this._applyBtn.textContent = localize(this._hass)("e_apply");
    // hass wird bei jeder Zustandsänderung neu gesetzt: nur die Referenz weiterreichen.
    this._form.hass = this._hass;
    this._formB.hass = this._hass;

    // Schema nur bei Erstaufbau oder Sprachwechsel neu setzen. Ein neues Schema-Array
    // lässt ha-form alles neu rendern (Scroll-Position und aufgeklappte Bereiche gehen verloren).
    const lang = this._hass.locale?.language || this._hass.language;
    // Auch neu setzen, wenn sich die Geräteliste ändert (selten) – nicht bei jedem Zustands-Update.
    const devicesChanged = this._devRef !== this._hass.devices && JSON.stringify(this._deviceOptions()) !== this._deviceSig;
    this._devRef = this._hass.devices;
    if (firstTime || lang !== this._lang || devicesChanged) {
      this._lang = lang;
      const schema = this._schema();
      this._form.schema = schema.slice(0, -1);
      this._formB.schema = schema.slice(-1);
    }
    if (firstTime || dataChanged) this._setData();

    // Neue Karte (noch nichts konfiguriert): Erkennung einmal automatisch ausführen
    if (firstTime && !this._config.managed && !(this._config.devices || []).length && !(this._config.latency_entities || []).length) {
      Promise.resolve().then(() => this._applyLinks(true));
    }
  }
}

if (!customElements.get("unifi-network-card-editor")) {
  customElements.define("unifi-network-card-editor", UnifiNetworkCardEditor);
}
