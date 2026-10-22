// Runs every pgTAP file in supabase/tests against the linked project through `supabase db query`.
// `supabase test db --linked` needs Docker; this does not. Each file wraps itself in begin … rollback and ends by
// selecting its TAP output as one `tap` column (the Management API returns only the last result set).
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = "supabase/tests"
// `--dry`: prepend every migration inside the test's transaction, so unpushed migrations can be tried and rolled
// back without touching the linked database.
const dry = process.argv.includes("--dry")
function query(sql) {
  const out = execFileSync(
    "pnpm",
    [
      "exec",
      "supabase",
      "db",
      "query",
      "--linked",
      JSON.stringify(sql),
      "--output-format",
      "json",
    ],
    { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] }
  )
  return JSON.parse(out.slice(out.indexOf("{"))).rows ?? []
}
// Only migrations the linked database has not applied yet.
const applied = dry
  ? new Set(
      query("select version from supabase_migrations.schema_migrations").map(
        (r) => r.version
      )
    )
  : new Set()
const migrations = dry
  ? readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql") && !applied.has(f.split("_")[0]))
      .sort()
      .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
      .join("\n")
  : ""
const tmp = dry ? mkdtempSync(join(tmpdir(), "spark-db-")) : ""
function source(file) {
  if (!dry) return `${dir}/${file}`
  const body = readFileSync(`${dir}/${file}`, "utf8")
    .replace(/^begin;/m, "")
    .replace(/rollback;\s*$/m, "")
  const path = join(tmp, file)
  writeFileSync(path, `begin;\n${migrations}\n${body}\nrollback;\n`)
  return path
}
let failed = 0
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith(".test.sql"))
  .sort()) {
  let tap = ""
  let error = ""
  try {
    const out = execFileSync(
      "pnpm",
      [
        "exec",
        "supabase",
        "db",
        "query",
        "--linked",
        "-f",
        source(file),
        "--output-format",
        "json",
      ],
      { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] }
    )
    const json = JSON.parse(out.slice(out.indexOf("{")))
    tap = json.rows?.[0]?.tap ?? ""
    if (!tap) error = out
  } catch (e) {
    error = String(e.stdout || e.message)
  }
  const bad = tap
    .split("\n")
    .filter((l) => l.startsWith("not ok") || l.includes("Looks like"))
  if (error || bad.length) {
    failed++
    console.log(`FAIL ${file}`)
    const lines = tap.split("\n")
    for (const l of bad) {
      const i = lines.indexOf(l)
      console.log("  " + lines.slice(i, i + 4).join("\n  "))
    }
    if (error)
      console.log(
        "  " + (error.match(/ERROR[^"]*/)?.[0] ?? error.slice(0, 300))
      )
  } else {
    console.log(
      `PASS ${file} (${tap.split("\n").filter((l) => l.startsWith("ok")).length} ok)`
    )
  }
}
process.exit(failed ? 1 : 0)
