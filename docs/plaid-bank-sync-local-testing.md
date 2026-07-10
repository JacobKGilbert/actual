# Testing Plaid Bank Sync Locally (`feat/plaid-bank-sync-byo-keys`)

This guide explains how to run the experimental Plaid bank sync provider on your local machine using the `feat/plaid-bank-sync-byo-keys` branch of `JacobKGilbert/actual`.

## Prerequisites

- Node.js 20+ (22.18+ recommended by the project)
- Yarn 4 (via Corepack)
- A Plaid developer account (https://dashboard.plaid.com/)
- For real banks: Plaid Trial or production access

## 1. Clone and checkout the branch

```bash
git clone https://github.com/JacobKGilbert/actual.git
cd actual
git fetch origin
git checkout feat/plaid-bank-sync-byo-keys
```

## 2. Install dependencies

```bash
corepack enable
yarn install
```

## 3. Build (recommended)

```bash
yarn build
```

Or build just the server:

```bash
yarn workspace @actual-app/sync-server build
```

## 4. Start the sync server

The Plaid provider runs on the server.

```bash
yarn start:server-dev
```

Default URL: `http://localhost:5006`

You can also run it directly:

```bash
yarn workspace @actual-app/sync-server start
```

## 5. Start the client

In a second terminal:

```bash
yarn start
```

When prompted for the server URL, enter:

```
http://localhost:5006
```

## 6. Enable the experimental feature

1. Open the Actual client.
2. Go to **Settings → Experimental**.
3. Enable **Plaid Bank Sync (BYO keys, US/CA)**.

## 7. Configure your Plaid credentials

1. Go to **More → Bank Sync**.
2. On the **Plaid** card, click **Set up**.
3. Enter:
   - **Client ID**
   - **Secret**
   - **Environment** (`sandbox` for testing, `production` for real banks)
4. Click **Save and continue**.

## 8. Link a bank account

1. On the Plaid card, click **Link bank account**.
2. Actual generates a Hosted Link session.
3. Complete the bank login in your browser.
4. Paste the `public_token` back into the Actual dialog (if not automatically delivered).
5. Map the returned Plaid accounts to new or existing Actual accounts.

## 9. Run Bank Sync

Click **Bank Sync** on any linked account or on the All Accounts page.

## Notes

- Use the `sandbox` environment for initial testing (no real credentials required).
- For OAuth banks in production you must register a redirect URI in your Plaid dashboard (e.g. `http://localhost:5006` or your reverse proxy HTTPS URL).
- All Plaid tokens and cursors are stored server-side (not E2E encrypted — same as other bank sync providers).
- Clearing the Plaid secrets resets all linked Items.

## Running the new tests

```bash
yarn workspace @actual-app/sync-server test src/app-plaid
```

All 12 Plaid-specific unit tests should pass.

## Next steps after local testing

When you are satisfied, open a pull request on your fork:

https://github.com/JacobKGilbert/actual/pull/new/feat/plaid-bank-sync-byo-keys

Include a reference to this file in the PR description.