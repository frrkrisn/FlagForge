**Approach.** The portal sets `role=Z3Vlc3Q=`, which is base64 for `guest`. Cookies live on the client, so change it to the
base64 of `admin` (`YWRtaW4=`) in your browser's developer tools and reload.

**Lesson.** Never trust client-side data for authorisation, and base64 is not protection.
