/**
 * Gleicht den Inhalt eines Elements an neues Markup an, ohne ihn neu aufzubauen.
 *
 * Elemente, die an derselben Stelle mit demselben Tag (und derselben Kennung) wieder vorkommen, bleiben
 * bestehen; nur geänderte Attribute und Texte werden gesetzt. Dadurch bleiben Tastaturfokus, laufende
 * Animationen und geladene Bilder erhalten, und der Browser muss nur das neu zeichnen, was sich geändert hat.
 * Weicht die Struktur ab, wird ab dieser Stelle ersetzt.
 */

const KEY_ATTRS = ["data-id", "data-entity", "data-act"];

function keyOf(el) {
  for (const a of KEY_ATTRS) {
    const v = el.getAttribute(a);
    if (v !== null) return `${a}=${v}`;
  }
  return "";
}

function sameNode(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  return a.tagName === b.tagName && a.namespaceURI === b.namespaceURI && keyOf(a) === keyOf(b);
}

function syncAttributes(from, to) {
  for (const a of Array.from(from.attributes)) {
    if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
  }
  for (const a of Array.from(to.attributes)) {
    if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  }
}

function syncChildren(from, to) {
  let f = from.firstChild;
  let t = to.firstChild;
  while (t) {
    const nextT = t.nextSibling;
    if (f && sameNode(f, t)) {
      if (f.nodeType === 1) {
        syncAttributes(f, t);
        syncChildren(f, t);
      } else if (f.nodeValue !== t.nodeValue) {
        f.nodeValue = t.nodeValue;
      }
      f = f.nextSibling;
    } else if (f) {
      const nextF = f.nextSibling;
      from.replaceChild(t, f);
      f = nextF;
    } else {
      from.appendChild(t);
    }
    t = nextT;
  }
  while (f) {
    const nextF = f.nextSibling;
    from.removeChild(f);
    f = nextF;
  }
}

/**
 * Setzt `html` als Inhalt von `el`. Mit einem echten DOM wird angeglichen, sonst (Tests ohne Browser,
 * sehr alte Umgebungen) wie bisher ersetzt. Das Markup stammt aus denselben, maskierenden Vorlagen wie zuvor;
 * es wird in einem `<template>` geparst, dessen Inhalt nicht ausgeführt und nicht geladen wird.
 */
export function morphInto(el, html) {
  const doc = typeof document !== "undefined" ? document : null;
  const tpl = doc && typeof doc.createElement === "function" ? doc.createElement("template") : null;
  if (!tpl || !("content" in tpl) || !el.firstChild) {
    el.innerHTML = html;
    return;
  }
  tpl.innerHTML = html;
  syncChildren(el, tpl.content);
}
