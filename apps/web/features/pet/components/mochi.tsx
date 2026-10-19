import type { Mood } from "../pet"

/**
 * Mochi, the orange loaf cat. A hand-drawn template (facing left) is stretched with the pet's size, then
 * tail, face and tangerines are drawn as overlays so they can animate on their own. Each colour is one
 * <path> of merged pixel runs (`crispEdges`). Colours are tokens (`--cat-*`, `--mikan*`); motion is the
 * `--animate-cat-*` frames, only under `motion-safe`. Pure props in, no data access.
 */

// Letters are colours: o outline, d dark stripe, m body, l light stripe, c cream, n blush.
const TEMPLATE = [
  "o.............o",
  "ono.........ono",
  ".onmo.....omno",
  ".onmmooooommno",
  ".omlldldldllmo",
  ".ommmdmdmdmmmo",
  "ommmmmmmmmmmmmoooooooo",
  "ommmmmmmmmmmmmollddllddo",
  "ommmmmmmmmmmmmollddllddloo",
  "odmmmccnccmmmdommddmmddmmdo",
  "omdmccdcdccmdmommddmmddmmdmo",
  ".ommcccccccmmommmmmmmmmmmmmmo",
  ".ommmcccccmmommmmmmmmmmmmmmmmo",
  ".ommmcccccmmmdmmmmmmmmmmmmmmmo",
  ".ommmcccccmmmdmmmmmmmmmmmmmmmo",
  ".ommmcccccmmmdmmmmmmmmmmmmmmmo",
  ".ommmcccccmmmmmmmmmmmmmmmmmmmo",
  ".omcccocccoddddddddddddddddddo",
  "..occcocccoddddddddddddddddo",
  "...oooooooooooooooooooooooo",
].map((row) => row.padEnd(32, "."))

const WIDTH = 40
const SLEEP_Z = [
  "fill-ink-3 opacity-0 motion-safe:animate-cat-z",
  "fill-ink-3 opacity-0 motion-safe:animate-cat-z-late",
  "fill-ink-3 opacity-0 motion-safe:animate-cat-z-later",
]
const TANGERINE = ["..g..", ".ooo.", "olooo", "ooooo", ".ddd."]
const HEART = [
  [1, 0],
  [3, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [2, 2],
  [3, 2],
  [2, 3],
] as const

type Point = readonly [number, number]
type Paint = Map<string, Point[]> // colour key -> pixels

const add = (paint: Paint, key: string, x: number, y: number) => {
  const list = paint.get(key)
  if (list) list.push([x, y])
  else paint.set(key, [[x, y]])
}

/** Horizontal runs of equal pixels, merged into one path string per colour. */
function toPath(points: readonly Point[]): string {
  const rows = new Map<number, number[]>()
  for (const [x, y] of points) rows.set(y, [...(rows.get(y) ?? []), x])
  let d = ""
  for (const [y, xs] of rows) {
    const sorted = [...new Set(xs)].sort((a, b) => a - b)
    let start = sorted[0]!
    let prev = start
    for (const x of [...sorted.slice(1), Infinity]) {
      if (x !== prev + 1) {
        d += `M${start} ${y}h${prev - start + 1}v1h-${prev - start + 1}z`
        start = x
      }
      prev = x
    }
  }
  return d
}

const FILL: Record<string, string> = {
  o: "fill-cat-o",
  d: "fill-cat-d",
  m: "fill-cat-m",
  l: "fill-cat-l",
  c: "fill-cat-c",
  e: "fill-cat-e",
  n: "fill-cat-n",
  y: "fill-cat-y",
  leaf: "fill-leaf",
  mo: "fill-mikan",
  ml: "fill-mikan-l",
  md: "fill-mikan-d",
  z: "fill-ink-3",
}

function Layer({ paint, className }: { paint: Paint; className?: string }) {
  return (
    <g className={className}>
      {[...paint].map(([key, points]) => (
        <path key={key} d={toPath(points)} className={FILL[key]} />
      ))}
    </g>
  )
}

export function Mochi({
  name,
  fatness,
  mood,
  stage,
  fed = false,
  scale = 6,
}: {
  name: string
  /** 0..1: stretches the body (PT-3). */
  fatness: number
  mood: Mood
  /** Number of tangerines on the head (PT-3). */
  stage: number
  /** Plays the munch + heart once (PT-5). */
  fed?: boolean
  /** Pixels per sprite pixel. */
  scale?: number
}) {
  // Chubbier = longer (repeat a 4-column slice of the back) and taller (repeat a chest row).
  const extraW = Math.round(8 * fatness)
  const extraH = Math.round(2 * fatness)
  const pad = 5 * stage
  const rows = TEMPLATE.map(
    (row) =>
      row.slice(0, 21) +
      Array.from({ length: extraW }, (_, i) => row[17 + (i % 4)]).join("") +
      row.slice(21)
  )
  rows.splice(13, 0, ...Array<string>(extraH).fill(rows[13]!))
  const bodyRows = rows.length
  const floor = bodyRows - 1
  const height = pad + bodyRows + 1

  const body: Paint = new Map()
  rows.forEach((row, y) =>
    [...row.padEnd(WIDTH, ".")].forEach((ch, x) => {
      if (FILL[ch]) add(body, ch, x, y + pad)
    })
  )

  // Short tail wrapping the back half; frame a has the tip curled up, frame b has it laid flat.
  const tailX = 17 + extraW
  const tail = (flat: boolean): Paint => {
    const cells: Point[] = []
    for (let x = tailX + 2; x <= 25 + extraW; x++) {
      cells.push([x, floor - 2], [x, floor - 1])
    }
    cells.push(
      [26 + extraW, floor - 3],
      [26 + extraW, floor - 2],
      [27 + extraW, floor - 3],
      [27 + extraW, floor - 2],
      [28 + extraW, floor - 3],
      [tailX + 1, floor - 2],
      [tailX + 1, floor - 1]
    )
    cells.push(
      ...(flat
        ? ([
            [tailX, floor - 2],
            [tailX, floor - 1],
            [tailX - 1, floor - 2],
            [tailX - 1, floor - 1],
          ] as Point[])
        : ([
            [tailX, floor - 3],
            [tailX + 1, floor - 3],
            [tailX, floor - 4],
            [tailX + 1, floor - 4],
          ] as Point[]))
    )
    const taken = new Set(cells.map(([x, y]) => `${x},${y}`))
    const paint: Paint = new Map()
    const outline = new Set<string>()
    for (const [x, y] of cells) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const key = `${x + dx},${y + dy}`
        if (!taken.has(key) && y + dy <= floor && x + dx >= 0) outline.add(key)
      }
    }
    for (const key of outline) {
      const [x, y] = key.split(",").map(Number) as [number, number]
      add(paint, "o", x, y + pad)
    }
    for (const [x, y] of cells) {
      add(paint, x >= 26 + extraW || x % 3 ? "m" : "d", x, y + pad)
    }
    return paint
  }

  const dots = (
    points: readonly Point[],
    key: string,
    paint: Paint = new Map()
  ) => {
    for (const [x, y] of points) add(paint, key, x, y + pad)
    return paint
  }
  const shut = (paint: Paint = new Map()) =>
    dots(
      [
        [3, 8],
        [4, 8],
        [10, 8],
        [11, 8],
      ],
      "e",
      paint
    )

  const tangerines: Paint = new Map()
  for (let k = 0; k < stage; k++) {
    const y0 = pad - 2 - 5 * k
    TANGERINE.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch === ".") return
        const key = ch === "g" ? "leaf" : `m${ch}`
        if (y0 + ry >= 0) add(tangerines, key, 5 + rx, y0 + ry)
      })
    )
  }

  const heart: Paint = new Map()
  for (const [x, y] of HEART) add(heart, "n", x + 15, y + pad)

  const openEyes = dots(
    [
      [3, 7],
      [3, 8],
      [11, 7],
      [11, 8],
    ],
    "y"
  )
  dots(
    [
      [4, 7],
      [4, 8],
      [10, 7],
      [10, 8],
    ],
    "e",
    openEyes
  )

  const happyEyes = dots(
    [
      [3, 8],
      [4, 7],
      [5, 8],
      [9, 8],
      [10, 7],
      [11, 8],
    ],
    "e"
  )
  dots(
    [
      [3, 9],
      [11, 9],
    ],
    "n",
    happyEyes
  )

  const sleepy = mood === "sleepy"

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      width={WIDTH * scale}
      height={height * scale}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${name}, ${mood}`}
    >
      <rect
        x={2}
        y={pad + bodyRows}
        width={28 + extraW}
        height={1}
        className="fill-border"
      />
      <g className={fed ? "motion-safe:animate-cat-munch" : undefined}>
        <Layer paint={body} />
        <Layer
          paint={tail(false)}
          className={sleepy ? undefined : "motion-safe:animate-cat-tail-a"}
        />
        {sleepy ? null : (
          <Layer
            paint={tail(true)}
            className="opacity-0 motion-safe:animate-cat-tail-b"
          />
        )}
        {mood === "happy" ? <Layer paint={happyEyes} /> : null}
        {mood === "idle" ? (
          <>
            <Layer
              paint={openEyes}
              className="motion-safe:animate-cat-eye-open"
            />
            <Layer
              paint={shut()}
              className="opacity-0 motion-safe:animate-cat-eye-shut"
            />
          </>
        ) : null}
        {sleepy ? (
          <>
            <Layer paint={shut()} />
            {SLEEP_Z.map((className, i) => (
              <rect
                key={className}
                x={15 + i}
                y={pad + 3 - i}
                width={1}
                height={1}
                className={className}
              />
            ))}
          </>
        ) : null}
        <Layer paint={tangerines} />
      </g>
      {fed ? (
        <Layer
          paint={heart}
          className="opacity-0 motion-safe:animate-cat-heart"
        />
      ) : null}
    </svg>
  )
}
