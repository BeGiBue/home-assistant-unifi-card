import { localize } from "./localize.js";

/**
 * Visueller Editor auf Basis von <ha-form>: alle Einstellungen laufen über
 * native Home-Assistant-Selektoren (Geräte-, Entitäts-, Farb-, Objekt-Selektor).
 */
class UnifiNetworkCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._form = null;
  }

  setConfig(config) {
    this._config = { ...config };
    this._sync();
  }

  set hass(hass) {
    this._hass = hass;
    this._sync();
  }

  _schema() {
    const t = localize(this._hass);
    return [
      { name: "title", selector: { text: {} } },
      { name: "config_entry", selector: { config_entry: { integration: "unifi" } } },
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
      {
        name: "devices",
        selector: {
          object: {
            multiple: true,
            label_field: "name",
            description_field: "device",
            fields: {
              device: { label: t("e_device"), required: true, selector: { device: { integration: "unifi" } } },
              name: { label: t("e_name"), selector: { text: {} } },
              image: { label: t("e_image"), selector: { text: {} } },
              switch_port: { label: t("e_switch_port"), selector: { number: { min: 1, max: 100, mode: "box" } } },
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
      poe_color: "e_poe_color",
      down_color: "e_down_color",
      up_color: "e_up_color",
      image_base: "e_image_base",
      devices: "e_devices",
    }[schema.name];
    return key ? t(key) : schema.name;
  };

  _sync() {
    if (!this._hass) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = this._label;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        // leere Werte entfernen, damit die YAML sauber bleibt
        Object.keys(config).forEach((k) => {
          const v = config[k];
          if (v === "" || v === undefined || v === null || (Array.isArray(v) && v.length === 0)) delete config[k];
        });
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = {
      layout: "tree",
      show_offline: true,
      show_flows: true,
      animate_flows: true,
      show_summary: true,
      show_legend: true,
      ...this._config,
    };
  }
}

if (!customElements.get("unifi-network-card-editor")) {
  customElements.define("unifi-network-card-editor", UnifiNetworkCardEditor);
}
