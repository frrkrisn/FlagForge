**Approach.** `/robots.txt` lists a path the site owner did not want indexed: `Disallow: /s3cr3t-panel-7f3a`. Visiting that path
shows the flag.

**Lesson.** robots.txt is a request to crawlers, not access control. It also advertises exactly what is sensitive.
