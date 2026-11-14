
# Project Pickle website

Next.js App Router, React, actual shadcn/ui components, Tailwind CSS, Lucide icons and self-hosted Inter. Legacy HTML pages have been replaced by routes in `app/`.

## Development

Run `npm ci`, then `npm run dev`. Production: `npm run build` and `npm start`.

## Deployment

Vercel framework: Next.js. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`. Never prefix the service key with `NEXT_PUBLIC_`.

Set `NEXT_PUBLIC_LAUNCHER_DOWNLOAD_URL` only after uploading the real installer. The site intentionally does not invent a download URL.

Supabase handles credentials; the Project Pickle VPS handles canonical profiles, registration quotas, moderation, currency, inventory, daily shop, battle-pass rewards and scheduled cups. The service-role key is used only by server routes.

## Administration

`/admin` includes moderation and game operations. Access requires a backend-trusted administrator identity, not simply an email match. The owner email is `lordpipon@gmail.com`; a trusted Supabase `app_metadata.role = admin` or server-pinned owner ID is required.

Game results award 100 currency per kill and 500 per victory; first registration grants 1,000. Shop refresh is daily at midnight UTC. Catalogs start empty until configured with real supported cosmetic IDs.

The backend is not a Fortnite 28.30 protocol adapter. In-game shop, inventory and battle-pass integration still require a compatible game server. Cups currently provide scheduling only, not tournament matchmaking or scoring.
