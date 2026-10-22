"use client"

import { useActionState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"

import { signInAction } from "../actions"
import { FormError } from "./form-error"
import { PasswordInput } from "./password-input"

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, {})

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          placeholder="you@example.com"
          required
          disabled={pending}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          disabled={pending}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="mt-2 w-full"
        disabled={pending}
      >
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  )
}
