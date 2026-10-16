**Approach.** Hex-decode the file, then try every key from 1 to 255, XOR-ing each byte. For the right key the output is readable
English containing the access code (`CTF{...}`). A known-plaintext shortcut: the message contains `CTF{`, so XOR the first
four ciphertext bytes with `C`,`T`,`F`,`{` to find the key directly.

```python
data = bytes.fromhex(open("intercepted.hex").read())
for k in range(1, 256):
    out = bytes(b ^ k for b in data)
    if b"CTF{" in out:
        print(k, out.decode())
```

**Lesson.** A single-byte XOR has a 255-key space and falls to brute force or known plaintext.
