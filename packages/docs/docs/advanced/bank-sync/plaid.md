# Plaid Setup

<ExperimentalFeatureWarning issueId="0" />

:::warning
Plaid bank sync is an experimental feature. Enable **Plaid Bank Sync (BYO keys, US/CA)** under Settings → Experimental features.
:::

Plaid integration uses **bring-your-own API keys**. You create a Plaid developer account and paste your Client ID and Secret into Actual. Tokens are stored on your Actual server and are **not** covered by end-to-end encryption (same as other bank sync providers).

### Requirements

- Actual server (self-hosted)
- Node-compatible server with this fork's Plaid provider
- [Plaid Dashboard](https://dashboard.plaid.com/) account
- For real banks: Plaid **Trial** or production access (`production` environment)
- For testing: `sandbox` environment

### Create Plaid keys

1. Sign up at https://dashboard.plaid.com/signup
2. Create an application and copy **client_id** and **secret**
3. For real institutions, apply for [Trial](https://dashboard.plaid.com/trial-plan) or production (uses production secret)
4. Note: development environment was removed by Plaid; only `sandbox` and `production` are valid

### Configure Actual

1. Enable the experimental flag: **Settings → Experimental → Plaid Bank Sync**
2. Open **More → Bank Sync**
3. On the **Plaid** card, click **Set up**
4. Enter Client ID, Secret, and Environment (`sandbox` or `production`)
5. Click **Save and continue**

### Link accounts

1. On the Plaid card, click **Link bank account**
2. Actual requests a Hosted Link session from Plaid and opens the URL when available
3. Complete bank login in the browser
4. Paste the `public_token` into the Actual dialog (if not delivered automatically)
5. Map Plaid accounts to new or existing Actual accounts
6. Use **Bank Sync** to download transactions

### Notes

- Uses Plaid `/transactions/sync` with cursors for incremental updates
- Pending transactions import with pending status when provided
- OAuth banks may require HTTPS redirect URIs registered in the Plaid dashboard
- Trial plans typically allow a limited number of Items (for example 10)

### Reset

Use the menu on the Plaid provider card to reset credentials. This clears Client ID, secret, environment, and stored Item tokens.
