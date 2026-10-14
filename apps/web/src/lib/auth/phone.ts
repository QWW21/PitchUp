/**
 * The register form's phone field: a dial-code picker plus the rest of the
 * number — #174.
 *
 * Strips spaces and a leading zero, which Romanian numbers are usually written
 * with but E.164 does not allow. A number typed or pasted in full international
 * form (+40… or 0040…) is kept as it is; prefixing the picker's code onto it
 * produced +4040…, and the SMS went nowhere.
 */
export function toE164(dialCode: string, localNumber: string): string {
  const typed = localNumber.trim()
  if (typed.startsWith('+')) return `+${typed.replace(/\D/g, '')}`
  if (typed.startsWith('00')) return `+${typed.replace(/\D/g, '').slice(2)}`
  const digits = typed.replace(/\D/g, '').replace(/^0+/, '')
  return `${dialCode}${digits}`
}
