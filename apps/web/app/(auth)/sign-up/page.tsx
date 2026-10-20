import type { Metadata } from "next"
import { SIGN_IN_PATH } from "@/config/routes"
import { SignUpForm } from "@/features/auth/components/sign-up-form"

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

export const metadata: Metadata = { title: "Sign up" }

export default function SignUpPage() {
  return (
    <>
      <AuthAside>
        <AuthPitch title="One goal, one small habit.">
          Spark keeps goals, habits and tasks together and asks for very little.
          Set it up in a minute.
        </AuthPitch>
        <Terminal title="spark init">
          <TerminalCommand step={0}>init</TerminalCommand>
          <TerminalOutput step={1} label="goal" tone="ok">
            a name is enough
          </TerminalOutput>
          <TerminalOutput step={2} label="habit" tone="ok">
            small and specific
          </TerminalOutput>
          <TerminalOutput step={3} label="mochi" tone="ok">
            adopted on day one
          </TerminalOutput>
          <TerminalOutput step={4} label="account" tone="focus">
            waiting for you
          </TerminalOutput>
          <TerminalPrompt step={5} />
        </Terminal>
        <MochiNote>
          Meet Mochi, a pixel cat that grows with every check-in and never
          judges a missed day.
        </MochiNote>
      </AuthAside>
      <AuthMain>
        <AuthHeader>
          <AuthSwitch prompt="Have an account?" href={SIGN_IN_PATH}>
            Sign in
          </AuthSwitch>
        </AuthHeader>
        <AuthBody>
          <AuthHeading eyebrow="Sign up" title="Create your account">
            Get started in a minute.
          </AuthHeading>
          <SignUpForm />
        </AuthBody>
      </AuthMain>
    </>
  )
}
