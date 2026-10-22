// Deletes the users the e2e suite signs up (`*@example.test`) from the linked project. Their rows in `public`
// go with them (foreign keys cascade). Real users never use the reserved .test TLD.
import { execFileSync } from "node:child_process"

const sql =
  "delete from auth.users where email like '%@example.test' returning id"
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
const rows = JSON.parse(out.slice(out.indexOf("{"))).rows ?? []
console.log(`Deleted ${rows.length} e2e test user(s)`)
