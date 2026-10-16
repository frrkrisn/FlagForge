## Memory Lane

Incident response captured a RAM image from a compromised workstation. An analyst left themselves a note in a text
editor before the machine was isolated, and the note is still in memory.

`memory.dmp` is a (small) raw memory dump. Find the note.

Be wary: there are other "notes" in memory that are not the one you want.

**Tools that help:** `strings` (check its encoding options), `grep`, a hex editor, or Volatility if you want to go further.
