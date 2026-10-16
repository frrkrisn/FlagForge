**Approach.** Decode in the order: base64 → base32 → hex → base64. Each step's output visibly looks like the next encoding
(base64 charset ends in `=`, base32 is upper-case A-Z2-7, hex is 0-9a-f). CyberChef's *Magic* recipe does it automatically.

**Lesson.** Encoding is not encryption. Stacking encodings adds nothing without a secret.
