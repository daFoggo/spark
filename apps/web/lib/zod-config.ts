import { z } from "zod"

/**
 * Zod probes `new Function("")` to enable its JIT parser; the probe is caught, but under our CSP
 * (no `unsafe-eval`) the browser still reports a violation in the console. Skipping the JIT costs
 * nothing at this scale. Imported by the client root so it runs before any schema is used.
 */
z.config({ jitless: true })
