import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarterAccount } from './starter-account';
import { deleteAccountAfterStarterWrites, persistStarterAccountUpdate } from './starter-account-persistence';

const fake = vi.hoisted(() => {
  const state = { accounts: {} as Record<string, unknown>, accountNamesToAccountIds: {} as Record<string, string> };
  return {
    state,
    database: new Map<string, unknown>(),
    store: {
      getState: () => state,
      setState: (update: object | ((current: typeof state) => object)) => Object.assign(state, typeof update === 'function' ? update(state) : update),
    },
    addAccount: vi.fn(),
    deleteAccount: vi.fn(),
  };
});

vi.mock('@bitsocial/bitsocial-react-hooks/dist/stores/accounts/accounts-database.js', () => ({ default: { addAccount: fake.addAccount } }));
vi.mock('@bitsocial/bitsocial-react-hooks/dist/stores/accounts/accounts-store.js', () => ({ default: fake.store }));
vi.mock('@bitsocial/bitsocial-react-hooks', () => ({ deleteAccount: fake.deleteAccount }));

const account = { id: 'account-id', name: 'Account 1', subscriptions: [] } as unknown as StarterAccount;
const addStarterSubscription = (currentAccount: StarterAccount) => ({ ...currentAccount, subscriptions: ['starter.bso'] }) as StarterAccount;

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('deleteAccountAfterStarterWrites', () => {
  let deleteCanFinish: ReturnType<typeof createDeferred>;

  beforeEach(() => {
    vi.clearAllMocks();
    fake.state.accounts = { [account.id]: account };
    fake.state.accountNamesToAccountIds = { [account.name]: account.id };
    fake.database.clear();
    fake.database.set(account.id, account);
    fake.addAccount.mockImplementation(async (nextAccount: StarterAccount) => {
      fake.database.set(nextAccount.id, nextAccount);
    });
    // Like the hooks' deleteAccount: the database row goes first, the store entry only after more awaited steps.
    deleteCanFinish = createDeferred();
    fake.deleteAccount.mockImplementation(async (accountName: string) => {
      const accountId = fake.state.accountNamesToAccountIds[accountName];
      fake.database.delete(accountId);
      await deleteCanFinish.promise;
      const accounts = { ...fake.state.accounts };
      delete accounts[accountId];
      fake.state.accounts = accounts;
    });
  });

  it('deletes the account only after a default-communities write in flight has landed', async () => {
    const writeCanLand = createDeferred();
    fake.addAccount.mockImplementation(async (nextAccount: StarterAccount) => {
      await writeCanLand.promise;
      fake.database.set(nextAccount.id, nextAccount);
    });

    const write = persistStarterAccountUpdate(account.id, addStarterSubscription);
    const deletion = deleteAccountAfterStarterWrites(account.name);
    // The write lands and finishes before the delete would drop the account from the store.
    writeCanLand.resolve();
    await write;
    deleteCanFinish.resolve();
    await deletion;

    expect(fake.database.has(account.id)).toBe(false);
    expect(fake.state.accounts[account.id]).toBeUndefined();
  });

  it('deletes the account only after a write in flight has landed when the delete would drop the store entry first', async () => {
    const writeCanLand = createDeferred();
    fake.addAccount.mockImplementation(async (nextAccount: StarterAccount) => {
      await writeCanLand.promise;
      fake.database.set(nextAccount.id, nextAccount);
    });
    // Nothing holds the delete back once it starts, so it would drop the store entry before the write lands.
    deleteCanFinish.resolve();

    const write = persistStarterAccountUpdate(account.id, addStarterSubscription);
    const deletion = deleteAccountAfterStarterWrites(account.name);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.deleteAccount).not.toHaveBeenCalled();

    writeCanLand.resolve();
    await write;
    await deletion;

    expect(fake.deleteAccount).toHaveBeenCalledWith(account.name);
    expect(fake.database.has(account.id)).toBe(false);
    expect(fake.state.accounts[account.id]).toBeUndefined();
  });

  it('still deletes the account when the write in flight fails', async () => {
    fake.addAccount.mockRejectedValue(new Error('database write failed'));
    deleteCanFinish.resolve();

    const write = persistStarterAccountUpdate(account.id, addStarterSubscription);
    await deleteAccountAfterStarterWrites(account.name);

    await expect(write).rejects.toThrow('database write failed');
    expect(fake.deleteAccount).toHaveBeenCalledWith(account.name);
    expect(fake.database.has(account.id)).toBe(false);
  });

  it('refuses a default-communities write requested while the account is being deleted', async () => {
    const deletion = deleteAccountAfterStarterWrites(account.name);
    await vi.waitFor(() => expect(fake.deleteAccount).toHaveBeenCalled());

    await expect(persistStarterAccountUpdate(account.id, addStarterSubscription)).rejects.toThrow('Account disappeared while updating default communities');
    deleteCanFinish.resolve();
    await deletion;

    expect(fake.addAccount).not.toHaveBeenCalled();
    expect(fake.database.has(account.id)).toBe(false);
  });

  it('joins a deletion already in progress, so writes stay refused until the account is gone', async () => {
    const firstDeletion = deleteAccountAfterStarterWrites(account.name);
    await vi.waitFor(() => expect(fake.deleteAccount).toHaveBeenCalled());
    const secondDeletion = deleteAccountAfterStarterWrites(account.name);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await expect(persistStarterAccountUpdate(account.id, addStarterSubscription)).rejects.toThrow('Account disappeared while updating default communities');
    deleteCanFinish.resolve();
    await Promise.all([firstDeletion, secondDeletion]);

    expect(fake.deleteAccount).toHaveBeenCalledTimes(1);
    expect(fake.addAccount).not.toHaveBeenCalled();
    expect(fake.database.has(account.id)).toBe(false);
  });
});
