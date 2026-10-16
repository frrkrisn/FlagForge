**Approach.** `strings memory.dmp | grep CTF` finds only a decoy: `CTF{this_is_not_the_flag_keep_looking}`.
Windows keeps most text as little-endian UTF-16, so run `strings -e l memory.dmp | grep CTF` (the `-e l` selects 16-bit little-endian).
That reveals `notes: CTF{utf16_hides_in_plain_sight}`.

**Lesson.** Always search memory in more than one encoding.
