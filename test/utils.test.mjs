import test from "node:test";
import assert from "node:assert/strict";
import {
  typeOf,
  toMbit,
  formatRate,
  formatPower,
  findPortEntity,
  numericState,
  resolveColor,
  buildTree,
} from "../src/utils.js";

test("typeOf erkennt UniFi-Modelle", () => {
  assert.equal(typeOf("UDM-Pro"), "gateway");
  assert.equal(typeOf("UDR"), "gateway");
  assert.equal(typeOf("USW-Pro-24-PoE"), "switch");
  assert.equal(typeOf("US-8-150W"), "switch");
  assert.equal(typeOf("U6-Pro"), "ap");
  assert.equal(typeOf("U7-Pro"), "ap");
  assert.equal(typeOf("UVC-G4-Doorbell"), "camera");
  assert.equal(typeOf("UP-Phone"), "phone");
  assert.equal(typeOf("Irgendwas"), "other");
  assert.equal(typeOf(), "other");
});

test("toMbit rechnet Einheiten um", () => {
  assert.equal(toMbit(10, "Mbit/s"), 10);
  assert.equal(toMbit(1, "Gbit/s"), 1000);
  assert.equal(toMbit(500, "kbit/s"), 0.5);
  assert.equal(toMbit(1, "MB/s"), 8);
  assert.equal(toMbit("abc"), null);
});

test("formatRate / formatPower", () => {
  assert.equal(formatRate(null), "–");
  assert.equal(formatRate(0.25, "en"), "250 kb/s");
  assert.equal(formatRate(12.34, "en"), "12.3 Mb/s");
  assert.equal(formatRate(212.4, "en"), "212 Mb/s");
  assert.equal(formatRate(1500, "en"), "1.5 Gb/s");
  assert.equal(formatPower(8.94, "en"), "8.9 W");
  assert.equal(formatPower(undefined), "–");
});

const states = [
  { entity_id: "sensor.switch_port_5_poe_power", attributes: { friendly_name: "Switch Port 5 PoE Power", device_class: "power" } },
  { entity_id: "sensor.switch_port_5_rx", attributes: { friendly_name: "Switch Port 5 RX", device_class: "data_rate" } },
  { entity_id: "sensor.switch_port_5_tx", attributes: { friendly_name: "Switch Port 5 TX", device_class: "data_rate" } },
  { entity_id: "sensor.switch_port_15_poe_power", attributes: { friendly_name: "Switch Port 15 PoE Power", device_class: "power" } },
];

test("findPortEntity findet Port-Sensoren und verwechselt 5 nicht mit 15", () => {
  assert.equal(findPortEntity(states, 5, "poe").entity_id, "sensor.switch_port_5_poe_power");
  assert.equal(findPortEntity(states, 5, "rx").entity_id, "sensor.switch_port_5_rx");
  assert.equal(findPortEntity(states, 5, "tx").entity_id, "sensor.switch_port_5_tx");
  assert.equal(findPortEntity(states, 15, "poe").entity_id, "sensor.switch_port_15_poe_power");
  assert.equal(findPortEntity(states, 7, "poe"), undefined);
  assert.equal(findPortEntity(states, undefined, "poe"), undefined);
});

test("numericState", () => {
  assert.equal(numericState({ state: "12.5" }), 12.5);
  assert.equal(numericState({ state: "unavailable" }), null);
  assert.equal(numericState(undefined), null);
});

test("resolveColor", () => {
  assert.equal(resolveColor(undefined, "x"), "x");
  assert.equal(resolveColor("#ff0000", "x"), "#ff0000");
  assert.equal(resolveColor("red", "x"), "var(--red-color, x)");
  assert.equal(resolveColor([1, 2, 3], "x"), "rgb(1,2,3)");
});

test("buildTree ordnet nach Elternbeziehung", () => {
  const devs = [
    { id: "ap", name: "AP", type: "ap", parent: "sw" },
    { id: "sw", name: "SW", type: "switch", parent: "gw" },
    { id: "gw", name: "GW", type: "gateway", parent: null },
    { id: "orphan", name: "Orphan", type: "ap", parent: "missing" },
  ];
  const { roots, children } = buildTree(devs);
  assert.deepEqual(roots.map((d) => d.id), ["gw", "orphan"]);
  assert.deepEqual(children.gw.map((d) => d.id), ["sw"]);
  assert.deepEqual(children.sw.map((d) => d.id), ["ap"]);
});
