# Deploy TechNexa Solutions (Permanent Hosting)

Your site is 100% ready to deploy. Two good options — **pick the one you can log into**:

---

## Option A — AWS EC2 (Recommended)

**Why:** Uses your free AWS credits, your MySQL storage just works (all courses, messages and leads are saved in a real database), and — as a DevOps person — this is great real-world practice. **No code changes needed.**

### What you do (about 15–20 minutes, mostly waiting)

1. Go to **aws.amazon.com** - **Sign in** - **EC2** - **Launch instance**
2. Name: `cybernexa`
3. OS: **Ubuntu 22.04 LTS** (free tier eligible)
4. Instance type: **t2.micro / t3.micro** (free tier)
5. Key pair: create one (download the `.pem` — you'll need it to log in)
6. Network settings - **Allow HTTP (80), HTTPS (443)** from anywhere
7. Scroll to **Advanced details - User data** - paste the contents of **`deploy/ec2-userdata.sh`**
8. Click **Launch instance**, wait ~3–4 minutes
9. Copy the instance's **Public IPv4 address**, open `http://<that-ip>:3000` — your site is LIVE

> Before you upload the code: the script expects your project in `/opt/cybernexa`.
> Once the instance is running, upload the folder over SFTP (WinSCP / FileZilla):
> `scp -r -i your-key.pem . ubuntu@<ip>:/opt/cybernexa/`
> then run `sudo bash /opt/cybernexa/deploy/ec2-userdata.sh` again, or just restart:
> `sudo systemctl restart cybernexa`
>
> Also open **`deploy/ec2-userdata.sh`** first and change these two passwords:
> `CHANGE_ME_ADMIN_PASSWORD` (admin panel) and `CHANGE_ME_STRONG_DB_PASSWORD` (database).

### Optional next steps (ask me when ready)
- A proper domain name + automatic HTTPS (Caddy, ~10 min)
- Receive contact/enroll emails via **AWS SES** (better than the FormSubmit relay)

---

## Option B — Render.com via GitHub (Free)

**Why:** Free tier, minimal maintenance. **Trade-off:** Render's free disks are temporary — your admin edits and received messages would reset on every restart unless we add a free database (Neon Postgres) — I'll wire that in when you choose this path.

### What you do
1. Log in to **GitHub** (your account: **Muhammadumairtanveerahmed**) and create a **Personal Access Token** (Settings - Developer settings - Tokens - Generate new token, scope `repo`)
2. Give me the token **once** (or paste it into the app when I ask) so I can push your code and build the Render service for you
3. That's it — I do the rest (Render dashboard, environment variables, database, first deploy)

---

## Health check
Both setups include a `/healthz` endpoint: `https://yoursite/healthz` returns `{"ok":true}` — use it for uptime monitoring (UptimeRobot, etc.).

## Email note (important)
Your SMTP settings are still empty, so contact/enrollment emails use the **FormSubmit relay** — it only starts delivering to `umair799283@gmail.com` after you tap **"Activate Form"** in the FormSubmit email in your Gmail (phone). Until then, messages are safely saved in your admin panel.