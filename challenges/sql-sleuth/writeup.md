**Approach.** The input is concatenated into the query, so a username of `admin' --` comments out the password check, and
`' OR 1=1 --` matches every row. Logging in as the admin account reveals the flag. The application is backed by a real SQLite database.

**Lesson.** Use parameterised queries. Never build SQL by joining strings.
