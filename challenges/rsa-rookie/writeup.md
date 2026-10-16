**Approach.** The two primes differ by only about 2^30, while each is 136 bits. Numbers like that fall to **Fermat's factorisation**:
start at a = ceil(sqrt(n)) and increase until a² − n is a perfect square b²; then p = a − b and q = a + b.
With p and q known: φ = (p−1)(q−1), d = e⁻¹ mod φ, m = c^d mod n, and the flag is `m` converted to bytes.

```python
from math import isqrt
a = isqrt(n) + 1
while isqrt(a*a - n)**2 != a*a - n: a += 1
b = isqrt(a*a - n); p, q = a - b, a + b
d = pow(e, -1, (p-1)*(q-1))
print(pow(c, d, n).to_bytes(40, "big").lstrip(b"\0"))
```

**Lesson.** Primes must be independent and random; close primes make factoring trivial.
