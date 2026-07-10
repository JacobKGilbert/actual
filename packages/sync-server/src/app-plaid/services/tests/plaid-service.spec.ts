import { beforeEach, describe, expect, it, vi } from 'vitest';

const secretStore = new Map<string, string | null>();

vi.mock('#services/secrets-service', () => ({
  SecretName: {
    plaid_clientId: 'plaid_clientId',
    plaid_secret: 'plaid_secret',
    plaid_env: 'plaid_env',
    plaid_items: 'plaid_items',
  },
  secretsService: {
    get: (name: string) => secretStore.get(name) ?? null,
    set: (name: string, value: string) => {
      secretStore.set(name, value);
    },
  },
}));

vi.mock('plaid', () => ({
  Configuration: class {},
  PlaidApi: class {},
  PlaidEnvironments: { sandbox: 'sandbox', production: 'production' },
  Products: { Transactions: 'transactions' },
  CountryCode: { Us: 'US', Ca: 'CA' },
}));

import {
  fetchAllTransactionUpdates,
  getPlaidEnv,
  normalizePlaidTransaction,
  plaidService,
} from '../plaid-service';

describe('plaidService.isConfigured', () => {
  beforeEach(() => {
    secretStore.clear();
  });

  it('returns false when client id or secret missing', () => {
    expect(plaidService.isConfigured()).toBe(false);
    secretStore.set('plaid_clientId', 'id');
    expect(plaidService.isConfigured()).toBe(false);
  });

  it('returns true when clientId, secret, and env present', () => {
    secretStore.set('plaid_clientId', 'id');
    secretStore.set('plaid_secret', 'secret');
    secretStore.set('plaid_env', 'sandbox');
    expect(plaidService.isConfigured()).toBe(true);
    expect(getPlaidEnv()).toBe('sandbox');
  });

  it('rejects deprecated development env', () => {
    secretStore.set('plaid_clientId', 'id');
    secretStore.set('plaid_secret', 'secret');
    secretStore.set('plaid_env', 'development');
    expect(plaidService.isConfigured()).toBe(false);
    expect(getPlaidEnv()).toBeNull();
  });
});

describe('normalizePlaidTransaction', () => {
  it('negates plaid outflow amount for Actual', () => {
    const normalized = normalizePlaidTransaction({
      transaction_id: 'tx1',
      date: '2026-07-01',
      name: 'Coffee',
      merchant_name: 'Cafe',
      amount: 4.5,
      pending: false,
      iso_currency_code: 'USD',
    });
    expect(normalized.transactionAmount.amount).toBe(-4.5);
    expect(normalized.booked).toBe(true);
    expect(normalized.payeeName).toBe('Cafe');
    expect(normalized.transactionId).toBe('tx1');
  });

  it('marks pending transactions as not booked', () => {
    const normalized = normalizePlaidTransaction({
      transaction_id: 'tx2',
      date: '2026-07-02',
      name: 'Pending',
      amount: 10,
      pending: true,
    });
    expect(normalized.booked).toBe(false);
  });
});

describe('fetchAllTransactionUpdates', () => {
  it('paginates until has_more is false', async () => {
    const calls: Array<{ cursor?: string }> = [];
    const client = {
      transactionsSync: async (req: {
        access_token: string;
        cursor?: string;
        count?: number;
      }) => {
        calls.push({ cursor: req.cursor });
        if (!req.cursor) {
          return {
            data: {
              added: [
                {
                  transaction_id: '1',
                  account_id: 'a',
                  date: '2026-01-01',
                  name: 'A',
                  amount: 1,
                },
              ],
              modified: [],
              removed: [],
              has_more: true,
              next_cursor: 'c2',
            },
          };
        }
        return {
          data: {
            added: [
              {
                transaction_id: '2',
                account_id: 'a',
                date: '2026-01-02',
                name: 'B',
                amount: 2,
              },
            ],
            modified: [],
            removed: [],
            has_more: false,
            next_cursor: 'final',
          },
        };
      },
    };

    // @ts-expect-error partial plaid tx shapes in test
    const result = await fetchAllTransactionUpdates(client, 'token', '');
    expect(calls).toHaveLength(2);
    expect(result.added).toHaveLength(2);
    expect(result.nextCursor).toBe('final');
  });

  it('restarts pagination on TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION', async () => {
    let attempt = 0;
    const client = {
      transactionsSync: async (req: {
        access_token: string;
        cursor?: string;
      }) => {
        attempt += 1;
        if (attempt === 1) {
          return {
            data: {
              added: [
                {
                  transaction_id: 'a',
                  account_id: 'x',
                  date: '2026-01-01',
                  name: 'A',
                  amount: 1,
                },
              ],
              modified: [],
              removed: [],
              has_more: true,
              next_cursor: 'c2',
            },
          };
        }
        if (attempt === 2) {
          const err = new Error('mutation');
          // @ts-expect-error test error shape
          err.response = {
            data: { error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' },
          };
          throw err;
        }
        expect(req.cursor).toBe('');
        return {
          data: {
            added: [
              {
                transaction_id: 'full',
                account_id: 'x',
                date: '2026-01-03',
                name: 'Full',
                amount: 3,
              },
            ],
            modified: [],
            removed: [],
            has_more: false,
            next_cursor: 'done',
          },
        };
      },
    };

    // @ts-expect-error partial plaid tx shapes in test
    const result = await fetchAllTransactionUpdates(client, 'tok', '');
    expect(result.added[0]?.transaction_id).toBe('full');
    expect(result.nextCursor).toBe('done');
    expect(attempt).toBeGreaterThanOrEqual(3);
  });
});
