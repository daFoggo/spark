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
import {
  Terminal,
  TerminalCommand,
  TerminalOutput,
  TerminalPrompt,
} from "../_components/terminal"

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
        <AuthPitch title="Pick up right where you left off.">
          Your dashboard, projects and settings are one sign-in away.
        </AuthPitch>
        <Terminal title="spark login">
          <TerminalCommand step={0}>login</TerminalCommand>
          <TerminalOutput step={1} label="session" tone="muted">
            none found
          </TerminalOutput>
          <TerminalOutput step={2} label="workspace" tone="ok">
            ready
          </TerminalOutput>
          <TerminalOutput step={3} label="dashboard" tone="ok">
            ready
          </TerminalOutput>
          <TerminalOutput step={4} label="credentials" tone="focus">
            waiting for you
          </TerminalOutput>
          <TerminalPrompt step={5} />
        </Terminal>
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
