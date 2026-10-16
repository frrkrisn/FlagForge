## Token Trouble

The API trusts a signed **JWT**. The header says which algorithm verifies it:

```json
{ "alg": "HS256", "typ": "JWT" }
```

**Target:** http://localhost:9001/jwt

Visit the page to get a guest token, then reach the admin endpoint. What if the server believed *you* about that header?

**Tools that help:** jwt.io, CyberChef, or a few lines of Python.
