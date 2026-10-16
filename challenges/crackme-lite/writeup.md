**Approach.** In a decompiler the `main` function is short: it reads a line, requires its length to equal the size of a table, and
for each character *i* checks `(in[i] ^ (0x5A + i*3)) == enc[i]`. Invert that: `key[i] = enc[i] ^ (0x5A + i*3)`, which gives
`HARBOR-7731-WATCH`. Entering it prints the reward, which is XOR-decoded from another table
(`blob[j] ^ 0x37 ^ (j*5)`). You can also skip running it and decode the table yourself.

**Lesson.** XOR "obfuscation" with a fixed schedule hides nothing from someone who reads the check.
