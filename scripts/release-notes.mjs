// Gibt den Abschnitt einer Version aus der CHANGELOG.md aus (für den Text des GitHub-Releases).
// Aufruf: node scripts/release-notes.mjs 1.2.3 [CHANGELOG.md]
// Beendet sich mit Fehler, wenn es keinen Abschnitt "## 1.2.3" gibt.
import { readFileSync } from "node:fs";

export function releaseNotes(changelog, version) {
  const v = String(version).replace(/^v/, "");
  const lines = changelog.split(/\r?\n/);
  const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const head = new RegExp(`^##\\s+\\[?v?${esc}\\]?(\\s|$)`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join("\n").trim();
  return body || null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [version, file = "CHANGELOG.md"] = process.argv.slice(2);
  if (!version) {
    console.error("Aufruf: node scripts/release-notes.mjs <version> [CHANGELOG.md]");
    process.exit(2);
  }
  const notes = releaseNotes(readFileSync(file, "utf8"), version);
  if (!notes) {
    console.error(`Kein Abschnitt "## ${version}" mit Inhalt in ${file}. Bitte zuerst den Changelog ergänzen.`);
    process.exit(1);
  }
  process.stdout.write(`${notes}\n`);
}
