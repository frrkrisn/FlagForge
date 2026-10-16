**Approach.** Layer 1 is base64. Layer 2 is a single-byte XOR over the decoded bytes, with a key unique to your team.
Decode the base64, then try the 255 keys until readable text appears (the file starts with the known line
`# Netscape HTTP Cookie File`, so XOR-ing its first byte `#` against the first ciphertext byte reveals the key at once).
The recovered cookie jar contains your team's session cookie, which is the flag.

**Lesson.** Layering weak transforms does not make a strong one; per-team data stops answers being shared.
