"use client"

import { IconInfoCircle } from "@tabler/icons-react"

import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

import { HELP, type HelpKey } from "@/config/help"

/**
 * Small info button that explains a term in plain words. A popover (not a tooltip) so it works
 * on touch and with the keyboard; the copy comes from `config/help.ts`.
 */
export function InfoHint({ topic }: { topic: HelpKey }) {
  const { title, body } = HELP[topic]
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`About ${title.toLowerCase()}`}
            className="text-ink-3"
          />
        }
      >
        <IconInfoCircle aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{body}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
