## Final Boss: writeup

The file is `base64( hex( xor(flag, k) ) )` with a one-byte key `k`. Work backwards:

1. **base64 decode** the file. You get a long string of hex digits.
2. **hex decode** it. You get bytes that look like noise.
3. **XOR with every key from 1 to 255.** The right key makes the output start with `boss-clearance=CTF{`.

In CyberChef: `From Base64` → `From Hex` → `XOR Brute Force` (crib: `CTF{`).

The recovered `CTF{...}` is specific to your team, so it will not work for anyone else.
