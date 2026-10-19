"use client"

import { useActionState } from "react"
import { IconCircleCheck } from "@tabler/icons-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"

import { signUpAction } from "../actions"
import { FormError } from "./form-error"
import { PasswordInput } from "./password-input"

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, {})

  if (state.confirmEmail) {
    return (
      <Alert variant="success">
        <IconCircleCheck />
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          We sent a confirmation link. Confirm your email, then sign in.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          defaultValue={state.values?.name}
          placeholder="Your name"
          required
          maxLength={255}
          disabled={pending}
        />
      </div>
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
          autoComplete="new-password"
          placeholder="••••••••"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">At least 6 characters</p>
      </div>
      <Button
        type="submit"
        size="lg"
        className="mt-2 w-full"
        disabled={pending}
      >
        {pending ? (
          <>
            <Spinner className="mr-2" />
            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </Button>
    </form>
  )
}
