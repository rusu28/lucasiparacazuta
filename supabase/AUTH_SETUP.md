# PURCAR Supabase setup

1. Open the Supabase SQL Editor and run the complete `supabase/schema.sql` file.
2. Open **Authentication > Providers > Email**.
3. Disable **Confirm email** so new accounts can sign in immediately.
4. Keep email enabled. Users can still verify later and PURCAR will display
   `Verified account` when `email_confirmed_at` is present.

The application quotas are:

- guest: 25,000 tokens per week
- signed in, not verified: 100,000 tokens per week
- signed in and verified: 150,000 tokens per week
- admin: unlimited

Until the SQL schema is applied, PURCAR keeps chats in local storage and shows
`Saved locally, cloud setup required` instead of repeatedly attempting broken
database writes.
