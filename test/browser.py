#!/usr/bin/env python3
"""Chromium-Tests mit lokalen Home-Assistant-Attrappen; keine realen Geräteaufrufe.

  npm run build && python test/browser.py             # Prüfungen gegen dist/unifi-network-card.js
  npm run build && python test/browser.py --preview   # zusätzlich Vorschaubilder nach test/out/

Benötigt: pip install -r requirements-dev.txt  und  playwright install chromium
(oder PLAYWRIGHT_CHROMIUM_EXECUTABLE auf einen vorhandenen Chromium/Chrome setzen).
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

PAGE = """<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:14px;background:#e9edf1;font-family:Roboto,Inter,sans-serif;font-size:14px;
--primary-text-color:#141414;--secondary-text-color:#6b6f76;--primary-color:#009ac7;--success-color:#43a047;
--warning-color:#ff9800;--error-color:#e53935;--card-background-color:#fff;--divider-color:#d5d5d5;--disabled-color:#9e9e9e}
</style><div id="w"></div><script>
customElements.define('ha-card',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML=
  '<style>:host{display:block;background:#fff;border-radius:16px;border:1px solid #dfe3e8;box-sizing:border-box}</style><slot></slot>'}});
customElements.define('ha-icon',class extends HTMLElement{connectedCallback(){(this.shadowRoot||this.attachShadow({mode:'open'})).innerHTML=
  '<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}i{flex:1;border-radius:30%;background:currentColor;opacity:.55}</style><i></i>'}});

// Netz wie im README: Gateway → Switch → zwei Access Points und ein PC
window.network = () => {
  const devices = {
    gw: {id: 'gw', name: 'Gateway', manufacturer: 'Ubiquiti', model: 'UCG Ultra', sw_version: '4.4.9'},
    sw: {id: 'sw', name: 'Switch Büro', manufacturer: 'Ubiquiti', model: 'USW Lite 8 PoE', sw_version: '7.1.26', via_device_id: 'gw'},
    ap1: {id: 'ap1', name: 'AP Büro', manufacturer: 'Ubiquiti', model: 'U6 Pro', sw_version: '6.7.31', via_device_id: 'sw'},
    ap2: {id: 'ap2', name: 'AP Wohnen', manufacturer: 'Ubiquiti', model: 'U6 Lite', sw_version: '6.7.31', via_device_id: 'sw'},
  };
  const entities = {}, states = {};
  const add = (id, dev, state, attributes = {}) => {
    entities[id] = {entity_id: id, device_id: dev, platform: 'unifi'};
    states[id] = {entity_id: id, state: String(state), attributes};
  };
  for (const d of Object.keys(devices)) {
    add('device_tracker.' + d, d, 'home');
    add('button.' + d + '_restart', d, 'unknown', {device_class: 'restart'});
  }
  const port = (dev, name, n, poe, rx, tx) => {
    if (poe != null) {
      add(`sensor.${dev}_port_${n}_poe_power`, dev, poe, {friendly_name: `${name} Port ${n} PoE Power`, device_class: 'power', unit_of_measurement: 'W'});
      add(`switch.${dev}_port_${n}_poe`, dev, 'on', {friendly_name: `${name} Port ${n} PoE`});
      add(`button.${dev}_port_${n}_power_cycle`, dev, 'unknown', {friendly_name: `${name} Port ${n} Power Cycle`});
    }
    add(`sensor.${dev}_port_${n}_rx`, dev, rx, {friendly_name: `${name} Port ${n} RX`, device_class: 'data_rate', unit_of_measurement: 'Mbit/s'});
    add(`sensor.${dev}_port_${n}_tx`, dev, tx, {friendly_name: `${name} Port ${n} TX`, device_class: 'data_rate', unit_of_measurement: 'Mbit/s'});
  };
  port('gw', 'Gateway', 1, null, 8.4, 48.6);
  port('sw', 'Switch Büro', 1, 8.4, 3.1, 18.2);
  port('sw', 'Switch Büro', 2, 5.6, 1.8, 11.6);
  port('sw', 'Switch Büro', 5, null, 3.5, 18.8);
  add('sensor.sw_clients', 'sw', 3, {friendly_name: 'Switch Büro Clients'});
  add('sensor.ap1_clients', 'ap1', 8, {friendly_name: 'AP Büro Clients'});
  add('sensor.ap2_clients', 'ap2', 12, {friendly_name: 'AP Wohnen Clients'});
  for (const [id, v, u] of [['sensor.wan_down', '48.6', 'Mbit/s'], ['sensor.wan_up', '8.4', 'Mbit/s'], ['sensor.ping_cf', '12', 'ms']]) {
    states[id] = {entity_id: id, state: v, attributes: {unit_of_measurement: u, friendly_name: 'Cloudflare'}};
  }
  return {devices, entities, states};
};
window.baseConfig = () => ({
  title: 'UniFi Netzwerk',
  devices: [{device: 'gw'}, {device: 'sw', switch_port: 1, poe_budget: 52}, {device: 'ap1', switch_port: 1}, {device: 'ap2', switch_port: 2}],
  external_devices: [{name: 'PC Büro', model: 'Desktop-PC', parent: 'sw', switch_port: 5, icon: 'mdi:desktop-classic', link_type: 'lan'}],
  show_offline_external: true, wan_down_entity: 'sensor.wan_down', wan_up_entity: 'sensor.wan_up',
  latency_entities: [{entity: 'sensor.ping_cf', name: 'Cloudflare', icon: 'mdi:cloud-outline'}],
});
window.fixture = ({width = 800, config = {}, language = 'de'} = {}) => {
  const w = document.getElementById('w');
  w.replaceChildren();
  w.style.width = width + 'px';
  const net = window.network(), calls = [], events = [];
  const card = document.createElement('unifi-network-card');
  card.addEventListener('hass-more-info', (e) => events.push(e.detail.entityId));
  const mk = () => ({...net, language, locale: {language}, callService: (...a) => calls.push(a),
    callWS: async (m) => Object.fromEntries((m.entity_ids || []).map((id, k) => [id, Array.from({length: 120}, (_, i) => ({s: String(30 + 18 * Math.sin(i / 5 + k) + 10 * Math.sin(i / 1.7 + k * 2))}))]))});
  card.setConfig({...window.baseConfig(), ...config});
  w.appendChild(card);
  card.hass = mk();
  // Zustände ändern wie Home Assistant: neues hass-Objekt, neues states-Objekt, geänderte Einträge ersetzt
  const set = (changes = {}, devChanges = null) => {
    net.states = {...net.states};
    for (const [id, v] of Object.entries(changes)) {
      if (v === null) delete net.states[id];
      else net.states[id] = {...(net.states[id] || {entity_id: id, attributes: {}}), ...(typeof v === 'object' ? v : {state: String(v)})};
    }
    if (devChanges) net.devices = {...net.devices, ...devChanges};
    card.hass = mk();
  };
  return {card, calls, events, set, net};
};
</script>"""

TEST_JS = r"""
async () => {
  const results = [], check = (name, pass) => results.push({name, pass: !!pass});
  const attack = '"><img id="injected" src=x onerror="window.__injected=1"><script>window.__injected=1<\/script>&';
  const turn = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const {fixture} = window;
  const q = (card, sel) => card.shadowRoot.querySelector(sel);
  const qa = (card, sel) => [...card.shadowRoot.querySelectorAll(sel)];
  const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim();
  const tile = (card, id) => q(card, `.tile[data-id="${id}"]`);
  const clean = (root) => !root.querySelector('#injected, script') && !window.__injected &&
    ![...root.querySelectorAll('*')].some((el) => [...el.attributes].some((a) => /^on/i.test(a.name)));

  // ---- Aufbau ----
  {
    const {card} = fixture();
    await turn(50);
    check('Kopf mit Symbol und Titel, fünf Kacheln, Internet- und Ping-Felder',
      text(q(card, '.head h2')) === 'UniFi Netzwerk' && !!q(card, '.head .hchip ha-icon') && qa(card, '.tile').length === 5 && qa(card, '.pg').length === 3);
    check('Status-Pill grün, solange alle Geräte online sind', q(card, '.pill').classList.contains('ok') && text(q(card, '.pill')) === '5/5 Online');
    check('Verbindungswerte am Switch-Port', /8,4 W/.test(text(q(card, 'li li li .link .chip'))) && /18,2 Mb\/s/.test(text(q(card, 'li li li .link .chip'))));
  }

  // ---- Angleichen statt Neuaufbau ----
  {
    const {card, set} = fixture();
    await turn(50);
    const keep = {
      card: q(card, 'ha-card'), head: q(card, '.head'), tree: q(card, 'ul.tree.root'), ap: tile(card, 'ap1'), sw: tile(card, 'sw'),
      icon: q(card, '.tile[data-id="ap1"] svg'), line: q(card, 'li li li .link .fl.d'), chip: q(card, 'li li li .link .chip'),
      pg: q(card, '.pg'), spark: q(card, '.pg svg path.sl'), rs: q(card, '.tile[data-id="sw"] .rs'), bar: q(card, '.budget .bar > div'),
    };
    keep.ap.focus();
    set({'sensor.sw_port_1_rx': '7.7', 'sensor.sw_port_1_tx': '123.4', 'sensor.sw_port_1_poe_power': '9.9', 'sensor.ap1_clients': '9', 'sensor.wan_down': '51.2'});
    const now = {
      card: q(card, 'ha-card'), head: q(card, '.head'), tree: q(card, 'ul.tree.root'), ap: tile(card, 'ap1'), sw: tile(card, 'sw'),
      icon: q(card, '.tile[data-id="ap1"] svg'), line: q(card, 'li li li .link .fl.d'), chip: q(card, 'li li li .link .chip'),
      pg: q(card, '.pg'), spark: q(card, '.pg svg path.sl'), rs: q(card, '.tile[data-id="sw"] .rs'), bar: q(card, '.budget .bar > div'),
    };
    check('Neue Werte erscheinen (Rate, PoE, Clients, Internet, PoE-Budget)',
      /123 Mb\/s/.test(text(now.chip)) && /7,7 Mb\/s/.test(text(now.chip)) && /9,9 W/.test(text(now.chip)) && text(q(card, '.tile[data-id="ap1"] .cl')) === '9' &&
      /51,2 Mb\/s/.test(text(now.pg)) && /15,5 W/.test(text(q(card, '.budget .txt'))) && now.bar.style.width !== '' );
    check('Kein Neuaufbau: Hülle, Kopf, Baum, Kacheln, Symbole, Flusslinien, Verlauf und Schaltflächen bleiben dieselben Elemente',
      Object.keys(keep).every((k) => keep[k] === now[k]));
    check('Tastaturfokus bleibt nach einer Wertänderung erhalten', card.shadowRoot.activeElement === keep.ap);
    const anim = keep.line.getAnimations ? keep.line.getAnimations({subtree: true}) : [];
    check('Schnellere Rate ändert nur die Dauer der Flusslinie', keep.line.style.getPropertyValue('--dur') === '0.5s');
    set({'sensor.sw_port_1_rx': '7.7'});
    check('Unveränderte Werte lösen nichts aus', q(card, 'li li li .link .chip').firstChild === now.chip.firstChild);
    set({'device_tracker.ap2': 'not_home'});
    check('Gerät offline: Pill wird orange, Kachel ausgegraut, übrige Kacheln bleiben bestehen',
      q(card, '.pill').classList.contains('warn') && text(q(card, '.pill')) === '4/5 Online' && tile(card, 'ap2').classList.contains('off') && tile(card, 'ap1') === keep.ap);
    set({'device_tracker.ap2': 'home'});
    check('Gerät wieder online', q(card, '.pill').classList.contains('ok') && !tile(card, 'ap2').classList.contains('off'));
  }

  // ---- Dialoge und Aktionen: Handler genau einmal gebunden ----
  {
    const {card, calls, set, events} = fixture();
    await turn(50);
    for (let i = 0; i < 12; i++) set({'sensor.sw_port_1_rx': String(i)});
    const ap = tile(card, 'ap1');
    ap.click();
    check('Tippen auf ein Gerät öffnet das Info-Fenster, der Baum bleibt bestehen', !!q(card, '.dlg') && /AP Büro/.test(text(q(card, '.dlg'))) && tile(card, 'ap1') === ap);
    const dlg = q(card, '.dlg');
    set({'sensor.sw_port_1_rx': '55'});
    check('Info-Fenster bleibt bei eintreffenden Werten dasselbe Element', q(card, '.dlg') === dlg);
    q(card, '.dlg .box').click();
    check('Klick im Fenster schließt es nicht', !!q(card, '.dlg'));
    q(card, '.dlg [data-act="dev-restart"]').click();
    check('Neustart aus dem Info-Fenster fragt nach', /AP Büro/.test(text(q(card, '.dlg'))) && !!q(card, '.dlg [data-act="ok"]') && calls.length === 0);
    q(card, '.dlg [data-act="ok"]').click();
    check('Bestätigung löst genau einen Neustart aus', calls.length === 1 && calls[0][0] === 'button' && calls[0][1] === 'press' && calls[0][2].entity_id === 'button.ap1_restart' && !q(card, '.dlg'));
    q(card, '.tile[data-id="sw"] .rs').click();
    check('Neustart-Symbol öffnet nur die Rückfrage, nicht das Info-Fenster', !!q(card, '.dlg [data-act="ok"]') && !q(card, '.dlg dl.info'));
    q(card, '.dlg [data-act="cancel"]').click();
    check('Abbrechen schließt ohne Aufruf', !q(card, '.dlg') && calls.length === 1);
    tile(card, 'gw').click();
    q(card, '.dlg').click();
    check('Klick neben das Fenster schließt es', !q(card, '.dlg'));
    const link = q(card, 'li li li .link.act');
    link.click();
    check('Tippen auf eine PoE-Verbindung öffnet die PoE-Auswahl', !!q(card, '.dlg [data-act="poe-toggle"]') && !!q(card, '.dlg [data-act="poe-cycle"]'));
    q(card, '.dlg [data-act="poe-toggle"]').click();
    check('PoE aus: genau ein Aufruf an den Port-Schalter', calls.length === 2 && calls[1][0] === 'switch' && calls[1][1] === 'turn_off' && String(calls[1][2].entity_id) === 'switch.sw_port_1_poe');
    link.focus();
    link.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, composed: true}));
    q(card, '.dlg [data-act="poe-cycle"]').click();
    check('Tastatur: Enter auf der Verbindung, PoE-Neustart genau einmal', calls.length === 3 && calls[2][1] === 'press' && String(calls[2][2].entity_id) === 'button.sw_port_1_power_cycle');
    const t2 = tile(card, 'ap2');
    t2.focus();
    t2.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true, composed: true}));
    check('Tastatur: Leertaste auf einer Kachel öffnet das Info-Fenster', /AP Wohnen/.test(text(q(card, '.dlg'))));
    q(card, '.dlg [data-act="cancel"]').click();
    q(card, '.pg').click();
    check('Tippen auf ein Verlaufsfeld öffnet die Entität', events.join() === 'sensor.wan_down');
  }

  // ---- Bilder ----
  {
    const cfg = window.baseConfig();
    cfg.devices[2] = {device: 'ap1', switch_port: 1, image: 'http://127.0.0.1:9/gibt-es-nicht.png'};
    const {card, set} = fixture({config: cfg});
    await turn(500);
    check('Fehlendes Gerätebild: Symbol statt Bild', q(card, '.tile[data-id="ap1"] .img img')?.hidden === true && q(card, '.tile[data-id="ap1"] .fb')?.hidden === false);
    set({'sensor.ap1_clients': '10'});
    await turn(300);
    const img = q(card, '.tile[data-id="ap1"] .img img');
    check('Fehlendes Bild wird bei späteren Werten nicht erneut angefordert', (!img || img.hidden) && !!q(card, '.tile[data-id="ap1"] .fb:not([hidden])') && text(q(card, '.tile[data-id="ap1"] .cl')) === '10');
  }

  {
    const cfg = window.baseConfig();
    cfg.devices[2] = {device: 'ap1', switch_port: 1, image: 'http://127.0.0.1:9/gibt-es-nicht.png'};
    const {card} = fixture({config: cfg});
    await turn(500);
    card.setConfig({...cfg, title: 'Neu'});
    await turn(300);
    const img = q(card, '.tile[data-id="ap1"] .img img');
    check('Fehlendes Bild: nach geänderter Einstellung weiter das Symbol, kein leeres Bild', (!img || img.hidden) && !!q(card, '.tile[data-id="ap1"] .fb:not([hidden])'));
  }

  // ---- Angleichen ergibt dasselbe wie ein frischer Aufbau ----
  {
    const steps = [
      (set) => set({'sensor.sw_port_1_rx': '77', 'sensor.ap1_clients': '2'}),
      (set) => set({'device_tracker.sw': 'not_home'}),
      (set, card) => tile(card, 'ap2').click(),
      (set) => set({'sensor.sw_port_2_poe_power': null, 'sensor.wan_up': '0'}),
      (set, card) => q(card, '.dlg [data-act="cancel"]')?.click(),
      (set) => set({'device_tracker.sw': 'home', 'sensor.ap2_clients': null}),
      (set, card) => card.setConfig({...window.baseConfig(), layout: 'grid'}),
      (set) => set({'sensor.ping_cf': 'unavailable'}),
      (set, card) => card.setConfig({...window.baseConfig(), show_legend: false, density: 'compact'}),
      (set) => set({'sensor.sw_port_5_rx': '0', 'sensor.sw_port_5_tx': '0'}),
    ];
    const snap = (card) => { const c = q(card, 'ha-card').cloneNode(true); c.removeAttribute('data-d'); return c.innerHTML.replace(/\s+/g, ' '); };
    const a = fixture({width: 800}), w = document.getElementById('w');
    const box = document.createElement('div'); box.style.width = '800px'; document.body.appendChild(box);
    let same = true, at = -1;
    await turn(50);
    for (let i = 0; i < steps.length && same; i++) {
      steps[i](a.set, a.card);
      await turn(30);
      // Vergleichskarte mit demselben Endzustand frisch aufbauen
      const fresh = document.createElement('unifi-network-card');
      fresh.setConfig(a.card._config);
      fresh._confirm = a.card._confirm;
      box.replaceChildren(fresh);
      fresh._hist = a.card._hist; fresh._histVer = a.card._histVer; fresh._histKey = a.card._histKey; fresh._histAt = a.card._histAt;
      fresh.hass = a.card._hass;
      await turn(30);
      if (snap(a.card) !== snap(fresh)) { same = false; at = i; }
    }
    box.remove();
    check('Angeglichene Card entspricht nach jedem Schritt einer frisch aufgebauten' + (same ? '' : ' (Abweichung in Schritt ' + at + ')'), same);
  }
  {
    const w = document.getElementById('w');
    w.replaceChildren();
    const net = window.network(), early = document.createElement('unifi-network-card');
    const mk = () => ({...net, language: 'de', locale: {language: 'de'}, callService() {}});
    w.appendChild(early);
    early.hass = mk();
    early.setConfig(window.baseConfig());
    await turn(30);
    const t0 = tile(early, 'ap1');
    net.states = {...net.states, 'sensor.ap1_clients': {...net.states['sensor.ap1_clients'], state: '4'}};
    early.hass = mk();
    check('Werte vor der Einstellung gesetzt: die erste Aktualisierung baut nicht neu auf', tile(early, 'ap1') === t0 && text(q(early, '.tile[data-id="ap1"] .cl')) === '4');
    const off = fixture();
    await turn(30);
    off.set({'device_tracker.sw': 'not_home'});
    const dot = (id) => getComputedStyle(q(off.card, `.tile[data-id="${id}"] .dot`)).backgroundColor;
    check('Offline-Switch: nur sein eigener Punkt wird rot, erreichbare Geräte dahinter bleiben grün', dot('sw') !== dot('ap1') && dot('ap1') === dot('gw'));
  }

  // ---- HTML-Injection: erster Aufbau und Angleichen ----
  {
    const cfg = window.baseConfig();
    cfg.title = attack;
    cfg.external_devices = [{name: attack, model: attack, parent: 'sw', switch_port: 5, icon: attack}];
    cfg.latency_entities = [{entity: 'sensor.ping_cf', name: attack, icon: attack}];
    const {card} = fixture({config: cfg});
    await turn(50);
    check('Injection über Konfiguration bleibt Text', clean(card.shadowRoot) && text(q(card, '.head h2')).includes('<img id="injected"'));
    const {card: c2, set} = fixture();
    await turn(50);
    set({'sensor.ping_cf': {state: '12', attributes: {unit_of_measurement: attack}}, 'sensor.ap1_clients': {state: '3', attributes: {friendly_name: attack}}},
      {ap1: {id: 'ap1', name: attack, manufacturer: 'Ubiquiti', model: 'U6 Pro' + attack, sw_version: attack, via_device_id: 'sw'}});
    await turn(50);
    check('Injection über Gerätenamen, Modell, Version und Einheit bleibt beim Angleichen Text',
      clean(c2.shadowRoot) && text(q(c2, '.tile[data-id="ap1"] .name')).includes('<img id="injected"') && text(qa(c2, '.pg').at(-1)).includes('<img id="injected"'));
    tile(c2, 'ap1').click();
    check('Injection im Info-Fenster bleibt Text', clean(c2.shadowRoot) && text(q(c2, '.dlg')).includes('<img id="injected"'));
  }

  // ---- Layout ----
  for (const width of [300, 350, 480, 600, 800, 1100]) {
    const {card} = fixture({width});
    await turn(80);
    await frames();
    const hc = q(card, 'ha-card'), r = hc.getBoundingClientRect();
    const inside = qa(card, '.tile, .pg, .pill, .head h2, .hchip').every((el) => { const b = el.getBoundingClientRect(); return b.left >= r.left - .5 && b.right <= r.right + .5; });
    check(width + ' px: nichts ragt aus der Card, kein seitliches Scrollen (' + hc.dataset.d + ')', inside && hc.scrollWidth <= hc.clientWidth + 1);
    const first = q(card, '.tile');
    first.focus();
    check(width + ' px: sichtbarer Fokusrahmen auf Kacheln', !first.matches(':focus-visible') || parseFloat(getComputedStyle(first).outlineWidth) >= 2);
  }
  {
    const a = fixture({config: {layout: 'grid'}}).card;
    await turn(50);
    check('Raster-Layout rendert Gruppen mit Trennlinie', qa(a, 'h3').length >= 3 && qa(a, '.grid .tile').length === 5 && getComputedStyle(qa(a, 'h3')[0], '::after').height === '1px');
    const b = fixture({language: 'en', config: {title: undefined}}).card;
    await turn(50);
    check('Englisch, wenn Home Assistant nicht deutsch ist', /Online/.test(text(q(b, '.pill'))) && !/Netzwerk/.test(text(q(b, '.head h2'))));
    const c = fixture({config: {show_summary: false, show_legend: false, show_wan: false, show_latency: false}}).card;
    await turn(50);
    check('Zusammenfassung, Legende, Internet und Ping abschaltbar', !q(c, '.pills') && !q(c, '.legend') && !q(c, '.pg'));
    const d = fixture().card;
    d.remove();
    document.getElementById('w').appendChild(d);
    await turn(50);
    tile(d, 'gw').click();
    check('Entfernen und Wiedereinhängen: Bedienung funktioniert weiter', !!q(d, '.dlg'));
  }
  return results;
}
"""


def launch(p):
    executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
    return p.chromium.launch(**({"executable_path": executable, "args": ["--no-sandbox"]} if executable else {}))


def main():
    bundle = ROOT / "dist" / "unifi-network-card.js"
    if not bundle.exists():
        print("dist/unifi-network-card.js fehlt: zuerst `npm run build` ausführen")
        return True
    errors = []
    with sync_playwright() as p:
        browser = launch(p)

        def open_page(width, height, scale=1):
            page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=scale)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.set_content(PAGE)
            page.add_script_tag(path=str(bundle), type="module")
            page.wait_for_function("() => customElements.get('unifi-network-card')")
            return page

        page = open_page(1300, 1000)
        results = page.evaluate(TEST_JS)
        results.append({"name": "keine JavaScript-Fehler", "pass": not errors})
        if "--preview" in sys.argv:
            out = ROOT / "test" / "out"
            out.mkdir(exist_ok=True)
            for width in (350, 800):
                shot = open_page(width + 28, 400, 2)
                shot.evaluate("(width) => { window.fixture({width, config: {animate_flows: false}}); }", width)
                shot.wait_for_timeout(500)
                shot.screenshot(path=str(out / f"unifi-{width}.png"), full_page=True)
                shot.close()
        browser.close()
    for result in results:
        print(("PASS " if result["pass"] else "FAIL ") + result["name"])
    failures = sum(not result["pass"] for result in results)
    print(f"\n{len(results)} Prüfungen, {failures} Fehler")
    if errors:
        print(errors)
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
