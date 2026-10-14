# Putting Social Empires online, step by step

This guide takes the server from "runs on my computer" to "anyone can play at
**https://socialemperors.me**". No programming needed: it's all clicking in
websites and copy-pasting. Each step says *what* to do and *why*.

Plan on about an hour, most of it waiting for things to finish.

## The big picture

```
                      ┌──────────────────────────────────────────────┐
  Player's browser ──►│ socialemperors.me          (Railway)         │  accounts, saves,
   (Ruffle plays      │   the game server: this repository's code    │  game logic
    the Flash game)   └──────────────────────────────────────────────┘
          │           ┌──────────────────────────────────────────────┐
          └──────────►│ assets.socialemperors.me   (Cloudflare R2)   │  1.3 GB of art,
                      │   the assets/ folder, served by Cloudflare   │  sounds and SWFs
                      └──────────────────────────────────────────────┘
```

* **Railway** runs the server program 24/7 and keeps its database on a
  *volume* (a disk that survives restarts and updates).
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
2. Set the **mount path** to `/data`. The server stores its database and
   login secret there.

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
  Flash files into sprite sheets on 8 machines at once (well under an hour)
  and puts them in the bucket under `art/`. Run it again when buildings or
  units are added: it only makes the sheets that are missing. To make a few
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
* **Backups:** Railway → click the volume → **Backups** → turn on a
  **daily** schedule. If something goes wrong you can roll the database back
  to an earlier day.
* **Spending cap:** <https://railway.com/workspace/usage> → **Set Usage
  Limits** → set a **Custom email alert** at $8. A **hard limit** (minimum
  $10) turns the server *off* when reached, so if you set one, make it
  comfortably high (e.g. $20). Railway emails you at 75% and 90% first.
* **Logs show `Rejected game request ... bad or expired token`:** a player's
  game page is older than 7 days, or the server's secret changed. Reloading
  the page fixes it.

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
