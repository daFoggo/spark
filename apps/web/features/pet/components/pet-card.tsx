"use client"

import { useState } from "react"

import type { PetState } from "../pet"
import { Mochi } from "./mochi"

const SAYS = {
  happy: (name: string) => `${name} is happy. You showed up today.`,
  idle: (name: string) => `${name} is waiting for today's treat.`,
  sleepy: (name: string) =>
    `${name} is napping. Do one small thing to wake them up.`,
} as const

/**
 * The pet on Today. Stats come in as props (the page reads them from habits and activities).
 * When treats go up between renders the sprite remounts and plays the munch and heart once (PT-5).
 */
export function PetCard({ name, state }: { name: string; state: PetState }) {
  const [seen, setSeen] = useState(state.treats)
  const [fedKey, setFedKey] = useState(0)
  if (state.treats !== seen) {
    setSeen(state.treats)
    if (state.treats > seen) setFedKey((key) => key + 1)
  }

  return (
    <div className="flex flex-col gap-2">
      <Mochi
        key={fedKey}
        name={name}
        fatness={state.fatness}
        mood={state.mood}
        stage={state.stage}
        fed={fedKey > 0}
        scale={4}
      />
      <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">
        {name} · {state.stageName} · {state.treats}{" "}
        {state.treats === 1 ? "treat" : "treats"}
      </span>
      <p className="text-ink-2">{SAYS[state.mood](name)}</p>
      {state.untilNext !== null ? (
        <p className="text-xs text-ink-3">
          {state.untilNext} more to {state.nextName}
        </p>
      ) : null}
    </div>
  )
}
