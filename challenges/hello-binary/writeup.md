**Approach.** The secret is a string literal stored in the program's read-only data, so it is plain text inside the file:
`strings hello.exe | grep CTF`. No reverse engineering is needed; this challenge teaches that literals are visible.

**Lesson.** Never store secrets as plain string constants in a binary.
