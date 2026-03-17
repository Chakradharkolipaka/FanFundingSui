# Self-hosting a zkLogin prover (VPS, Docker)

Your Vercel runtime can’t DNS-resolve Mysten’s hosted prover domains in some regions, so this repo supports pointing `ZKLOGIN_PROVER_URL` at **your own** prover.

This guide is written to be copy/paste friendly for a typical Ubuntu VPS.

## What you need

- A VPS with a public IPv4
- A domain (recommended) pointing to the VPS, e.g. `prover.your-domain.com`
- Docker installed on the VPS

## The contract (tiny)

Your app server route `POST /api/zklogin/proof` calls whatever URL you set in `ZKLOGIN_PROVER_URL`.

In this repo, `ZKLOGIN_PROVER_URL` should point at the **public prover-fe** endpoint.

Most Mysten examples expose:

- `POST /v1` (not `/v1/prove`)

So in practice you’ll set one of:

- `ZKLOGIN_PROVER_URL=https://<your-prover-fe-domain>/v1`
- or if your prover-fe uses `/v1/prove`, then: `ZKLOGIN_PROVER_URL=https://<your-prover-fe-domain>/v1/prove`

## Step 1 — Install Docker on the VPS

Install Docker + Compose (Ubuntu):

- Install Docker Engine
- Install the docker compose plugin

If you already have Docker, skip this.

## Step 2 — Run a prover container

### Option A (recommended): use a known prover image

If you have/choose a prover Docker image that exposes `:3000/v1/prove`, run it like this:

- expose `3000` on the VPS (or behind nginx)
- restart unless stopped

Then set Vercel:

`ZKLOGIN_PROVER_URL=https://prover.your-domain.com/v1`

### Option B (current repo scaffold): build from source (placeholder)

This repo includes `docker-compose.zklogin-prover.yml` + `prover/Dockerfile` as a **scaffold**.

Important: Mysten does not currently publish a stable public repo named `MystenLabs/zklogin-prover` (the link 404s), so this Dockerfile will fail until you replace it with:

- a working upstream repo URL, or
- a working Docker image.

If you do have a prover implementation repo, you can make it work by editing build args in `prover/Dockerfile`:

- `ZKLOGIN_PROVER_REPO`
- `ZKLOGIN_PROVER_REF`

## Option C — Railway (recommended for “no-VPS” deployment)

Railway can run Docker images publicly, but it typically can’t mount your local `zkLogin.zkey` file.
So we use **base64 env var injection** for the backend prover.

### What you deploy

- **Private** service: `prover` (Mysten backend)
  - listens on `8080`
  - internal `/input`
  - requires `ZKEY_BASE64`

- **Public** service: `prover-fe` (Mysten frontend)
  - listens on `8080`
  - public `/v1`
  - requires `PROVER_URI=http://prover:8080/input`

### Step 1 — Generate base64 for `zkLogin.zkey`

On your local machine (where you have the `zkLogin.zkey` file):

```bash
base64 -w 0 zkLogin.zkey > zkLogin.zkey.b64
cat zkLogin.zkey.b64
```

Copy the printed single-line output.

### Step 2 — Create Railway services

In Railway, create **two services** in the same project.

#### Service 1: `prover` (private)

- Build from your repo using: `prover/railway/Dockerfile.prover`
- Variables:
  - `ZKEY_BASE64` = (paste the base64 string)
  - `ZKEY` = `/app/binaries/zkLogin.zkey` (optional; default is correct)
- Networking:
  - Do **not** generate a public domain

#### Service 2: `prover-fe` (public)

- Build from your repo using: `prover/railway/Dockerfile.prover-fe`
- Variables:
  - `PROVER_URI` = `http://prover:8080/input`
- Networking:
  - Generate a public domain and copy it

### Step 3 — Set Vercel env var

In Vercel → Project → Environment Variables:

- `ZKLOGIN_PROVER_URL=https://<your-prover-fe-domain>/v1`

Redeploy, then verify:

- `https://<your-vercel-app>/api/zklogin/prover-health`


## Step 3 — Put it behind HTTPS (strongly recommended)

Google login + modern browsers expect HTTPS in production.

Typical setup:

- nginx on the VPS
- Let’s Encrypt cert via certbot
- proxy_pass to `http://127.0.0.1:3000`

Your end result should be:

- `https://prover.your-domain.com/v1/prove` reachable from Vercel

## Step 4 — Configure Vercel

In Vercel project settings → Environment Variables:

- `ZKLOGIN_PROVER_URL` = `https://prover.your-domain.com/v1`
- redeploy

Then hit:

- `/api/zklogin/prover-health` on your deployed app

You want it to report your prover URL as reachable.

## Troubleshooting

### I’m getting `Failed to reach zkLogin prover endpoint` (502)

- Confirm `ZKLOGIN_PROVER_URL` is set in Vercel
- Confirm DNS resolves publicly
- Confirm the prover port is open / nginx is proxying
- Confirm the prover implements `POST /v1/prove`

### How do I know what endpoint shape the prover needs?

Check `src/app/api/zklogin/proof/route.ts`.
That file defines the request body it sends and the JSON fields it expects back.
