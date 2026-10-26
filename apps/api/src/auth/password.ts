import argon2 from 'argon2'

/** argon2id, сангийн default параметр (64 MiB, t=3) — OWASP-ийн доод хязгаараас (19 MiB, t=2) дээш. */
const OPTIONS = { type: argon2.argon2id } as const

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, OPTIONS)

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain)
  } catch {
    // Эвдэрсэн hash — нэвтрүүлэхгүй
    return false
  }
}

/**
 * Байхгүй имэйлээр нэвтрэх оролдлогод ч ижил хугацаанд hash шалгана — хариуны хугацаагаар
 * имэйл бүртгэлтэй эсэхийг тааж болохгүй. Нэг удаа үүсгээд дахин ашиглана.
 */
let dummyHash: Promise<string> | undefined
export const getDummyHash = (): Promise<string> => (dummyHash ??= hashPassword('dummy-password-for-timing'))
