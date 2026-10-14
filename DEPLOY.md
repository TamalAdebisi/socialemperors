# Putting Social Empires online, step by step

This guide takes the server from "runs on my computer" to "anyone can play at
**https://socialemperors.me**". No programming needed: it's all clicking in
websites and copy-pasting. Each step says *what* to do and *why*.

Plan on about an hour, most of it waiting for things to finish.

## The big picture

```
                      ┌──────────────────────────────────────────────┐   ┌──────────────────┐
  Player's browser ──►│ socialemperors.me          (Railway)         │──►│ Supabase         │
   (Ruffle plays      │   the game server: this repository's code    │   │  the database:   │
    the Flash game)   └──────────────────────────────────────────────┘   │  accounts, saves │
          │           ┌──────────────────────────────────────────────┐   └──────────────────┘
          └──────────►│ assets.socialemperors.me   (Cloudflare R2)   │  1.3 GB of art,
                      │   the assets/ folder, served by Cloudflare   │  sounds and SWFs
                      └──────────────────────────────────────────────┘
```

* **Railway** runs the server program 24/7, in Singapore, near most players.
  It keeps a *volume* (a disk that survives restarts and updates) for its
  login secret, and for the database until Part 6.
* **Supabase** keeps the database (Postgres): every account and empire. It's
  in Singapore too, next to the server, which asks it things all the time.
* **Cloudflare R2** stores the game's 4,479 art/sound files. Keeping them out
  of the server makes every update upload ~200 MB instead of ~1.5 GB, and
  Cloudflare delivers them from a data centre near each player for free.
* **GitHub** holds the code. When `main` changes, Railway updates the server
  automatically.

## What it costs

| Piece | Monthly cost |
| --- | --- |
| Railway Hobby plan | **$5**, which includes $5 of usage. This server uses roughly $2–4 at a few hundred players, so you should pay just the $5. |
| Cloudflare R2 | **$0**. 1.3 GB is under the 10 GB free storage; downloads from R2 are always free. |
| Supabase | **$0** (Free plan): a 500 MB database, room for thousands of empires. |
| Cloudflare DNS | **$0** (Free plan) |
| Domain | Already paid at Namecheap (yearly) |

Why Railway and not Render: see [Appendix A](#appendix-a-railway-vs-render).

---

## Part 1: Get the code onto `main`

Railway and GitHub Actions both work from your `main` branch.

1. On GitHub, open the pull request that added this file.
2. Click **Ready for review** (if it's a draft), then **Merge pull request** →
   **Confirm merge**.

*Why:* the pull request is a proposal; merging makes it the official version
of your code.

## Part 2: Cloudflare R2, the game files

### 2.1 Create the bucket

A *bucket* is a named folder in R2's storage.

1. In the Cloudflare dashboard, open **R2 Object Storage** in the left menu.
   The first time, Cloudflare asks you to enable R2 and may ask for a payment
   method. That's normal even for free use; your credits cover anything
   beyond the free tier.
2. Click **Create bucket**.
3. Name it exactly `socialempires-assets` (the upload job looks for this
   name). Leave location on *Automatic* and storage class on *Standard*.
4. Click **Create bucket**.

### 2.2 Make a key that can upload to that bucket

The upload job needs permission to write into the bucket. You'll create a
key that can *only* touch this one bucket, so even if it leaked, nothing
else in your Cloudflare account would be at risk.

1. On the **R2 Object Storage** overview page, find **Account ID** on the
   right. Copy it into a notepad, labelled "Account ID".
2. On the same page click **Manage API tokens** (may be labelled
   *API Tokens* → *Manage*), then **Create Account API token**.
3. Name: `github-assets-upload`. Permissions: **Object Read & Write**.
   Specify bucket: **Apply to specific buckets only** → `socialempires-assets`.
   TTL: *Forever*.
4. Click **Create**. Cloudflare shows an **Access Key ID** and a
   **Secret Access Key**. Copy both into your notepad now: the secret is
   shown **only once**.

### 2.3 Give the key to GitHub (as Secrets)

GitHub *Secrets* are encrypted settings. The upload job can use them, but
nobody can read them back, and GitHub hides them in logs.

1. On GitHub, open your repository → **Settings** → **Secrets and
   variables** → **Actions** → **New repository secret**.
2. Add these three, one at a time (names must match exactly):

   | Name | Value |
   | --- | --- |
   | `R2_ACCOUNT_ID` | the Account ID |
   | `R2_ACCESS_KEY_ID` | the Access Key ID |
   | `R2_SECRET_ACCESS_KEY` | the Secret Access Key |

3. You can now delete the notepad copy.

### 2.4 Upload the files

GitHub Actions lends you a computer in GitHub's data centre for a few minutes.
It copies `assets/` to R2 from there, so nothing big goes through your
internet connection.

1. Open the **Actions** tab of your repository. Because this is a fork,
   GitHub may show *"Workflows aren't being run on this forked repository"*.
   Click **I understand my workflows, go ahead and enable them**.
2. In the left list click **Upload assets to R2** → **Run workflow** (on the
   right) → keep branch `main` → **Run workflow**.
3. Wait about 5–15 minutes until it shows a green check. Click into it; the
   last step should say `Total Objects: 4483`.

If it fails with a red ✗, click it, open the red step, and send me a
screenshot. It's almost always a mistyped secret.

### 2.5 Put the bucket on your domain

1. In R2, open the `socialempires-assets` bucket → **Settings**.
2. Under **Custom Domains** click **Add** → type `assets.socialemperors.me` →
   **Continue** → **Connect domain**. Cloudflare creates the DNS record for
   you. Wait until the status says **Active** (a few minutes).
3. Leave the **r2.dev** "Public Development URL" **disabled**. It's
   rate-limited and meant only for testing.

### 2.6 Allow the game to read the files (CORS)

Browsers have a safety rule called **CORS**: a web page from one address
(`socialemperors.me`) may only read files from another address
(`assets.socialemperors.me`) if that other address says it's allowed.
Ruffle loads every game file this way, so R2 has to say yes.

**Do this before anyone plays.** Cloudflare caches files together with their
CORS answer, so a file fetched before this step can keep failing until the
cache is cleared.

1. Still in the bucket's **Settings**, under **CORS Policy** click
   **Add CORS policy** → **JSON** tab, and paste:

   ```json
   [
     {
       "AllowedOrigins": ["https://socialemperors.me"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```

   With the staging server (Part 5) the first line lists both addresses:
   `"AllowedOrigins": ["https://socialemperors.me", "https://game-server-staging-production.up.railway.app"],`

2. Click **Save**.

### 2.7 Check it

Open <https://assets.socialemperors.me/crossdomain.xml> in your browser. You
should see a short XML file. That means the bucket, the files and the domain
all work.

## Part 3: Railway, the game server

### 3.1 Create the project

1. Go to <https://railway.com> → **Login** → **Login with GitHub**.
2. Pick the **Hobby** plan ($5/month). The free trial also works for the
   first 30 days.
3. Click **New Project** → **Deploy from GitHub repo** → choose
   `TamalAdebisi/socialemperors`. If it isn't listed, click **Configure
   GitHub App** and give Railway access to that repository.
4. Railway finds the `Dockerfile` and starts building. Let it. We'll finish
   configuring it before anyone visits.

*What's a Dockerfile?* A recipe in this repository that says "start from
Python, install these libraries, copy the code, run `gunicorn server:app`".
Railway follows it on every update, so the server is always built the same
way.

### 3.2 Add a disk (volume) for the database

Without this step, every update would wipe all accounts and empires: a
container's own disk is thrown away each time it's rebuilt. A **volume** is a
separate disk that is kept.

1. In the project canvas, right-click empty space (or press `Ctrl/⌘ + K`) →
   **Volume** (*New Volume*), and connect it to the `socialemperors` service.
2. Set the **mount path** to `/data`. The server stores its login secret
   there, and its database until it moves to Supabase (Part 6).

### 3.3 Settings (environment variables)

These tell the server where it lives. Click the service → **Variables** →
**Raw Editor**, paste this, and click **Update Variables**:

```
SE_PUBLIC_URL=https://socialemperors.me
SE_ASSETS_URL=https://assets.socialemperors.me
SE_CLIENT_IP_HEADER=X-Real-IP
PORT=8080
RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30
```

| Setting | What it does |
| --- | --- |
| `SE_PUBLIC_URL` | The address players use. The game page tells Flash to send game actions here. |
| `SE_ASSETS_URL` | Where Flash downloads art, sounds and the game itself (your R2 bucket). |
| `SE_CLIENT_IP_HEADER` | Railway sits in front of the server and puts each visitor's real address in the `X-Real-IP` header, replacing any value the visitor sent. The login lockout (10 wrong passwords → wait 10 minutes) uses this to tell visitors apart. Without it, everyone would look like Railway's own machines, and one person's wrong guesses could lock out other players. |
| `PORT` | The internal port the server listens on. |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | **Important.** When Railway updates or restarts the server, it normally kills the old one instantly. The server keeps the last few seconds of everyone's progress in memory and saves it on shutdown, so it needs a moment. This gives it 30 seconds. |

Optional extras (add the same way, any time):

| Setting | Use |
| --- | --- |
| `SE_INVITE_CODE=somecode` | Closed beta: sign-up asks for this code. |
| `SE_ALLOW_REGISTRATION=0` | Stop new sign-ups entirely. |
| `SE_MAX_VILLAGES=3` | Empires per account. |
| `SE_ADMINS=yourname` | Usernames (comma-separated) that can open the admin page at `/admin`: the bug radar, password resets, deleting accounts. Nobody can until you set it; for everyone else the page doesn't exist. |

You don't need `SE_SECRET_KEY`: the server creates one and keeps it on the
volume.

### 3.4 Health check and sleeping

Click the service → **Settings**:

1. **Deploy → Healthcheck Path**: `/healthz`. Railway won't switch to a new
   version until this page answers "ok", so a broken update can't take the
   game down.
2. Make sure **Serverless** (app sleeping) is **off**, so the server stays
   awake.
3. Leave **Replicas** at **1**. The server must run as exactly one copy (see
   `MULTIPLAYER.md`); Railway enforces this anyway when a volume is attached.
4. **Source**: branch `main`. Every change merged into `main` now redeploys
   automatically. Each update means about 30 seconds of downtime; progress
   is saved first.

### 3.5 Connect socialemperors.me

1. Service → **Settings** → **Networking** → **Custom Domain** → type
   `socialemperors.me` → port **8080** → **Add Domain**.
2. Railway shows two DNS records to create: a **CNAME** (name `@`, value like
   `xxxx.up.railway.app`) and a **TXT** (name like `_railway-verify`). Keep
   that page open.
3. In Cloudflare: **socialemperors.me** → **DNS** → **Records** → **Add
   record**, once for each:
   * **CNAME**: Name `@`, Target = Railway's value, **Proxy status: DNS
     only** (click the orange cloud so it turns grey).
   * **TXT**: Name and Content exactly as Railway shows.
4. Back in Railway, wait for the domain to show a green check (usually
   minutes, up to an hour). Railway is creating the HTTPS certificate.

*Why "DNS only" (grey cloud)?* With the orange cloud, Cloudflare would sit
between players and Railway, which needs extra SSL settings to work. Grey
means Cloudflare just tells browsers where Railway is, and Railway handles
HTTPS itself. It's the simplest setup that works; we can turn on Cloudflare's
proxy later for DDoS protection if needed.

*Why not use the `...up.railway.app` address?* Always test on
`socialemperors.me`. The CORS rule in step 2.6 only allows that address, so
on the Railway address the game files would be blocked.

## Part 4: Play-test

1. Open <https://socialemperors.me> → **Sign up** → create an empire → pick
   the **Ruffle** player → **Play**.
2. If the game doesn't load, press **F12** (or right-click → *Inspect*) →
   **Console** tab, take a screenshot of the red lines, and send it to me
   along with what you saw.
3. Server logs: Railway → service → **Deployments** → latest → **View logs**.
   Every game action shows up there.

## Part 5: Running it day to day

* **Updating the game:** merge a pull request into `main`. Railway rebuilds
  and restarts by itself.
* **Trying changes first:** the `game-server-staging` service is a second,
  separate copy of the server with its own empty database. It deploys the
  branch being worked on, at
  <https://game-server-staging-production.up.railway.app>, and sleeps when
  nobody uses it (the first visit after a while takes a few seconds). Its
  address must be in the R2 bucket's CORS list (Part 2.6) for the game to load.
  See [ROADMAP.md](ROADMAP.md) for how changes go from staging to live.
* **Changed files in `assets/`:** run the **Upload assets to R2** workflow
  again (Part 2.4). It only uploads what changed.
* **The new game client's pictures** (`/client.html`, [CLIENT.md](CLIENT.md)):
  run the **Export art to R2** workflow the same way. It turns the game's
  Flash files into sprite sheets on 8 machines at once (an hour or two the
  first time, the giant bosses taking longest) and puts them in the bucket
  under `art/`, sending each as soon as it's made. Run it again when
  buildings or units are added, or if a run stopped part way: it only makes
  the sheets that are missing. To make a few
  again, type their names under **Make these again**. The server
  builds the client's code itself (the first part of the `Dockerfile`), so
  nothing else is needed.
* **Updating Ruffle** (the Flash emulator): it's in `assets/ruffle/<version>/`,
  copied unchanged from the `@ruffle-rs/ruffle` npm package (licence files
  included). For a new version: add its folder next to the old one, change
  the version and the `integrity` hash in `templates/ruffle.html`, run the
  **Upload assets to R2** workflow, and try it on staging before merging.
  Keep the old folder until the new version is live: pages already open
  still use it.
* **Backups:** see [6.6](#66-backups). Keep Railway's volume backups on
  too (Railway → click the volume → **Backups** → a **daily** schedule): the
  volume holds the login secret, and the SQLite database as it was on the day
  of the move.
* **Spending cap:** <https://railway.com/workspace/usage> → **Set Usage
  Limits** → set a **Custom email alert** at $8. A **hard limit** (minimum
  $10) turns the server *off* when reached, so if you set one, make it
  comfortably high (e.g. $20). Railway emails you at 75% and 90% first.
* **Logs show `Rejected game request ... bad or expired token`:** a player's
  game page is older than 7 days, or the server's secret changed. Reloading
  the page fixes it.

## Part 6: Supabase, the database

Until now the server kept everything in one file (SQLite) on its Railway
volume. Supabase keeps it in a proper database server (Postgres) instead.
Players won't notice anything, but it is the base for what comes next:
signing in with Discord or Google (Supabase does that part), friends and
gifts. It also means the data no longer lives on the same disk as the server.

Two things to know first:

* **The server still runs as one copy.** Empires are kept in the server's
  memory while it runs and saved every 5 seconds (`MULTIPLAYER.md`). A
  database server is needed before several copies can share the work, but
  it isn't enough on its own; that's a later step.
* **Region matters.** The server asks the database something on every page
  and saves to it every 5 seconds, so the two must be in the same city. Both
  are in **Singapore**. Railway has no region in Korea or Japan; Singapore is
  its nearest to most players (Europe is about 160 ms away).

### 6.1 The project (done)

The Supabase project **socialemperors** is set up in Singapore
(`ap-southeast-1`), in the *Social Empires Reborn* organization. In it:

| | Live server (`game-server`) | Staging (`game-server-staging`) |
| --- | --- | --- |
| Login | `se_game` | `se_staging` |
| Schema (a folder of tables) | `game` | `staging` |

Each login can only open its own schema, so a branch being tried on staging
can never touch real players. Neither schema is on Supabase's *Data API*
(the web address Supabase gives every project, which anyone who knows the
project's public key can call), so nothing in them can be read from outside.
The server makes its own tables there the first time it starts.

If the project ever has to be made again, this is the SQL that set it up
(Supabase → **SQL Editor**):

```sql
create role se_game nologin;
create role se_staging nologin;
grant se_game to postgres with inherit true, set true;
grant se_staging to postgres with inherit true, set true;
create schema game authorization se_game;
create schema staging authorization se_staging;
```

### 6.2 Give the two logins passwords

The logins start switched off, with no password. You set the passwords
yourself, so they never pass through anyone else.

1. Make two passwords with a password manager: **letters and numbers only**,
   at least 24 characters. (Symbols like `@`, `:` or `/` would need special
   encoding in the address below; letters and numbers don't.)
2. Supabase → project **socialemperors** → **SQL Editor** → **New query**,
   paste this with your two passwords in place, and click **Run**:

   ```sql
   alter role se_game with login password 'FIRST-PASSWORD';
   alter role se_staging with login password 'SECOND-PASSWORD';
   ```

3. Clear the editor afterwards (Supabase keeps a history of queries).

### 6.3 Move the game servers to Singapore (done)

Do staging first, as a rehearsal. Before each one, back up its volume:
until 6.4 is done, the live server's volume holds every account and
empire. Railway → the service → its **Backups** tab → make a manual
backup, and while you're there, switch on the **Daily** schedule (each
backup is kept for 6 days).

1. Railway → **game-server-staging** → **Settings** → **Deploy** →
   **Regions** → choose **Southeast Asia (Singapore)** → deploy the change.
2. Railway moves the volume with it. That takes a few minutes, and the
   server is down meanwhile.
3. Once staging works, do the same for **game-server**, at a quiet time:
   players are disconnected for those few minutes, and their progress is
   saved first.

### 6.4 Connect the servers to Supabase

> **Not like this for the live server.** The owner wants it to start
> fresh on Supabase at Beta 1's launch, with nothing copied over (ROADMAP,
> Beta 1). Step 3's automatic copy has to be switched off first, by a
> setting still to be built. Staging can follow the steps as they are.

1. Supabase → **Connect** (top of the page) → **Session pooler**. Copy the
   address. It looks like:

   ```
   postgresql://postgres.mosoygwxatxkhndasqfp:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

   *Why the session pooler?* Railway can only reach addresses of the older
   kind (IPv4), and Supabase's direct address is the newer kind (IPv6). The
   pooler bridges the two. Don't take the *Transaction pooler* (port 6543):
   the server refuses it, because it can't keep the server's settings
   between two questions.

2. **Staging:** Railway → **game-server-staging** → **Variables** → **Raw
   Editor**, add these two lines and click **Update Variables**. Start from
   the address you copied and change only two things: `postgres.` becomes
   `se_staging.`, and `[YOUR-PASSWORD]` becomes staging's password (no
   brackets). Keep the part after `@` exactly as Supabase gave it:

   ```
   SE_DATABASE_URL=postgresql://se_staging.mosoygwxatxkhndasqfp:SECOND-PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
   SE_DATABASE_SCHEMA=staging
   ```

3. Railway redeploys. In its logs you should see
   `Storage: Postgres, schema staging`, then
   `Copied from SQLite into Postgres: {'users': …, 'villages': …}`. That's
   staging's players, moved over once. The SQLite file stays on the volume as
   it was.
4. Play-test staging: log in, open an empire, build something, reload.
5. **Live:** the same on **game-server**, with `se_game.` and the first
   password, and **no** `SE_DATABASE_SCHEMA` line (the live schema, `game`,
   is the default):

   ```
   SE_DATABASE_URL=postgresql://se_game.mosoygwxatxkhndasqfp:FIRST-PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

6. Check the logs for the same two lines, then log in on
   <https://socialemperors.me>: your empires should all be there. In
   Supabase → **Table Editor** → schema **game**, you can now see them.

### 6.5 Going back to SQLite

Delete `SE_DATABASE_URL` from the service's variables. The server goes back
to the SQLite file on its volume, **as it was at the move**: anything played
since then is only in Supabase. To keep it, copy it into a new SQLite file
first ([6.6](#66-backups)), and put that file on the volume in place of
`/data/socialempires.db`.

### 6.6 Backups

Supabase's free plan has no backups you can download, so make your own:
`tools/copy_database.py` copies the whole database into a SQLite file on
your computer (Python and `pip install -r requirements.txt` first):

```
python tools/copy_database.py "<the live SE_DATABASE_URL>" backup-2026-10-14.db
```

It works the other way too, into an empty schema: see the top of the script.

## Part 7: Signing in with Discord and Google

Players can sign in (and sign up) with their Discord or Google account, as
well as with a username and password. Supabase does the talking to Discord
and Google (`sign_in.py` explains how), so the game server never sees anyone's
Discord or Google password. The buttons only show once a way in is switched
on in Supabase, so this part can be done one step at a time, and staging
first.

Two addresses come up below:

| | |
| --- | --- |
| Supabase's **callback**, where Discord and Google send players back to Supabase | `https://mosoygwxatxkhndasqfp.supabase.co/auth/v1/callback` |
| Our **callback**, where Supabase sends them back to the game | `https://socialemperors.me/auth/callback` (staging: `https://game-server-staging-production.up.railway.app/auth/callback`) |

### 7.1 Tell Supabase where players may come back to

Supabase only sends players back to addresses on its list, so nobody can use
your project to send them to a site of their own.

1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: `https://socialemperors.me` → **Save**.
3. **Redirect URLs** → **Add URL**, once for each:
   * `https://socialemperors.me/auth/callback`
   * `https://game-server-staging-production.up.railway.app/auth/callback`
   * `http://127.0.0.1:5050/auth/callback` (for playing on your own computer)
4. **Authentication** → **Sign In / Providers** → **Email**: switch it **off**.
   The game doesn't use Supabase's email sign-in, and nothing should be on
   that isn't used.

### 7.2 Discord

1. <https://discord.com/developers/applications> → **New Application** →
   name it `Social Empires` → **Create**. On **General Information** you can
   add the logo: players see it on Discord's "Authorize" screen.
2. **OAuth2** (left) → **Redirects** → **Add Redirect** → paste Supabase's
   callback (above) → **Save Changes**.
3. Still on **OAuth2**: copy the **Client ID**, then **Reset Secret** and
   copy the **Client Secret**. Discord shows the secret once.
4. Supabase → **Authentication** → **Sign In / Providers** → **Discord** →
   switch it on, paste the Client ID and the Client Secret → **Save**.

### 7.3 Google

1. <https://console.cloud.google.com> → the project picker (top left) →
   **New Project** → `Social Empires` → **Create**, and select it.
2. Open the **Google Auth Platform** (<https://console.cloud.google.com/auth/overview>)
   → **Get started**:
   * **App name** `Social Empires`, your **support email**.
   * **Audience**: **External**.
   * **Contact information**: your email. Agree, **Create**.
3. **Data Access** → **Add or remove scopes**: tick `openid`,
   `.../auth/userinfo.email` and `.../auth/userinfo.profile` → **Update** →
   **Save**. Only these three: anything more makes Google review the app.
4. **Clients** → **Create client** → **Web application**:
   * **Authorized JavaScript origins**: `https://socialemperors.me` and
     `https://game-server-staging-production.up.railway.app`.
   * **Authorized redirect URIs**: Supabase's callback (above).
   * **Create**, and copy the **Client ID** and **Client secret**.
5. **Audience** → **Publish app** → **Confirm**. Until then only test users
   you list there can sign in.
6. Supabase → **Authentication** → **Sign In / Providers** → **Google** →
   switch it on, paste the Client ID and the Client Secret → **Save**.

Google's screen names `mosoygwxatxkhndasqfp.supabase.co` as the site asking.
That's Supabase's address for the project; a custom domain (a paid Supabase
add-on) would show `socialemperors.me` instead. Adding the logo under
**Branding** (Google checks it within a few days) also helps players trust it.

### 7.4 The game servers

Railway → each service (**game-server-staging** first, then **game-server**)
→ **Variables** → **Raw Editor**, add, and **Update Variables**:

```
SE_SUPABASE_URL=https://mosoygwxatxkhndasqfp.supabase.co
SE_SUPABASE_KEY=sb_publishable_5tbgh9ASDSFDhGR-_uUoEw_11fYQaCq
```

Neither is a secret: the key is the project's *publishable* one, made to be
seen, which only lets the server start a sign-in. After the update, the start
page shows **Continue with Discord** and **Continue with Google**. Try both on
staging: sign up as someone new, then link the other one under **Settings**.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Railway deploy fails at *Healthcheck* | Server crashed on start | Open **View logs**, send me the last 30 lines |
| Site shows *"Application failed to respond"* | Domain's port isn't 8080 | Networking → edit domain → port 8080 |
| Login page loads, game area stays empty / green | Asset domain or CORS | Check 2.5 is *Active*, 2.6 is saved, and 2.7 works |
| Console shows `blocked by CORS policy` | CORS added after files were cached | Cloudflare → socialemperors.me → **Caching** → **Purge Everything** |
| Everyone's accounts vanished after an update | Volume not mounted at `/data` | Check 3.2 (the data from before is lost, sorry) |
| `Too many failed attempts` for everyone | `SE_CLIENT_IP_HEADER` missing | Check it's `X-Real-IP` |
| Startup lines like `Listening at:` shown in red as *error* | Normal: gunicorn writes its status messages to the error stream | Nothing to fix |
| Logs: `password authentication failed` | The password in `SE_DATABASE_URL` isn't the one set in 6.2 | Set it again in the SQL editor, and paste it into the variable again |
| Logs: `Tenant or user not found` | The name before the `:` in `SE_DATABASE_URL` is wrong | It's `se_game.` (or `se_staging.`) then the project ID: `se_game.mosoygwxatxkhndasqfp` |
| Logs: `transaction pooler (port 6543)` | The *Transaction pooler* string was copied | Use the *Session pooler* one, port 5432 (6.4) |
| Logs: `permission denied for schema` | The two servers' settings are swapped | Staging is `se_staging` with `SE_DATABASE_SCHEMA=staging`; live is `se_game` and no schema setting |
| No Discord or Google buttons | Not switched on in Supabase, or `SE_SUPABASE_URL`/`SE_SUPABASE_KEY` missing | 7.2-7.4. The server asks Supabase every 5 minutes |
| After Discord or Google, the player lands on Supabase's Site URL instead of the game | Our callback isn't on Supabase's Redirect URLs | 7.1, step 3: the address exactly, with `/auth/callback` |
| Discord says `Invalid OAuth2 redirect_uri` | Supabase's callback isn't on the Discord app | 7.2, step 2 |
| Google says `redirect_uri_mismatch` | Supabase's callback isn't on the Google client | 7.3, step 4 |
| Logs: `Signing in with Discord failed: Supabase answered ...` | The code was used twice, or was more than 5 minutes old | The player tries again; if it keeps happening, send me the line |

---

## Appendix A: Railway vs Render

Both build straight from this repository's `Dockerfile`, redeploy
automatically when `main` changes, and offer a persistent disk. Prices
checked October 2026:

| | Railway (Hobby) | Render |
| --- | --- | --- |
| Monthly fee | $5, **includes $5 of usage** | $0 workspace + **$7** for the smallest always-on server (Starter: 512 MB, 0.5 CPU) |
| How compute is billed | By actual use: ~$10 per GB of RAM per month, ~$20 per CPU per month | Fixed size; next size up is $25 |
| Persistent disk | $0.15 per GB per month, up to 5 GB | $0.25 per GB per month; **not available on the free tier** |
| Outbound traffic | $0.05 per GB | **5 GB included** (cut from 100 GB in Aug 2026), then $0.15 per GB |
| Free option that works for us | 30-day trial ($5 credit) | None: free servers can't have a disk and sleep after 15 min |
| Update downtime with a disk | ~30 s (old copy stops before new one starts) | Same |

Measured on this server: ~70 MB of RAM when idle, plus roughly 75–300 KB per
loaded empire; each game load sends ~2 MB of game settings. At around 100
daily players that's roughly 0.2 GB of RAM and 13 GB of traffic a month:
**about $5 total on Railway** vs **about $8.50 on Render** ($7 + disk + ~8 GB
of extra traffic). Railway also grows smoothly instead of jumping from $7 to
$25.

**Recommendation: Railway.** If you ever move to Render: the same
`Dockerfile` works; add a disk mounted at `/data`, the same variables (minus
the two Railway-specific ones), and health check path `/healthz`.

Sources: [Railway pricing](https://railway.com/pricing),
[Railway volumes](https://docs.railway.com/reference/volumes),
[Render free tier](https://render.com/docs/free),
[Render disks](https://render.com/docs/disks),
[Render outbound bandwidth](https://render.com/docs/outbound-bandwidth),
[Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Appendix B: What's in this repository for hosting

| File | Purpose |
| --- | --- |
| `Dockerfile` | Recipe Railway builds the server from (and the new game client, with Node) |
| `.dockerignore` | Keeps `assets/` and other big folders out of the server |
| `gunicorn.conf.py` | Production web server settings (1 process, 8 threads, saves on shutdown) |
| `.github/workflows/upload-assets-r2.yml` | The "Upload assets to R2" button |
| `.github/workflows/export-art-r2.yml` | The "Export art to R2" button: sprite sheets for the new client |
| `config_env.py` | Every setting the server reads, with explanations |
| `tools/copy_database.py` | Copies the whole database between Supabase and a SQLite file: backups (Part 6) |
| `sign_in.py` | Signing in with Discord and Google, through Supabase (Part 7) |
