"use server"

import { redirect } from "next/navigation"

import {
  DASHBOARD_PATH,
  OAUTH_CALLBACK_PATH,
  SIGN_IN_PATH,
} from "@/config/routes"
import { getAuthProvider, type SignUpResult } from "@/lib/auth"
import { getErrorMessage } from "@/lib/errors"
import { publicEnv } from "@/lib/env.public"

import { SignInSchema, SignUpSchema } from "./schemas"

/** `values` echoes non-secret fields back: React resets the form after an action finishes. */
export type SignInState = { error?: string; values?: { email: string } }
export type SignUpState = {
  error?: string
  confirmEmail?: boolean
  values?: { name: string; email: string }
}

export async function signInAction(
  _previous: SignInState,
  formData: FormData
): Promise<SignInState> {
  const values = { email: String(formData.get("email") ?? "") }
  const parsed = SignInSchema.safeParse({
    email: values.email,
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input", values }
  }

  const provider = await getAuthProvider()
  try {
    await provider.signIn(parsed.data)
  } catch (error) {
    if (!provider.isExpectedError(error)) {
      console.error("[signInAction] unexpected error:", error)
      return {
        error: "Unable to connect to authentication server. Please verify database connection.",
        values,
      }
    }
    return { error: getErrorMessage(error, "Unable to sign in"), values }
  }

  // redirect() throws, so it must stay outside the try/catch.
  redirect(DASHBOARD_PATH)
}

export async function signUpAction(
  _previous: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  }
  const parsed = SignUpSchema.safeParse({
    ...values,
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input", values }
  }

  const provider = await getAuthProvider()
  let result: SignUpResult
  try {
    result = await provider.signUp(parsed.data)
  } catch (error) {
    if (!provider.isExpectedError(error)) {
      console.error("[signUpAction] unexpected error:", error)
      return {
        error: "Unable to connect to authentication server. Please verify database connection.",
        values,
      }
    }
    return {
      error: getErrorMessage(error, "Unable to create the account"),
      values,
    }
  }

  if (result === "confirm-email") return { confirmEmail: true }
  redirect(DASHBOARD_PATH)
}

export async function signInWithGoogleAction(): Promise<void> {
  const provider = await getAuthProvider()
  let url: string | undefined
  try {
    url = await provider.oauth?.start(
      "google",
      `${publicEnv.NEXT_PUBLIC_APP_URL}${OAUTH_CALLBACK_PATH}`
    )
  } catch (error) {
    if (!provider.isExpectedError(error)) throw error
  }
  redirect(url ?? `${SIGN_IN_PATH}?error=oauth`)
}

export async function signOutAction(): Promise<void> {
  const provider = await getAuthProvider()
  await provider.signOut()
  redirect(SIGN_IN_PATH)
}
