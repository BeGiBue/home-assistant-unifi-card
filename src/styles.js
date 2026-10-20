/**
 * Alle Farben kommen aus dem aktiven Home-Assistant-Theme (CSS-Variablen).
 * Die Flussfarben lassen sich zusätzlich in der Kartenkonfiguration überschreiben.
 */
export const styles = `
  :host { display: block; }
  ha-card {
    display: block;
    position: relative;
    padding: 16px;
    overflow-x: auto;
    --unifi-line: var(--divider-color, #3a3a3a);
    /* Verbindungslinien: verbunden = Textfarbe des Themes (Schwarz im hellen Theme), offline = Grau */
    --unifi-link-on: var(--primary-text-color, #000);
    --unifi-link-off: var(--disabled-color, #9e9e9e);
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
  ul.tree, ul.tree ul { list-style: none; margin: 0; padding: 0; display: flex; justify-content: center; justify-content: safe center; align-items: flex-start; }
  ul.tree ul { padding-top: 14px; position: relative; }
  ul.tree ul::before { content: ""; position: absolute; top: 0; left: calc(50% - 1px); width: 2px; height: 14px; background: var(--unifi-link-off); }
  ul.tree ul.on::before { background: var(--unifi-link-on); }
  ul.tree li { position: relative; padding: 2px 7.5px 0; display: flex; flex-direction: column; align-items: center; }
  ul.tree.root > li { padding-top: 0; }
  ul.tree li::before, ul.tree li::after { content: ""; position: absolute; top: 0; height: 2px; width: 50%; background: var(--unifi-link-off); }
  ul.tree li.on::before, ul.tree li.on::after { background: var(--unifi-link-on); }
  ul.tree li::before { right: 50%; }
  ul.tree li::after { left: 50%; }
  ul.tree li:first-child::before, ul.tree li:last-child::after { display: none; }
  ul.tree li:only-child::before, ul.tree li:only-child::after { display: none; }
  ul.tree.root > li::before, ul.tree.root > li::after { display: none; }

  .link { position: relative; height: 56px; width: 100%; }
  .link .lines { position: absolute; top: 0; bottom: 0; display: flex; gap: 2px; justify-content: space-between; }
  .link .stem { position: absolute; top: 0; bottom: 0; left: calc(50% - 1px); width: 2px; background: var(--unifi-link-off); }
  .link .stem.on { background: var(--unifi-link-on); }
  .fl { position: relative; width: 4px; height: 100%; overflow: hidden; background: color-mix(in srgb, var(--c) 18%, transparent); }
  /* Das Muster ist 12 px höher als die Linie und wird per transform verschoben (GPU-Compositing).
     Eine background-position-Animation zeichnet den Baum dagegen in jedem Frame neu und lässt in WebKit
     (iPad/Companion App) das Scrollen der Seite springen. */
  .fl::after { content: ""; position: absolute; top: -12px; right: 0; bottom: 0; left: 0; background: repeating-linear-gradient(to bottom, var(--c) 0 6px, transparent 6px 12px); background-size: 4px 12px; will-change: transform; }
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
  @keyframes unifi-dn { from { transform: translateY(0); } to { transform: translateY(12px); } }
  @keyframes unifi-up { from { transform: translateY(12px); } to { transform: translateY(0); } }
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

  .link.act { cursor: pointer; }
  .link.act:hover .chip, .link.act:focus-visible .chip { outline: 1px solid var(--primary-color, #03a9f4); }
  .link.act:hover .stem, .link.act:hover .lines { filter: brightness(1.3); }
  .dlg .acts.col { flex-direction: column; align-items: stretch; }
  .dlg dl.info { margin: 0 0 16px; display: grid; gap: 6px; }
  .dlg dl.info > div { display: flex; justify-content: space-between; gap: 24px; font-size: .9em; }
  .dlg dl.info dt { color: var(--secondary-text-color); }
  .dlg dl.info dd { margin: 0; font-variant-numeric: tabular-nums; }
  .dlg .sub { font-size: .85em; color: var(--secondary-text-color); }

  /* ---- Schmale Displays: kompakt (7"-Display, iPad hochkant) und Liste (Handy-Breite) ---- */
  ha-card[data-d="compact"], ha-card[data-d="list"] { padding: 10px; }
  ha-card[data-d="compact"] .head h2, ha-card[data-d="list"] .head h2 { font-size: 1.1em; }
  ha-card[data-d="compact"] .head, ha-card[data-d="list"] .head { margin-bottom: 10px; }
  ha-card[data-d="compact"] .ping, ha-card[data-d="list"] .ping { grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 8px; }
  ha-card[data-d="compact"] .tile { width: 90px; min-width: 0; padding: 6px 2px; }
  ha-card[data-d="compact"] .img { width: 42px; height: 42px; margin-bottom: 4px; }
  ha-card[data-d="compact"] .img ha-icon { --mdc-icon-size: 34px; }
  ha-card[data-d="compact"] .name { font-size: .78em; }
  ha-card[data-d="compact"] .sub { font-size: .64em; }
  ha-card[data-d="compact"] ul.tree li { padding: 2px 2px 0; }
  ha-card[data-d="compact"] ul.tree ul { padding-top: 10px; }
  ha-card[data-d="compact"] ul.tree ul::before { height: 10px; }
  ha-card[data-d="compact"] .link { height: 54px; }
  /* Die Chips der Nachbarn liegen nur ~90 px auseinander: schmal halten, Werte untereinander */
  ha-card[data-d="compact"] .chip { left: calc(50% + 14px) !important; max-width: 68px; font-size: .62em; line-height: 1.25; padding: 1px 4px; white-space: normal; }
  ha-card[data-d="compact"] .chip .r { display: block; white-space: nowrap; }
  ha-card[data-d="compact"] .chip .lt { white-space: normal; }
  ha-card[data-d="compact"] .cl { font-size: .68em; margin-top: 3px; }
  ha-card[data-d="compact"] .budget .txt { font-size: .64em; }

  ha-card[data-d="list"] ul.tree, ha-card[data-d="list"] ul.tree ul { flex-direction: column; align-items: stretch; justify-content: flex-start; }
  ha-card[data-d="list"] ul.tree ul { padding-top: 0; }
  ha-card[data-d="list"] ul.tree ul::before { display: none; }
  ha-card[data-d="list"] ul.tree li { padding: 0; align-items: stretch; border-left: 2px solid var(--unifi-link-off); }
  ha-card[data-d="list"] ul.tree li.on { border-left-color: var(--unifi-link-on); }
  ha-card[data-d="list"] ul.tree.root > li { border-left: 0; }
  ha-card[data-d="list"] ul.tree li::before, ha-card[data-d="list"] ul.tree li::after { display: none; }
  ha-card[data-d="list"] ul.tree li > .tile { order: 1; }
  ha-card[data-d="list"] ul.tree li > .link { order: 2; height: auto; min-height: 0; width: auto; margin: 0 0 4px 58px; }
  ha-card[data-d="list"] ul.tree li > ul { order: 3; }
  ha-card[data-d="list"] .link .stem, ha-card[data-d="list"] .link .lines { display: none; }
  ha-card[data-d="list"] .chip { position: static; transform: none; display: inline-block; font-size: .7em; padding: 1px 6px; }
  ha-card[data-d="list"] ul.tree ul { margin-left: 10px; margin-top: 4px; }
  ha-card[data-d="list"] ul.tree li { margin-bottom: 4px; padding-left: 8px; }
  ha-card[data-d="list"] ul.tree.root > li { padding-left: 0; }
  ha-card[data-d="list"] .tile { align-content: center; width: auto; min-width: 0; display: grid; grid-template-columns: 48px minmax(0, 1fr); column-gap: 10px; align-items: center; text-align: left; padding: 6px 10px; }
  ha-card[data-d="list"] .tile > :not(.img) { grid-column: 2; min-width: 0; }
  ha-card[data-d="list"] .img { grid-row: 1 / span 6; width: 44px; height: 44px; margin: 0; }
  ha-card[data-d="list"] .img ha-icon { --mdc-icon-size: 36px; }
  ha-card[data-d="list"] .cl { justify-self: start; margin-top: 3px; }

  /* ---- Ping / Latenz ---- */
  .ping { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .pg { position: relative; overflow: hidden; cursor: pointer; border-radius: var(--ha-card-border-radius, 12px); background: var(--unifi-tile); min-height: 64px; }
  .pg:hover { filter: brightness(1.08); }
  .pg .sp { position: absolute; inset: 0; width: 100%; height: 100%; }
  .pg .sa { fill: color-mix(in srgb, var(--primary-color, #03a9f4) 16%, transparent); }
  .pg .sl { fill: none; stroke: var(--primary-color, #03a9f4); stroke-width: 1.5; opacity: .8; }
  .pg.dn .sa { fill: color-mix(in srgb, var(--unifi-down) 18%, transparent); } .pg.dn .sl { stroke: var(--unifi-down); }
  .pg.up .sa { fill: color-mix(in srgb, var(--unifi-up) 18%, transparent); } .pg.up .sl { stroke: var(--unifi-up); }
  .ar.big { font-size: 1.6em; line-height: 1; }
  .pc { position: relative; display: grid; grid-template-columns: auto 1fr; column-gap: 10px; align-items: center; padding: 10px 12px; --mdc-icon-size: 22px; }
  .pc ha-icon { grid-row: span 2; color: var(--primary-text-color); }
  .pn { font-size: .85em; font-weight: 500; color: var(--primary-text-color); }
  .pv { font-size: .8em; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
`;
