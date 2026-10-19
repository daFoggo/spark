import { Button } from "@workspace/ui/components/button"

import { signInWithGoogleAction } from "../actions"

export function GoogleSignInButton() {
  return (
    <form action={signInWithGoogleAction}>
      <Button type="submit" variant="outline" size="lg" className="w-full">
        Continue with Google
      </Button>
    </form>
  )
}
