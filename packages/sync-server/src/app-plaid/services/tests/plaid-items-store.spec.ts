import { beforeEach, describe, expect, it, vi } from 'vitest';

const secretStore = new Map<string, string | null>();

vi.mock('#services/secrets-service', () => ({
  SecretName: {
    plaid_items: 'plaid_items',
  },
  secretsService: {
    get: (name: string) => secretStore.get(name) ?? null,
    set: (name: string, value: string) => {
      secretStore.set(name, value);
    },
  },
}));

import {
  findItemByAccountId,
  loadItems,
  removeItem,
  updateCursor,
  upsertItem,
} from '../plaid-items-store';

describe('plaid-items-store', () => {
  beforeEach(() => {
    secretStore.clear();
  });

  it('returns empty object when no secret stored', () => {
    expect(loadItems()).toEqual({});
  });

  it('round-trips upserted items', () => {
    upsertItem({
      item_id: 'item-1',
      access_token: 'access-1',
      institution_name: 'Chase',
      cursor: '',
      accounts: [
        {
          account_id: 'acc-1',
          name: 'Checking',
          mask: '1234',
          type: 'depository',
          subtype: 'checking',
        },
      ],
    });

    const items = loadItems();
    expect(items['item-1']?.access_token).toBe('access-1');
    expect(items['item-1']?.accounts).toHaveLength(1);
  });

  it('updates cursor for an existing item', () => {
    upsertItem({
      item_id: 'item-1',
      access_token: 'access-1',
      accounts: [{ account_id: 'acc-1', name: 'Checking' }],
    });
    updateCursor('item-1', 'cursor-abc');
    expect(loadItems()['item-1']?.cursor).toBe('cursor-abc');
  });

  it('finds item by account id', () => {
    upsertItem({
      item_id: 'item-1',
      access_token: 'access-1',
      accounts: [{ account_id: 'acc-99', name: 'Savings' }],
    });
    expect(findItemByAccountId('acc-99')?.item_id).toBe('item-1');
    expect(findItemByAccountId('missing')).toBeNull();
  });

  it('removes items', () => {
    upsertItem({
      item_id: 'item-1',
      access_token: 'access-1',
      accounts: [],
    });
    removeItem('item-1');
    expect(loadItems()).toEqual({});
  });
});
