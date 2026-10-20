import type { Metadata } from "next"
import { Suspense } from "react"

import { SIGN_UP_PATH } from "@/config/routes"
import { FormError } from "@/features/auth/components/form-error"
import { SignInForm } from "@/features/auth/components/sign-in-form"

import {
  AuthAside,
  AuthBody,
  AuthHeader,
  AuthHeading,
  AuthMain,
  AuthPitch,
  AuthSwitch,
} from "../_components/auth-frame"
import { MochiNote } from "../_components/mochi-note"
import {
  Terminal,
  TerminalCommand,
  TerminalOutput,
  TerminalPrompt,
} from "../_components/terminal"

export const metadata: Metadata = { title: "Sign in" }

async function OAuthError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  if (!error) return null
  return (
    <FormError message="Sign-in with the provider failed. Please try again." />
  )
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <>
      <AuthAside>
        <AuthPitch title="Pick up where you left off.">
          Your goals, habits and tasks are one sign-in away.
        </AuthPitch>
        <Terminal title="spark today">
          <TerminalCommand step={0}>today</TerminalCommand>
          <TerminalOutput step={1} label="goal" tone="muted">
            I&apos;m becoming a reader
          </TerminalOutput>
          <TerminalOutput step={2} label="habit" tone="ok">
            Read one page, 4 in a row
          </TerminalOutput>
          <TerminalOutput step={3} label="task" tone="muted">
            Pick the next book
          </TerminalOutput>
          <TerminalOutput step={4} label="session" tone="focus">
            waiting for you
          </TerminalOutput>
          <TerminalPrompt step={5} />
        </Terminal>
        <MochiNote>
          Mochi waits with your streak. It never gets sick or hungry.
        </MochiNote>
      </AuthAside>
      <AuthMain>
        <AuthHeader>
          <AuthSwitch prompt="No account?" href={SIGN_UP_PATH}>
            Sign up
          </AuthSwitch>
        </AuthHeader>
        <AuthBody>
          <AuthHeading eyebrow="Sign in" title="Welcome back">
            Sign in to your account.
          </AuthHeading>
          <div className="flex flex-col gap-4">
            <Suspense>
              <OAuthError searchParams={searchParams} />
            </Suspense>
            <SignInForm />
            {/* Google is disabled for now. Enable the provider in Supabase, then render `<GoogleSignInButton />` when `authConfig.AUTH_PROVIDER === "supabase"`. */}
          </div>
        </AuthBody>
      </AuthMain>
    </>
  )
}
