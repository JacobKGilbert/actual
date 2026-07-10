export type SyncServerPlaidAccount = {
  account_id: string;
  name: string;
  institution: string | null;
  orgDomain: string | null;
  orgId: string;
  balance: number;
  item_id: string;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
};
