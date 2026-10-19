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
import {
  Terminal,
  TerminalCommand,
  TerminalOutput,
  TerminalPrompt,
} from "../_components/terminal"

export default function SignUpPage() {
  return (
    <>
      <AuthAside>
        <AuthPitch title="Start building in under a minute.">
          One account for the dashboard and everything that comes next.
        </AuthPitch>
        <Terminal title="spark init">
          <TerminalCommand step={0}>init --account</TerminalCommand>
          <TerminalOutput step={1} label="workspace" tone="ok">
            ready
          </TerminalOutput>
          <TerminalOutput step={2} label="dashboard" tone="ok">
            ready
          </TerminalOutput>
          <TerminalOutput step={3} label="settings" tone="ok">
            ready
          </TerminalOutput>
          <TerminalOutput step={4} label="account" tone="focus">
            waiting for you
          </TerminalOutput>
          <TerminalPrompt step={5} />
        </Terminal>
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
