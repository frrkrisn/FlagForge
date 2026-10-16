## SQL Sleuth

The admin login builds its query like this:

```sql
SELECT * FROM users WHERE name = '$user' AND pass = '$pass';
```

**Target:** http://localhost:9001/sql

You have no password. You do have an apostrophe.
