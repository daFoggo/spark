"use client"

import { useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

import { closeChapterAction } from "../actions"

/**
 * "Close this chapter" (CH-1, CH-2): name what you just finished and keep going. The database needs at
 * least one activity in the chapter and tells us when there is none.
 */
export function ChapterClose({ goalId }: { goalId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(undefined)
    startTransition(async () => {
      const result = await closeChapterAction({ goalId, title })
      if (result.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      setTitle("")
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        Close this chapter
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <DialogHeader>
              <DialogTitle>Close this chapter</DialogTitle>
              <DialogDescription>
                No finish line needed. Name what you just finished and keep
                going.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="chapter-title">Chapter name</FieldLabel>
              <Input
                id="chapter-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Foundations"
                maxLength={120}
                required
              />
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !title.trim()}>
                {pending ? <Spinner /> : null}
                Close chapter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
