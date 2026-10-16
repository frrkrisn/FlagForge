**Approach.** The file is `team-session=<base64>`. Base64-decode the value and you have the token. Because the token is derived
from a server secret and your team id, no other team's token will be accepted, and submitting one raises a flag-sharing alert.

**Lesson.** Per-team secrets stop answer sharing: leaking a flag only ever leaks that team's.
