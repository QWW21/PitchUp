Found while testing web manager registration; fixed in e396f41.

**Symptom:** the register form has a dial-code picker (default RO +40) and a field for the rest of the number. Typing or pasting the number in full — `+40 712 345 678` — stored `+4040712345678`, so the verification SMS could never arrive.

**Cause:** `toE164()` stripped non-digits and prepended the picker's code unconditionally.

**Fix:** a number starting with `+` or `00` is taken as already international and kept as typed; otherwise the picker's code is prepended as before (still dropping a leading 0).

**Verified:** registering with `+40 712 345 670` sends the SMS to `+40712345670`.
