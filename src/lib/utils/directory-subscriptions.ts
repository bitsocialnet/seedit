import { isWellFormedDirectoryCode, type SeeditDirectoryCode } from './directory-codes';
import type { SeeditStarterSubscriptions } from './starter-subscriptions';

export const SEEDIT_DIRECTORY_PREFERENCES_SCHEMA_VERSION = 1 as const;

export interface AcknowledgedDirectoryWinner {
  address: string;
  revision: number;
}

export interface SeeditDirectoryPreference {
  /** The exact address currently associated with this directory. */
  subscriptionAddress: string;
  /** Explicit per-directory consent to replace the associated exact subscription. */
  autoSwitch: boolean;
  acknowledgedWinner: AcknowledgedDirectoryWinner;
}

export interface DirectoryAutomaticChangeNotice {
  directoryCode: SeeditDirectoryCode;
  fromAddress: string;
  toAddress: string;
  winnerRevision: number;
  /** Undo removes the winner only when the automatic transition added it. */
  addedWinnerSubscription: boolean;
  /** Undo restores the previous address only when the automatic transition removed it. */
  removedPreviousSubscription: boolean;
  /** Endpoint delta used to undo this switch without clobbering later starter-list changes. */
  starterProvenanceTransition?: {
    before: SeeditStarterSubscriptions;
    after: SeeditStarterSubscriptions;
  };
}

export interface SeeditDirectoryPreferences {
  schemaVersion: typeof SEEDIT_DIRECTORY_PREFERENCES_SCHEMA_VERSION;
  slots: Partial<Record<SeeditDirectoryCode, SeeditDirectoryPreference>>;
  automaticChangeNotices: Partial<Record<SeeditDirectoryCode, DirectoryAutomaticChangeNotice>>;
}

export interface AuthoritativeDirectoryWinnerSnapshot {
  directoryCode: SeeditDirectoryCode;
  address: string;
  revision: number;
  authoritative: true;
}

export interface DirectorySubscriptionsState {
  subscriptions: string[];
  preferences: SeeditDirectoryPreferences;
}

export interface PendingDirectoryWinnerChange {
  directoryCode: SeeditDirectoryCode;
  currentAddress: string;
  winnerAddress: string;
  winnerRevision: number;
}

export interface ObservedDirectoryWinnerChanges extends DirectorySubscriptionsState {
  pendingChanges: PendingDirectoryWinnerChange[];
}

export interface DirectoryStateInput {
  subscriptions: readonly string[];
  preferences?: SeeditDirectoryPreferences;
}

export interface DirectoryWinnerActionInput extends DirectoryStateInput {
  winner: AuthoritativeDirectoryWinnerSnapshot;
}

export interface DirectoryCodeActionInput extends DirectoryStateInput {
  directoryCode: SeeditDirectoryCode;
}

export interface ObserveDirectoryWinnersInput extends DirectoryStateInput {
  winners: readonly AuthoritativeDirectoryWinnerSnapshot[];
}

const BASE58_PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{30,}$/;

/** Directory slugs are never valid subscription values; names and public keys are. */
export const isExactCommunitySubscriptionAddress = (address: unknown): address is string =>
  typeof address === 'string' && address.length > 0 && !isWellFormedDirectoryCode(address) && (address.includes('.') || BASE58_PUBLIC_KEY_PATTERN.test(address));

const uniqueExactAddresses = (addresses: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const address of addresses) {
    if (!isExactCommunitySubscriptionAddress(address) || seen.has(address)) continue;
    seen.add(address);
    unique.push(address);
  }

  return unique;
};

const isRevision = (revision: unknown): revision is number => Number.isSafeInteger(revision) && (revision as number) >= 0;

const normalizeStarterProvenanceSnapshot = (value: unknown): SeeditStarterSubscriptions | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const snapshot = value as Partial<SeeditStarterSubscriptions>;
  if (
    snapshot.schemaVersion !== 1 ||
    !isRevision(snapshot.acknowledgedRevision) ||
    !Array.isArray(snapshot.knownAddresses) ||
    !Array.isArray(snapshot.managedAddresses) ||
    !snapshot.knownAddresses.every(isExactCommunitySubscriptionAddress) ||
    !snapshot.managedAddresses.every(isExactCommunitySubscriptionAddress)
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    acknowledgedRevision: snapshot.acknowledgedRevision,
    knownAddresses: uniqueExactAddresses(snapshot.knownAddresses),
    managedAddresses: uniqueExactAddresses(snapshot.managedAddresses),
  };
};

export const createEmptyDirectoryPreferences = (): SeeditDirectoryPreferences => ({
  schemaVersion: SEEDIT_DIRECTORY_PREFERENCES_SCHEMA_VERSION,
  slots: {},
  automaticChangeNotices: {},
});

// Slot codes are checked by syntax, not against the codes this client has loaded so far, so a slot for a
// directory published after this build survives account writes that happen before the registry refreshes.
export const normalizeDirectoryPreferences = (preferences: SeeditDirectoryPreferences | undefined): SeeditDirectoryPreferences => {
  if (!preferences || preferences.schemaVersion !== SEEDIT_DIRECTORY_PREFERENCES_SCHEMA_VERSION) return createEmptyDirectoryPreferences();

  const slots: SeeditDirectoryPreferences['slots'] = {};
  for (const [code, value] of Object.entries(preferences.slots ?? {})) {
    if (!isWellFormedDirectoryCode(code) || !value || !isExactCommunitySubscriptionAddress(value.subscriptionAddress)) continue;
    const acknowledgedAddress = isExactCommunitySubscriptionAddress(value.acknowledgedWinner?.address) ? value.acknowledgedWinner.address : value.subscriptionAddress;
    slots[code] = {
      subscriptionAddress: value.subscriptionAddress,
      autoSwitch: value.autoSwitch === true,
      acknowledgedWinner: {
        address: acknowledgedAddress,
        revision: isRevision(value.acknowledgedWinner?.revision) ? value.acknowledgedWinner.revision : 0,
      },
    };
  }

  const automaticChangeNotices: SeeditDirectoryPreferences['automaticChangeNotices'] = {};
  for (const [code, value] of Object.entries(preferences.automaticChangeNotices ?? {})) {
    if (
      !isWellFormedDirectoryCode(code) ||
      !slots[code] ||
      !value ||
      value.directoryCode !== code ||
      !isExactCommunitySubscriptionAddress(value.fromAddress) ||
      !isExactCommunitySubscriptionAddress(value.toAddress) ||
      !isRevision(value.winnerRevision) ||
      value.winnerRevision < 1 ||
      slots[code].subscriptionAddress !== value.toAddress ||
      slots[code].acknowledgedWinner.revision !== value.winnerRevision
    ) {
      continue;
    }
    const transitionBefore = normalizeStarterProvenanceSnapshot(value.starterProvenanceTransition?.before);
    const transitionAfter = normalizeStarterProvenanceSnapshot(value.starterProvenanceTransition?.after);
    automaticChangeNotices[code] = {
      directoryCode: code,
      fromAddress: value.fromAddress,
      toAddress: value.toAddress,
      winnerRevision: value.winnerRevision,
      addedWinnerSubscription: value.addedWinnerSubscription === true,
      removedPreviousSubscription: value.removedPreviousSubscription === true,
      ...(transitionBefore && transitionAfter ? { starterProvenanceTransition: { before: transitionBefore, after: transitionAfter } } : {}),
    };
  }

  return {
    schemaVersion: SEEDIT_DIRECTORY_PREFERENCES_SCHEMA_VERSION,
    slots,
    automaticChangeNotices,
  };
};

const removeMissingSubscriptionSlots = (subscriptions: readonly string[], preferences: SeeditDirectoryPreferences): SeeditDirectoryPreferences => {
  const subscribed = new Set(subscriptions);
  const slots: SeeditDirectoryPreferences['slots'] = {};
  const automaticChangeNotices: SeeditDirectoryPreferences['automaticChangeNotices'] = {};

  for (const code of Object.keys(preferences.slots).sort()) {
    if (!isWellFormedDirectoryCode(code)) continue;
    const slot = preferences.slots[code];
    if (!slot || !subscribed.has(slot.subscriptionAddress)) continue;
    slots[code] = slot;
    if (preferences.automaticChangeNotices[code]) automaticChangeNotices[code] = preferences.automaticChangeNotices[code];
  }

  return { ...preferences, slots, automaticChangeNotices };
};

const prepareState = ({ subscriptions, preferences }: DirectoryStateInput): DirectorySubscriptionsState => {
  const exactSubscriptions = uniqueExactAddresses(subscriptions);
  return {
    subscriptions: exactSubscriptions,
    preferences: removeMissingSubscriptionSlots(exactSubscriptions, normalizeDirectoryPreferences(preferences)),
  };
};

const isUsableWinner = (winner: AuthoritativeDirectoryWinnerSnapshot | undefined): winner is AuthoritativeDirectoryWinnerSnapshot =>
  Boolean(
    winner &&
    winner.authoritative === true &&
    isWellFormedDirectoryCode(winner.directoryCode) &&
    isExactCommunitySubscriptionAddress(winner.address) &&
    Number.isSafeInteger(winner.revision) &&
    winner.revision >= 1,
  );

const getLatestAuthoritativeWinners = (
  winners: readonly AuthoritativeDirectoryWinnerSnapshot[],
): Partial<Record<SeeditDirectoryCode, AuthoritativeDirectoryWinnerSnapshot>> => {
  const latest: Partial<Record<SeeditDirectoryCode, AuthoritativeDirectoryWinnerSnapshot>> = {};
  const conflicts = new Set<SeeditDirectoryCode>();

  for (const winner of winners) {
    if (!isUsableWinner(winner)) continue;
    const current = latest[winner.directoryCode];
    if (!current || winner.revision > current.revision) {
      latest[winner.directoryCode] = winner;
      conflicts.delete(winner.directoryCode);
    } else if (winner.revision === current.revision && winner.address !== current.address) {
      conflicts.add(winner.directoryCode);
    }
  }

  for (const code of conflicts) delete latest[code];
  return latest;
};

const updateSlot = (
  preferences: SeeditDirectoryPreferences,
  directoryCode: SeeditDirectoryCode,
  slot: SeeditDirectoryPreference,
  automaticChangeNotice?: DirectoryAutomaticChangeNotice,
  preserveAutomaticChangeNotice = false,
): SeeditDirectoryPreferences => {
  const automaticChangeNotices = { ...preferences.automaticChangeNotices };
  if (automaticChangeNotice) automaticChangeNotices[directoryCode] = automaticChangeNotice;
  else if (!preserveAutomaticChangeNotice) delete automaticChangeNotices[directoryCode];

  return {
    ...preferences,
    slots: { ...preferences.slots, [directoryCode]: slot },
    automaticChangeNotices,
  };
};

const isTrackedByAnotherSlot = (preferences: SeeditDirectoryPreferences, excludedCode: SeeditDirectoryCode, address: string): boolean =>
  Object.entries(preferences.slots).some(([code, slot]) => code !== excludedCode && slot?.subscriptionAddress === address);

const isNewerWinner = (slot: SeeditDirectoryPreference, winner: AuthoritativeDirectoryWinnerSnapshot): boolean => winner.revision > slot.acknowledgedWinner.revision;

/** Join the exact current winner and remember only Seedit-specific route provenance. */
export const joinDirectorySubscription = (input: DirectoryWinnerActionInput): DirectorySubscriptionsState => {
  const state = prepareState(input);
  if (!isUsableWinner(input.winner)) return state;

  const subscriptions = uniqueExactAddresses([...state.subscriptions, input.winner.address]);
  const existingSlot = state.preferences.slots[input.winner.directoryCode];
  if (
    existingSlot &&
    (input.winner.revision < existingSlot.acknowledgedWinner.revision ||
      (input.winner.revision === existingSlot.acknowledgedWinner.revision && input.winner.address !== existingSlot.acknowledgedWinner.address))
  ) {
    return state;
  }
  const slot: SeeditDirectoryPreference = {
    subscriptionAddress: input.winner.address,
    autoSwitch: existingSlot?.autoSwitch ?? false,
    acknowledgedWinner: { address: input.winner.address, revision: input.winner.revision },
  };

  return {
    subscriptions,
    preferences: updateSlot(state.preferences, input.winner.directoryCode, slot),
  };
};

/** A direct/manual leave also relinquishes any directory slot tracking that exact address. */
export const leaveDirectorySubscription = (input: DirectoryStateInput & { address: string }): DirectorySubscriptionsState => {
  const state = prepareState(input);
  const subscriptions = state.subscriptions.filter((address) => address !== input.address);
  const slots = { ...state.preferences.slots };
  const automaticChangeNotices = { ...state.preferences.automaticChangeNotices };

  for (const [code, slot] of Object.entries(slots)) {
    if (!isWellFormedDirectoryCode(code) || slot?.subscriptionAddress !== input.address) continue;
    delete slots[code];
    delete automaticChangeNotices[code];
  }

  return {
    subscriptions,
    preferences: { ...state.preferences, slots, automaticChangeNotices },
  };
};

/**
 * Return manual review changes and silently acknowledge a newer snapshot when its winner
 * returns to the exact address the user kept. This makes A -> B -> A -> B observable twice.
 */
export const observeDirectoryWinnerChanges = (input: ObserveDirectoryWinnersInput): ObservedDirectoryWinnerChanges => {
  const state = prepareState(input);
  const latest = getLatestAuthoritativeWinners(input.winners);
  let preferences = state.preferences;
  const pendingChanges: PendingDirectoryWinnerChange[] = [];

  for (const code of Object.keys(preferences.slots).sort()) {
    if (!isWellFormedDirectoryCode(code)) continue;
    const slot = preferences.slots[code];
    const winner = latest[code];
    if (!slot || !winner || !isNewerWinner(slot, winner)) continue;

    if (winner.address === slot.subscriptionAddress) {
      preferences = updateSlot(preferences, code, {
        ...slot,
        acknowledgedWinner: { address: winner.address, revision: winner.revision },
      });
    } else if (!slot.autoSwitch) {
      pendingChanges.push({
        directoryCode: code,
        currentAddress: slot.subscriptionAddress,
        winnerAddress: winner.address,
        winnerRevision: winner.revision,
      });
    }
  }

  return { ...state, preferences, pendingChanges };
};

/** Acknowledge a new winner while keeping the currently associated exact subscription. */
export const keepCurrentDirectorySubscription = (input: DirectoryWinnerActionInput): DirectorySubscriptionsState => {
  const state = prepareState(input);
  if (!isUsableWinner(input.winner)) return state;
  const slot = state.preferences.slots[input.winner.directoryCode];
  if (!slot || !isNewerWinner(slot, input.winner)) return state;

  return {
    ...state,
    preferences: updateSlot(state.preferences, input.winner.directoryCode, {
      ...slot,
      acknowledgedWinner: { address: input.winner.address, revision: input.winner.revision },
    }),
  };
};

/** Keep the previous address as manual, add the winner, and track the winner from now on. */
export const keepBothDirectorySubscriptions = (input: DirectoryWinnerActionInput): DirectorySubscriptionsState => {
  const state = prepareState(input);
  if (!isUsableWinner(input.winner)) return state;
  const slot = state.preferences.slots[input.winner.directoryCode];
  if (!slot || !isNewerWinner(slot, input.winner)) return state;

  return {
    subscriptions: uniqueExactAddresses([...state.subscriptions, input.winner.address]),
    preferences: updateSlot(state.preferences, input.winner.directoryCode, {
      ...slot,
      subscriptionAddress: input.winner.address,
      acknowledgedWinner: { address: input.winner.address, revision: input.winner.revision },
    }),
  };
};

/** Replace only the exact address attributable to this directory slot. */
export const switchDirectorySubscription = (input: DirectoryWinnerActionInput): DirectorySubscriptionsState => {
  const state = prepareState(input);
  if (!isUsableWinner(input.winner)) return state;
  const slot = state.preferences.slots[input.winner.directoryCode];
  if (
    !slot ||
    input.winner.revision < slot.acknowledgedWinner.revision ||
    (input.winner.revision === slot.acknowledgedWinner.revision && input.winner.address !== slot.acknowledgedWinner.address)
  ) {
    return state;
  }

  const preservePrevious = isTrackedByAnotherSlot(state.preferences, input.winner.directoryCode, slot.subscriptionAddress);
  const kept = preservePrevious ? state.subscriptions : state.subscriptions.filter((address) => address !== slot.subscriptionAddress);

  return {
    subscriptions: uniqueExactAddresses([...kept, input.winner.address]),
    preferences: updateSlot(state.preferences, input.winner.directoryCode, {
      ...slot,
      subscriptionAddress: input.winner.address,
      acknowledgedWinner: { address: input.winner.address, revision: input.winner.revision },
    }),
  };
};

export const setDirectoryAutoSwitch = (input: DirectoryCodeActionInput & { enabled: boolean }): DirectorySubscriptionsState => {
  const state = prepareState(input);
  const slot = state.preferences.slots[input.directoryCode];
  if (!slot || slot.autoSwitch === input.enabled) return state;

  return {
    ...state,
    preferences: updateSlot(state.preferences, input.directoryCode, { ...slot, autoSwitch: input.enabled }, undefined, true),
  };
};

/** Apply all consented switches from finalized authoritative snapshots in code order. */
export const reconcileAutomaticDirectorySwitches = (input: ObserveDirectoryWinnersInput): DirectorySubscriptionsState => {
  const state = prepareState(input);
  const latest = getLatestAuthoritativeWinners(input.winners);
  let subscriptions = state.subscriptions;
  let preferences = state.preferences;

  for (const code of Object.keys(preferences.slots).sort()) {
    if (!isWellFormedDirectoryCode(code)) continue;
    const slot = preferences.slots[code];
    const winner = latest[code];
    if (!slot || !winner || !isNewerWinner(slot, winner)) continue;

    if (winner.address === slot.subscriptionAddress) {
      preferences = updateSlot(preferences, code, {
        ...slot,
        acknowledgedWinner: { address: winner.address, revision: winner.revision },
      });
      continue;
    }
    if (!slot.autoSwitch) continue;

    const winnerAlreadySubscribed = subscriptions.includes(winner.address);
    const preservePrevious = isTrackedByAnotherSlot(preferences, code, slot.subscriptionAddress);
    const previousWasSubscribed = subscriptions.includes(slot.subscriptionAddress);
    const kept = preservePrevious ? subscriptions : subscriptions.filter((address) => address !== slot.subscriptionAddress);
    subscriptions = uniqueExactAddresses([...kept, winner.address]);

    const notice: DirectoryAutomaticChangeNotice = {
      directoryCode: code,
      fromAddress: slot.subscriptionAddress,
      toAddress: winner.address,
      winnerRevision: winner.revision,
      addedWinnerSubscription: !winnerAlreadySubscribed,
      removedPreviousSubscription: previousWasSubscribed && !preservePrevious,
    };
    preferences = updateSlot(
      preferences,
      code,
      {
        ...slot,
        subscriptionAddress: winner.address,
        acknowledgedWinner: { address: winner.address, revision: winner.revision },
      },
      notice,
    );
  }

  return { subscriptions, preferences };
};

export const dismissAutomaticDirectoryChange = (input: DirectoryCodeActionInput): DirectorySubscriptionsState => {
  const state = prepareState(input);
  if (!state.preferences.automaticChangeNotices[input.directoryCode]) return state;
  const automaticChangeNotices = { ...state.preferences.automaticChangeNotices };
  delete automaticChangeNotices[input.directoryCode];
  return { ...state, preferences: { ...state.preferences, automaticChangeNotices } };
};

/** Restore the previous exact subscription and disable switching so reconciliation cannot repeat it. */
export const undoAutomaticDirectorySwitch = (input: DirectoryCodeActionInput): DirectorySubscriptionsState => {
  const state = prepareState(input);
  const slot = state.preferences.slots[input.directoryCode];
  const notice = state.preferences.automaticChangeNotices[input.directoryCode];
  if (!slot || !notice || slot.subscriptionAddress !== notice.toAddress || slot.acknowledgedWinner.revision !== notice.winnerRevision) return state;

  let subscriptions = state.subscriptions;
  if (notice.removedPreviousSubscription) subscriptions = uniqueExactAddresses([...subscriptions, notice.fromAddress]);
  if (notice.addedWinnerSubscription && !isTrackedByAnotherSlot(state.preferences, input.directoryCode, notice.toAddress)) {
    subscriptions = subscriptions.filter((address) => address !== notice.toAddress);
  }

  return {
    subscriptions,
    preferences: updateSlot(state.preferences, input.directoryCode, {
      ...slot,
      subscriptionAddress: notice.fromAddress,
      autoSwitch: false,
      // Acknowledge the winner that was undone so the disabled slot does not immediately prompt.
      acknowledgedWinner: { address: notice.toAddress, revision: notice.winnerRevision },
    }),
  };
};
