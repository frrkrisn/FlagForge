## RSA Rookie

A junior engineer generated an RSA key pair by hand and encrypted the flag with the public key.

`challenge.txt` contains the public modulus `n`, the public exponent `e` and the ciphertext `c` (all in decimal).
The flag, read as a big-endian integer, is the plaintext.

They picked the two primes in a hurry.

**Tools that help:** Python (big integers are built in), `gmpy2`, or a factoring site for sanity checks.
