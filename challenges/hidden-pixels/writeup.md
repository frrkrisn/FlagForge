**Approach.** PNG files are a sequence of chunks. `pngcheck -t sunset.png` (or `exiftool`) lists the `tEXt` chunks:
`Software`, `Author`, `Description` and a `Comment` containing a base64 string.
Decoding the comment (`echo ... | base64 -d`) gives the flag. The other chunks are decoys.

**Lesson.** Metadata survives in files long after people forget it is there. Strip it before publishing.
