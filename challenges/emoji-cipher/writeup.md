**Approach.** Look at the code points: the first symbol is U+1F323, the next U+1F334, and so on. Each is `0x1F300 + (ascii - 32)`.
Reverse it: `chr(ord(sym) - 0x1F300 + 32)`.

```python
print("".join(chr(ord(c) - 0x1F300 + 32) for c in open("message.txt", encoding="utf8").read().strip().split("\n")[-1]))
```

**Lesson.** Text is just numbers; "obfuscation" by remapping a range is trivial to undo once you look at the numbers.
