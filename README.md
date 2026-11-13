# Project Pickle

Static website for Vercel, with Supabase Auth and an Electron launcher device-code flow.
Plain HTML/CSS/JavaScript, Inter typography, no frontend build step.

## Deploy to Vercel

Import `lordpipon/projectpickle-website` with **Framework: Other**, **Root: .**,
no build command, and **Output: .**. Clean URLs are configured in `vercel.json`.

## Connect Supabase (required for sign-in)

### Custom authentication domain

Add both `projectpickle.xyz` and `auth.projectpickle.xyz` to the same Vercel
project under Settings > Domains. Apply the exact DNS records Vercel provides.
The homepage sends login and registration to the auth subdomain. The launcher
opens `https://auth.projectpickle.xyz/device?code=...`; an existing browser
session on that origin goes straight to approval. Approval is always explicit.

In Supabase set Site URL to `https://auth.projectpickle.xyz` and allow
`https://auth.projectpickle.xyz/account` as a Redirect URL. Set backend
`WEB_AUTH_URL=https://auth.projectpickle.xyz`, keep that origin in `CORS_ORIGIN`,
and set the launcher's Website URL to `https://auth.projectpickle.xyz` if it
already has older settings saved. Cookies/local storage are origin-specific:
sessions previously created on another hostname require one new sign-in here.

1. Create a Supabase project and enable Email/Password authentication.
2. Run `supabase/setup.sql` in the Supabase SQL Editor. This creates a **private**
   username directory and keeps it synced with Auth. Browser clients cannot read emails.
3. Set the Project URL and **publishable/anon** key in `assets/config.js`:

   ```js
   supabase: {
     url: "https://YOUR-PROJECT.supabase.co",
     anonKey: "YOUR-PUBLISHABLE-OR-ANON-KEY"
   }
   ```

4. In Supabase Auth > URL Configuration, set Site URL to your Vercel domain and
   add `https://YOUR-SITE.vercel.app/account` to Redirect URLs.
5. Configure the existing VPS backend in `/etc/pickle/pickle.env`:

   ```dotenv
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-OR-ANON-KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVER-ONLY-SERVICE-ROLE-KEY
   WEB_AUTH_URL=https://YOUR-SITE.vercel.app
   ```

   Add your exact Vercel origin to the existing comma-separated `CORS_ORIGIN` and
   restart `pickle`. The service-role key is needed only for private username lookup.
   **Never put it in this repository, browser configuration, or Vercel public variables.**

The current API origin is `https://34-32-63-8.sslip.io`. The backend validates
Supabase access tokens with Supabase Auth before approving launcher connections.
Supabase stores account credentials. The VPS retains game statistics and launcher sessions.

## Pages

- `/` — homepage with bots information.
- `/account` — email/username login, registration and account dashboard.
- `/account?mode=register` — registration.
- `/device` — review and approve a launcher code.
- `/support` — email, Discord username and creator website.

Email changes require the current password and Supabase email confirmation.
Password changes require the current password and matching new passwords.
Username changes require no password. Supabase SQL enforces unique usernames.

## Launcher

The Electron launcher lives in the main local Project Pickle monorepo, not this
website-only repository. It opens `/device?code=...` in the browser and polls the
backend for a one-time session. It never handles your Supabase password.
Set its website URL in Settings to your Vercel origin after deployment.

The Supabase project has **not** been provisioned by this repository. Sign-in
shows a configuration message until your own public project settings are added.
