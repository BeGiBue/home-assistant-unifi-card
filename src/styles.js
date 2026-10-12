/**
 * Alle Farben kommen aus dem aktiven Home-Assistant-Theme (CSS-Variablen).
 * Die Flussfarben lassen sich zusätzlich in der Kartenkonfiguration überschreiben.
 */
export const styles = `
  :host { display: block; }
  ha-card {
    position: relative;
    padding: 16px;
    overflow-x: auto;
    --unifi-line: var(--divider-color, #3a3a3a);
    --unifi-tile: var(--secondary-background-color, #262626);
    --unifi-ok: var(--success-color, #4caf50);
    --unifi-bad: var(--error-color, #f44336);
    --unifi-warn: var(--warning-color, #ff9800);
  }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .head h2 { margin: 0; font-size: 1.25em; font-weight: 500; color: var(--primary-text-color); }
  .pills { display: flex; gap: 8px; flex-wrap: wrap; font-size: .8em; }
  .pill {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 14px;
    background: color-mix(in srgb, var(--primary-text-color) 9%, var(--card-background-color, transparent));
    border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
    color: var(--primary-text-color); font-weight: 500; white-space: nowrap;
  }
  .pill svg { width: 11px; height: 11px; fill: var(--unifi-poe); }
  .msg { color: var(--secondary-text-color); padding: 16px 0; }
  h3 { font-size: .9em; margin: 16px 0 8px; color: var(--secondary-text-color); font-weight: 500; }

  .tile {
    text-align: center; cursor: pointer; padding: 10px 8px; border-radius: var(--ha-card-border-radius, 12px);
    background: var(--unifi-tile); min-width: 110px; box-sizing: border-box; width: 150px;
    color: var(--primary-text-color); transition: background .15s;
  }
  .tile:hover { background: var(--secondary-background-color); filter: brightness(1.08); }
  .tile.off { opacity: .55; }
  .img { position: relative; width: 64px; height: 64px; margin: 0 auto 6px; color: var(--primary-text-color); }
  .img img { width: 100%; height: 100%; object-fit: contain; }
  .img svg, .fb { width: 100%; height: 100%; }
  .dot { position: absolute; top: 0; right: -2px; width: 10px; height: 10px; border-radius: 50%; background: var(--unifi-ok); border: 2px solid var(--unifi-tile); }
  .off .dot { background: var(--unifi-bad); }
  .upd { position: absolute; bottom: -2px; right: -4px; width: 18px; height: 18px; border-radius: 50%; background: var(--unifi-warn); display: flex; align-items: center; justify-content: center; }
  .upd svg { width: 12px; height: 12px; stroke: var(--text-primary-color, #fff); }
  .name { font-size: .85em; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: .72em; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile.ext { border: 1px dashed var(--unifi-line); }
  .tile.ghost { opacity: .85; }
  .chip .lt { display: inline-block; font-size: .85em; font-weight: 700; padding: 0 6px; border-radius: 6px; margin-bottom: 2px; background: color-mix(in srgb, var(--primary-color, #03a9f4) 22%, transparent); }
  .img ha-icon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; --mdc-icon-size: 52px; }
  .cl { margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; font-size: .75em; font-weight: 500; padding: 1px 8px; border-radius: 10px; color: var(--primary-text-color); background: color-mix(in srgb, var(--primary-text-color) 9%, transparent); }
  .cl svg { width: 12px; height: 12px; fill: var(--secondary-text-color); }
  .budget { margin-top: 8px; }
  .budget .bar { height: 4px; border-radius: 2px; background: var(--unifi-line); overflow: hidden; }
  .budget .bar > div { height: 100%; background: var(--unifi-poe); }
  .budget .txt { margin-top: 4px; font-size: .72em; color: var(--primary-text-color); }
  .meta { margin-top: 6px; font-size: .72em; line-height: 1.4; }

  /* Text bleibt gut lesbar (Primärfarbe); nur Symbole tragen die Flussfarbe */
  .ar { font-weight: 700; }
  .ar.down { color: var(--unifi-down); }
  .ar.up { color: var(--unifi-up); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; justify-items: center; }

  /* ---- Baum ---- */
  ul.tree, ul.tree ul { list-style: none; margin: 0; padding: 0; display: flex; justify-content: center; align-items: flex-start; }
  ul.tree ul { padding-top: 14px; position: relative; }
  ul.tree ul::before { content: ""; position: absolute; top: 0; left: calc(50% - 1px); width: 2px; height: 14px; background: var(--unifi-line); }
  ul.tree li { position: relative; padding: 2px 5px 0; display: flex; flex-direction: column; align-items: center; }
  ul.tree.root > li { padding-top: 0; }
  ul.tree li::before, ul.tree li::after { content: ""; position: absolute; top: 0; height: 2px; width: 50%; background: var(--unifi-line); }
  ul.tree li::before { right: 50%; }
  ul.tree li::after { left: 50%; }
  ul.tree li:first-child::before, ul.tree li:last-child::after { display: none; }
  ul.tree li:only-child::before, ul.tree li:only-child::after { display: none; }
  ul.tree.root > li::before, ul.tree.root > li::after { display: none; }

  .link { position: relative; height: 56px; width: 100%; }
  .link .lines { position: absolute; top: 0; bottom: 0; display: flex; gap: 2px; justify-content: space-between; }
  .link .stem { position: absolute; top: 0; bottom: 0; left: calc(50% - 1px); width: 2px; background: var(--unifi-line); }
  .fl { position: relative; width: 4px; height: 100%; overflow: hidden; background: color-mix(in srgb, var(--c) 18%, transparent); }
  .fl::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(to bottom, var(--c) 0 6px, transparent 6px 12px); background-size: 4px 12px; }
  .fl.idle::after { display: none; }
  .anim .fl.dn::after { animation: unifi-dn var(--dur, 1s) linear infinite; }
  .anim .fl.upw::after { animation: unifi-up var(--dur, 1s) linear infinite; }
  .fl.p { --c: var(--unifi-poe); }
  .fl.d { --c: var(--unifi-down); }
  .fl.u { --c: var(--unifi-up); }
  .chip {
    position: absolute; top: 50%; transform: translateY(-50%); font-size: .75em; line-height: 1.35; white-space: nowrap;
    padding: 2px 7px; border-radius: 8px; font-weight: 500; color: var(--primary-text-color);
    background: color-mix(in srgb, var(--card-background-color, #fff) 82%, transparent);
  }
  .chip .poe svg, .meta .poe svg { fill: var(--unifi-poe); }
  .chip .off { color: var(--secondary-text-color); }
  .chip svg, .meta svg { width: 10px; height: 10px; vertical-align: -1px; }
  @keyframes unifi-dn { from { background-position: 0 0; } to { background-position: 0 12px; } }
  @keyframes unifi-up { from { background-position: 0 12px; } to { background-position: 0 0; } }
  @media (prefers-reduced-motion: reduce) { .anim .fl::after { animation: none !important; } }

  .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 16px; font-size: .75em; color: var(--secondary-text-color); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { display: inline-block; width: 4px; height: 12px; }

  /* ---- Neustart ---- */
  .rs {
    position: absolute; top: -4px; left: -8px; width: 22px; height: 22px; padding: 0; border-radius: 50%; cursor: pointer;
    display: flex; align-items: center; justify-content: center; --mdc-icon-size: 14px;
    border: 1px solid var(--unifi-line); background: var(--card-background-color, #fff); color: var(--secondary-text-color);
  }
  .rs:hover, .rs:focus-visible { color: var(--error-color, #f44336); border-color: var(--error-color, #f44336); }
  .dlg { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; padding: 16px;
    background: color-mix(in srgb, var(--card-background-color, #000) 70%, transparent); border-radius: inherit; }
  .dlg .box { background: var(--card-background-color, #fff); color: var(--primary-text-color); border: 1px solid var(--unifi-line);
    border-radius: 12px; padding: 16px 20px; max-width: 320px; box-shadow: 0 4px 24px rgba(0,0,0,.35); }
  .dlg p { margin: 0 0 16px; }
  .dlg .acts { display: flex; justify-content: flex-end; gap: 8px; }
  .dlg button { font: inherit; cursor: pointer; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--unifi-line);
    background: transparent; color: var(--primary-text-color); }
  .dlg button.danger { background: var(--error-color, #f44336); border-color: var(--error-color, #f44336); color: var(--text-primary-color, #fff); }

  /* ---- Ping / Latenz ---- */
  .ping { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .pg { position: relative; overflow: hidden; cursor: pointer; border-radius: var(--ha-card-border-radius, 12px); background: var(--unifi-tile); min-height: 64px; }
  .pg:hover { filter: brightness(1.08); }
  .pg .sp { position: absolute; inset: 0; width: 100%; height: 100%; }
  .pg .sa { fill: color-mix(in srgb, var(--primary-color, #03a9f4) 16%, transparent); }
  .pg .sl { fill: none; stroke: var(--primary-color, #03a9f4); stroke-width: 1.5; opacity: .8; }
  .pc { position: relative; display: grid; grid-template-columns: auto 1fr; column-gap: 10px; align-items: center; padding: 10px 12px; --mdc-icon-size: 22px; }
  .pc ha-icon { grid-row: span 2; color: var(--primary-text-color); }
  .pn { font-size: .85em; font-weight: 500; color: var(--primary-text-color); }
  .pv { font-size: .8em; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
`;
