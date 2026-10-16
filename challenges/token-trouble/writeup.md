**Approach.** Get the guest token, then craft a new one with header `{"alg":"none","typ":"JWT"}` and a payload of
`{"user":"admin"}` (base64url, no signature part, keep the trailing dot). The vulnerable server accepts `alg: none` and skips
verification. Send it as `Authorization: Bearer <token>` to `/jwt/admin`.

**Lesson.** Servers must choose the algorithm themselves; never accept the one named inside the token.
