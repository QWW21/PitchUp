/** Phone verification SMS — plain text only. */
export function renderPhoneOtpSms(code: string, expiryMinutes: number): string {
  // Kept under 160 characters so it is billed as a single segment.
  return `${code} is your PitchUp verification code. It expires in ${expiryMinutes} minutes.`
}
