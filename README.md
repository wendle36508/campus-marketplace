# [APP NAME]: campus marketplace prototype

A mobile-first buy-and-sell marketplace for verified college students. Each school gets its own private marketplace; you join by verifying your school `.edu` email. This prototype is set up for **Babson College** (`@babson.edu`).

## Run it locally (5 minutes, no keys needed)

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd marketplace-app
npm install
npm start
```

Open http://localhost:3000. The database is created and filled with demo data on first start.

**To open it on your phone:** connect the phone to the same Wi-Fi as your computer, find your computer's local IP (Mac: System Settings → Wi-Fi → Details; Windows: `ipconfig`), and open `http://<that-ip>:3000` on the phone.

### Demo mode

With no keys set, everything still works:

- **Verification codes** are printed in the terminal **and** shown on the verify screen, so you can sign in from a phone without checking email.
- **AI pricing** returns sample suggestions labeled "demo mode". It guesses from the photo's file name (a file called `mini-fridge.jpg` gets a fridge price), so it's a stand-in until you add a key.

### Demo accounts

Locally, sign in with any of these emails and use the code shown on screen. On the live site nobody receives these addresses' codes, so the demo accounts can't be signed into there.

| Email | Who | Good for showing |
|---|---|---|
| `maya.demo@babson.edu` | Seller with 5 listings and a 👍 rating | Inbox, chats, marking an item sold |
| `jordan.demo@babson.edu` | Buyer chatting with Maya about the fridge | Buyer side of chat, rating a seller |
| `priya.demo@babson.edu` | Seller of the free hangers, rug, lamp | Free Stuff, Move-Out Sale |
| `luis.demo@babson.edu` | Seller with a flagged listing | Prohibited-item review |
| `tyler.demo@babson.edu` | Has two open reports against him | Getting banned |
| `admin.demo@babson.edu` | **Admin** | Profile → Admin dashboard |

Any other `@babson.edu` address creates a new account. Any non-Babson email is rejected with "Right now we're only open to Babson students."

To wipe everything and start over: `npm run reset`.

## What's built

1. **Sign-up and verification:** email only, `@babson.edu` enforced, 6-digit code (5 tries, 15-minute expiry, 30-second resend cooldown) or one-tap magic link. Profile is first name, last initial, grad year and optional photo. Every profile, listing and chat shows the "Verified Babson Student" badge. Emails and phone numbers are never sent to other users (the API has a single "public user" shape with no email).
2. **Feed:** two-column photo grid with price, title, condition, time posted, seller first name and badge. Search, category chips, price range, condition, sort, and a Move-Out Sale filter and banner.
3. **Create listing with AI pricing:** take a photo with the phone camera or upload up to 5. After the first photo, the AI suggests title, category, condition, description and a price range plus one recommended price with a one-line reason, tuned to the student used market. Everything stays editable, and AI-filled fields are highlighted. Photos are resized on the phone before upload so posting stays fast; the success message shows how many seconds it took.
4. **Messaging:** chat attached to each listing, with an "Is this still available?" button. Sellers can mark Pending or Sold right from the chat. If someone types a phone number or email, they get a gentle "keep it in the app" tip.
5. **Safety:** safe meetup spots (pickup picker and a "Suggest safe spot" card in chat), report listing or user (scam, inappropriate, prohibited item, no-show), block user, thumbs up/down after a completed sale, safety tips banner the first time you open a chat, a Safety Center page, and auto-flagging of weapons, alcohol, drugs and fake IDs. Flagged listings are hidden until an admin approves them.
6. **Admin:** open reports, flagged listings, user list with search, remove listing, approve listing, ban and unban. Banned users are signed out everywhere and can't sign back in.

## Plugging in real services

Copy `.env.example` to `.env`, fill in what you need, and restart (`npm start`).

### 1. Email sending (needed for real students)

Pick one.

**Brevo (recommended, no domain needed).** Free tier is 300 emails/day.
1. Sign up at https://brevo.com.
2. Under **Senders & IPs → Senders**, add the address emails should come from (a new Gmail account for the app works) and click the confirmation link Brevo sends it.
3. Under **SMTP & API → API keys**, create an API key.
4. In `.env`:
   ```
   EMAIL_PROVIDER=brevo
   BREVO_API_KEY=xkeysib-...
   EMAIL_FROM=[APP NAME] <yourapp@gmail.com>
   ```
Emails sent from a Gmail address through a service can land in junk folders, so tell your first testers to check junk. Sending from your own domain fixes that later.

**Resend** (needs a domain you own). Free tier is 3,000 emails/month.
1. Sign up at https://resend.com and create an API key.
2. Add and verify your sending domain (Resend gives you DNS records to add).
3. In `.env`:
   ```
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_...
   EMAIL_FROM=[APP NAME] <verify@yourdomain.com>
   ```

**Any SMTP server** (SendGrid, Postmark, Amazon SES, or Gmail with an app password). Note that Render's free plan blocks outgoing SMTP, so use Brevo or Resend there:
```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG....
EMAIL_FROM=[APP NAME] <verify@yourdomain.com>
```

Once a real provider is set, codes are no longer shown on screen. Also set `APP_URL` to your public URL so magic links point to the right place.

### 2. AI vision model (photo → price)

The app uses Claude for photo pricing.
1. Create an account at https://console.anthropic.com, add billing, and create an API key.
2. In `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Optional: `AI_MODEL` picks the model (default `claude-opus-5-5`). A cheaper model such as `claude-haiku-5-5` also works for this task if cost matters more than accuracy.

Each suggestion sends one resized photo (about 1600px) and gets back structured JSON. The code is in `server/services/ai.js`; the pricing instructions are in `systemPrompt()` there if you want to tune them. If the AI call fails for any reason, the seller still gets a rough estimate and can post.

### 3. Database

Local demos use a SQLite file (`data/marketplace.sqlite`) with zero setup. For a real deployment use Postgres:
1. Create a free Postgres database on [Neon](https://neon.tech), [Supabase](https://supabase.com) or [Railway](https://railway.app).
2. In `.env`:
   ```
   DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
   ```
3. Start the app. Tables are created automatically and demo data is seeded if the database is empty.

### 4. Admin access

Set `ADMIN_EMAILS` to your own school email (comma-separate several). That account gets the Admin dashboard under Profile the next time it signs in.

### Photos

Photos are stored in the database, so they survive restarts and redeploys with no extra storage service. Each photo is resized on the phone first (about 150-400 KB). A free Neon database (0.5 GB) holds roughly a thousand listings' worth of photos; move photos to S3 or Cloudflare R2 when you outgrow that (`server/routes/photos.js`).

## Putting it online (Render, free)

1. Push this folder to a GitHub repo (already done: github.com/wendle36508/campus-marketplace).
2. At https://render.com, choose **New → Blueprint** and pick the repo. Render reads `render.yaml`, creates a free Postgres database for the app, and asks for:
   - `ANTHROPIC_API_KEY`: your Claude API key
   - `ADMIN_EMAILS`: your @babson.edu email
3. Deploy. Your link is `https://campus-marketplace-xxxx.onrender.com`. Open it on your phone and sign in with your Babson email.

**Email verification is off in the hosted prototype.** Only `@babson.edu` addresses are accepted, but the 6-digit code is shown on screen instead of emailed, so anyone who types a Babson address can sign in as it. That's fine for testing with friends, not for a real launch. To turn real emails on, set up Brevo (see "Email sending" above), then in Render's Environment tab set `EMAIL_PROVIDER=brevo`, `DEV_SHOW_CODES=false`, `BREVO_API_KEY` and `EMAIL_FROM`.

Render's free plan sleeps after 15 minutes without visitors, so the first visit after a break takes about 30 seconds to load. The $7/month plan stays awake. Render's free database expires after 30 days; before then, upgrade it in Render or switch `DATABASE_URL` to a free Neon or Supabase database.

## Adding another college

Schools live in the `schools` table: name, allowed email domains, colors, logo and campus meetup spots. Every user, listing, chat and report has a `school_id`, and every query filters by the signed-in user's school, so students only ever see their own campus.

To add a school:
1. Copy `schools/babson.json` to `schools/<school>.json` and edit it (domains, colors, meetup spots).
2. Run `npm run add-school -- schools/<school>.json`.

That's it. Students with that email domain get their own private marketplace, branded in that school's color. The sign-up rejection message updates automatically to list all open schools.

**Editing Babson's meetup spots:** they're placeholders in `schools/babson.json`. Edit the file and run `npm run reset` (wipes demo data), or update the `meetup_spots` column in the database directly.

**Renaming the app:** set `APP_NAME` in `.env`. The icon is `public/img/icon.svg`.

## Project layout

```
server/
  index.js            app entry, routes, /api/config
  schema.js           tables (schools, users, listings, conversations, messages, reports, blocks, ratings)
  seed.js             demo data
  lib.js              auth middleware + what one user may see about another
  routes/auth.js      sign-up, code + magic link, profile
  routes/listings.js  feed, search, create/edit, photos, AI suggest, ratings
  routes/messages.js  inbox and chat
  routes/safety.js    reports, blocks, admin
  routes/photos.js    photo upload + serving (stored in the database)
  services/ai.js      Claude photo pricing (+ demo fallback)
  services/email.js   console / Resend / SMTP
  services/moderation.js  prohibited-item keywords, contact-info detection
public/               the mobile web app (plain JS modules, no build step)
schools/babson.json   Babson's row: domains, colors, meetup spots
docs/screenshots/     phone screenshots of each flow
```

## Known limits of the prototype

- Chat refreshes every 3 seconds rather than using live sockets, and there are no push notifications.
- Prohibited-item detection is a keyword list (`server/services/moderation.js`), so it can miss things and flags some harmless items for review.
- The real AI pricing path has not been run against a live API key yet.
- The hosted prototype shows sign-in codes on screen rather than emailing them (see above).
- Rate limiting is per server instance and in memory.
