**Approach.** Open the capture in Wireshark. Four HTTP conversations are visible; the interesting one is the `POST /login`.
Right-click → *Follow → TCP Stream* shows the request body: `user=admin&pass=CTF%7Bfollow_the_tcp_stream%7D&remember=on`.
The password is URL-encoded (`%7B` = `{`, `%7D` = `}`). Decode it to get the flag.

**Lesson.** Anything sent over plain HTTP is readable by anyone on the path. Use HTTPS.
