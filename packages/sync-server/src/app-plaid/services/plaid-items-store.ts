import { SecretName, secretsService } from '#services/secrets-service';

export type PlaidStoredAccount = {
  account_id: string;
  name: string;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
};

export type PlaidItemRecord = {
  item_id: string;
  access_token: string;
  institution_name?: string;
  cursor?: string;
  accounts: PlaidStoredAccount[];
};

export type PlaidItemsMap = Record<string, PlaidItemRecord>;

export function loadItems(): PlaidItemsMap {
  const raw = secretsService.get(SecretName.plaid_items);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as PlaidItemsMap;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return {};
}

export function saveItems(items: PlaidItemsMap): void {
  secretsService.set(SecretName.plaid_items, JSON.stringify(items));
}

export function upsertItem(record: PlaidItemRecord): void {
  const items = loadItems();
  items[record.item_id] = record;
  saveItems(items);
}

export function updateCursor(itemId: string, cursor: string): void {
  const items = loadItems();
  const existing = items[itemId];
  if (!existing) {
    return;
  }
  items[itemId] = { ...existing, cursor };
  saveItems(items);
}

export function removeItem(itemId: string): void {
  const items = loadItems();
  delete items[itemId];
  saveItems(items);
}

export function findItemByAccountId(
  accountId: string,
): PlaidItemRecord | null {
  const items = loadItems();
  for (const item of Object.values(items)) {
    if (item.accounts.some(a => a.account_id === accountId)) {
      return item;
    }
  }
  return null;
}
