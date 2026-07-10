import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type Transaction as PlaidTransaction,
} from 'plaid';

import { SecretName, secretsService } from '#services/secrets-service';

import {
  findItemByAccountId,
  loadItems,
  type PlaidItemRecord,
  type PlaidStoredAccount,
  updateCursor,
  upsertItem,
} from './plaid-items-store';

export type PlaidEnvName = 'sandbox' | 'production';

export type NormalizedPlaidTransaction = {
  booked: boolean;
  date: string;
  payeeName: string;
  notes: string;
  transactionId: string;
  sortOrder: number;
  transactionAmount: { amount: number; currency: string };
};

export type PlaidExternalAccount = {
  account_id: string;
  name: string;
  institution: string | null;
  orgDomain: null;
  orgId: string;
  balance: number;
  item_id: string;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
};

function secretValue(name: string): string | null {
  return secretsService.get(name);
}

export function getPlaidEnv(): PlaidEnvName | null {
  const env = secretValue(SecretName.plaid_env);
  if (env === 'sandbox' || env === 'production') {
    return env;
  }
  return null;
}

export function normalizePlaidTransaction(tx: {
  transaction_id: string;
  date: string;
  name: string;
  merchant_name?: string | null;
  amount: number;
  pending?: boolean | null;
  iso_currency_code?: string | null;
}): NormalizedPlaidTransaction {
  const dateMs = Date.parse(tx.date);
  // Plaid: positive amount = money leaving depository accounts.
  // Actual bank-sync expects expenses as negative major units (Akahu-style).
  const amount = Math.round(-tx.amount * 100) / 100;
  return {
    booked: !tx.pending,
    date: tx.date,
    payeeName: tx.merchant_name || tx.name,
    notes: tx.name,
    transactionId: tx.transaction_id,
    sortOrder: Number.isFinite(dateMs) ? dateMs : 0,
    transactionAmount: {
      amount,
      currency: tx.iso_currency_code || 'USD',
    },
  };
}

type SyncClient = {
  transactionsSync: (req: {
    access_token: string;
    cursor?: string;
    count?: number;
  }) => Promise<{
    data: {
      added?: PlaidTransaction[];
      modified?: PlaidTransaction[];
      removed?: Array<{ transaction_id: string }>;
      has_more?: boolean;
      next_cursor?: string;
    };
  }>;
};

export async function fetchAllTransactionUpdates(
  client: SyncClient,
  accessToken: string,
  cursor = '',
): Promise<{
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: Array<{ transaction_id: string }>;
  nextCursor: string;
}> {
  let pageStartCursor = cursor ?? '';

  // Restart entire pagination from page-start on mutation-during-pagination.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let added: PlaidTransaction[] = [];
    let modified: PlaidTransaction[] = [];
    let removed: Array<{ transaction_id: string }> = [];
    let nextCursor = pageStartCursor;
    let hasMore = true;
    let mutationRestart = false;

    while (hasMore) {
      try {
        const response = await client.transactionsSync({
          access_token: accessToken,
          cursor: nextCursor,
          count: 500,
        });
        const data = response.data;
        added = added.concat(data.added || []);
        modified = modified.concat(data.modified || []);
        removed = removed.concat(data.removed || []);
        hasMore = Boolean(data.has_more);
        nextCursor = data.next_cursor || '';
      } catch (err: unknown) {
        const errorObj = err as {
          response?: { data?: { error_code?: string } };
          error_code?: string;
        };
        const code =
          errorObj?.response?.data?.error_code || errorObj?.error_code;
        if (code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') {
          mutationRestart = true;
          break;
        }
        throw err;
      }
    }

    if (mutationRestart) {
      continue;
    }

    return {
      added,
      modified,
      removed,
      nextCursor: nextCursor || '',
    };
  }
}

export const plaidService = {
  isConfigured(): boolean {
    const clientId = secretValue(SecretName.plaid_clientId);
    const secret = secretValue(SecretName.plaid_secret);
    const env = getPlaidEnv();
    return Boolean(clientId && secret && env);
  },

  createClient(): PlaidApi {
    const clientId = secretValue(SecretName.plaid_clientId);
    const secret = secretValue(SecretName.plaid_secret);
    const env = getPlaidEnv();
    if (!clientId || !secret || !env) {
      throw new Error(
        'Plaid is not configured. Set client ID, secret, and env (sandbox|production).',
      );
    }
    const configuration = new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    });
    return new PlaidApi(configuration);
  },

  async createLinkToken(params: {
    clientUserId: string;
    redirectUri?: string;
  }): Promise<{
    link_token: string;
    hosted_link_url?: string | null;
    expiration?: string | null;
  }> {
    const client = plaidService.createClient();
    const request: {
      user: { client_user_id: string };
      client_name: string;
      products: Products[];
      country_codes: CountryCode[];
      language: string;
      hosted_link: { completion_redirect_uri?: string };
      redirect_uri?: string;
    } = {
      user: { client_user_id: params.clientUserId },
      client_name: 'Actual Budget',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us, CountryCode.Ca],
      language: 'en',
      hosted_link: {},
    };
    if (params.redirectUri) {
      request.redirect_uri = params.redirectUri;
      request.hosted_link = {
        completion_redirect_uri: params.redirectUri,
      };
    }
    const response = await client.linkTokenCreate(request);
    return {
      link_token: response.data.link_token,
      hosted_link_url: response.data.hosted_link_url ?? null,
      expiration: response.data.expiration ?? null,
    };
  },

  async exchangePublicToken(publicToken: string): Promise<{
    item: PlaidItemRecord;
    externalAccounts: PlaidExternalAccount[];
  }> {
    const client = plaidService.createClient();
    const exchange = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    });
    const accounts = accountsResponse.data.accounts;
    const institutionId = accountsResponse.data.item.institution_id;

    let institutionName: string | undefined;
    if (institutionId) {
      try {
        const inst = await client.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us, CountryCode.Ca],
        });
        institutionName = inst.data.institution.name;
      } catch {
        institutionName = undefined;
      }
    }

    const storedAccounts: PlaidStoredAccount[] = accounts.map(account => ({
      account_id: account.account_id,
      name: account.name,
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
    }));

    const record: PlaidItemRecord = {
      item_id: itemId,
      access_token: accessToken,
      institution_name: institutionName,
      cursor: '',
      accounts: storedAccounts,
    };
    upsertItem(record);

    const externalAccounts: PlaidExternalAccount[] = accounts.map(account => ({
      account_id: account.account_id,
      name: account.official_name || account.name,
      institution: institutionName ?? null,
      orgDomain: null,
      orgId: itemId,
      balance: account.balances.current ?? 0,
      item_id: itemId,
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
    }));

    return { item: record, externalAccounts };
  },

  listExternalAccounts(): PlaidExternalAccount[] {
    const items = loadItems();
    const externalAccounts: PlaidExternalAccount[] = [];
    for (const item of Object.values(items)) {
      for (const account of item.accounts) {
        externalAccounts.push({
          account_id: account.account_id,
          name: account.name,
          institution: item.institution_name ?? null,
          orgDomain: null,
          orgId: item.item_id,
          balance: 0,
          item_id: item.item_id,
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
        });
      }
    }
    return externalAccounts;
  },

  async getTransactionsForAccount(accountId: string): Promise<{
    balances: Array<{
      balanceAmount: { amount: number; currency: string };
      balanceType: string;
      referenceDate: string;
    }>;
    startingBalance: number;
    transactions: {
      all: NormalizedPlaidTransaction[];
      booked: NormalizedPlaidTransaction[];
      pending: NormalizedPlaidTransaction[];
    };
  }> {
    const item = findItemByAccountId(accountId);
    if (!item) {
      throw new Error(`No Plaid item found for account ${accountId}`);
    }

    const client = plaidService.createClient();
    const { added, modified, nextCursor } = await fetchAllTransactionUpdates(
      client,
      item.access_token,
      item.cursor || '',
    );

    updateCursor(item.item_id, nextCursor);

    const candidates = [...added, ...modified].filter(
      tx => tx.account_id === accountId,
    );

    const booked: NormalizedPlaidTransaction[] = [];
    const pending: NormalizedPlaidTransaction[] = [];
    const all: NormalizedPlaidTransaction[] = [];

    for (const tx of candidates) {
      const normalized = normalizePlaidTransaction(tx);
      all.push(normalized);
      if (normalized.booked) {
        booked.push(normalized);
      } else {
        pending.push(normalized);
      }
    }

    let startingBalance = 0;
    const balances: Array<{
      balanceAmount: { amount: number; currency: string };
      balanceType: string;
      referenceDate: string;
    }> = [];

    try {
      const bal = await client.accountsBalanceGet({
        access_token: item.access_token,
        options: { account_ids: [accountId] },
      });
      const account = bal.data.accounts[0];
      if (account) {
        const current = account.balances.current ?? 0;
        startingBalance = Math.round(current * 100);
        balances.push({
          balanceAmount: {
            amount: Math.round(current * 100) / 100,
            currency: account.balances.iso_currency_code || 'USD',
          },
          balanceType: 'expected',
          referenceDate: new Date().toISOString().slice(0, 10),
        });
      }
    } catch {
      // balance optional
    }

    return {
      balances,
      startingBalance,
      transactions: { all, booked, pending },
    };
  },
};
