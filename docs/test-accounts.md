# Test accounts

These logins exist so Tom can open the customer and contractor dashboards. They are **off unless the API process has `ENABLE_TEST_ACCOUNTS=true`**. The default is off. Production stays off until that variable is set on Railway and the API is restarted. Turning it off (unset the variable, or set it to anything other than `true`) makes the login return "Not found" and ignores any previously issued test token.

| Username | Password | Role | Lands on |
| --- | --- | --- | --- |
| `customer` | `test` | customer (`users.role = user`) | `/customer` |
| `contractor` | `test` | approved contractor | `/contractor` |

The password is checked only after the flag is on. It is not a production backdoor.

## Turn on

On the **cabinet-backend** service (Railway), set:

```
ENABLE_TEST_ACCOUNTS=true
```

`JWT_SECRET` must already be set. The API signs a 12-hour token with it. Restart the API after changing the flag.

The sign-in pages then show a "Test login" box. The first successful login creates the two database users if they are missing and seeds a sample design and order. The contractor login also seeds a sample customer and a CRM contact. Run `docs/sql/0234_contractor_portal.tidb.sql` first or those extra rows are skipped.

## Turn off

Remove `ENABLE_TEST_ACCOUNTS` or set it to `false`, then restart the API. No frontend deploy is required.

## Supabase

These accounts are **not** Supabase users. The browser sends `x-cd-test-account` instead of a Supabase access token, and the API accepts that header only while the flag is on and only for the two seeded open ids (`test-account-customer`, `test-account-contractor`). Do not create them with the service role key from this repository. If you later want real Supabase users, create them in the Supabase dashboard and leave this flag off.
