**Approach.** Find repeated sequences in the ciphertext and measure the distances between them; the key length divides those
distances (here, 5). Split the text into 5 columns, each of which is a Caesar cipher solvable by letter frequency.
The key is `FORGE`. Decrypting gives the paragraph, which includes the flag.

**Lesson.** A repeating key is only as strong as it is long. Any pattern in the key shows up in the ciphertext.
