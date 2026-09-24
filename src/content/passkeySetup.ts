// The one procedure for a passkey in Microsoft Authenticator, filled for its
// reader (owner, 2026-09-24: Emergency Access's steps are the model, and
// https://aka.ms/mfasetup sends people the wrong way). The words are
// shared.methodGuides.common in docs/design/content.json; a content line reaches
// the same words as {passkeyOpen} … {passkeyProvider} (render.ts passkeyRefs).
//
// Pure: no DOM, no network.
import { shared } from './content.ts'
import { fillText } from './render.ts'

const common = (shared.methodGuides as unknown as { common: Record<string, string> }).common

/** The reader words that fill {passkeyPhone} and {passkeyAccount}: phoneYours, phoneTheirs, phoneNamed ({name}), accountTheirs. */
export const passkeyWords = common as Readonly<Record<'phoneYours' | 'phoneTheirs' | 'phoneNamed' | 'accountTheirs', string>>

/**
 * The four lines that put a passkey in Microsoft Authenticator: open the app on
 * `phone`, create the passkey for `account`, answer the sign-in prompts, and make
 * Authenticator the passkey provider. `account` arrives as the reader shows it
 * (an address in bold, or words such as "their work account").
 */
export function authenticatorPasskeyLines(phone: string, account: string): string[] {
  const values = { passkeyPhone: phone, passkeyAccount: account }
  return [common.authenticatorOpen, common.authenticatorCreate, common.authenticatorPrompts, common.authenticatorProvider].map((line) => fillText(line, values))
}

/** How a person picks the passkey at sign-in, in Microsoft Learn's words. */
export function passkeySignInLine(): string {
  return fillText(common.passkeySignIn, {})
}
