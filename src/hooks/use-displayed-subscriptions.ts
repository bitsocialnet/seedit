import { useCallback, useState } from 'react';

const haveDependenciesChanged = (previous: readonly unknown[], next: readonly unknown[]) =>
  previous.length !== next.length || previous.some((value, index) => !Object.is(value, next[index]));

const useDisplayedSubscriptions = (
  getCurrentList: () => string[],
  resetDependencies: readonly unknown[], // Dependencies that trigger a full list reset
) => {
  // The list is a snapshot taken on mount and again whenever resetDependencies change. It deliberately does not track
  // getCurrentList, so an address the user just unsubscribed from stays in the list (rendered as unsubscribed) until
  // the next reset instead of disappearing.
  const [snapshot, setSnapshot] = useState(() => ({ resetDependencies, list: getCurrentList(), unsubscribed: new Set<string>() }));

  // Reset during render (React re-renders immediately) rather than in an effect, so the stale list is never committed.
  if (haveDependenciesChanged(snapshot.resetDependencies, resetDependencies)) {
    setSnapshot({ resetDependencies, list: getCurrentList(), unsubscribed: new Set() });
  }

  const handleUnsubscribe = useCallback((address: string) => {
    setSnapshot((previous) => ({ ...previous, unsubscribed: new Set(previous.unsubscribed).add(address) }));
  }, []);

  const { unsubscribed } = snapshot;
  const isUnsubscribed = useCallback((address: string) => unsubscribed.has(address), [unsubscribed]);

  return { list: snapshot.list, isUnsubscribed, handleUnsubscribe };
};

export default useDisplayedSubscriptions;
