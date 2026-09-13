export const removeSuggestedAvatarUrl = (suggested: unknown) => {
  if (!suggested || typeof suggested !== 'object' || Array.isArray(suggested)) {
    return suggested;
  }

  const filteredSuggested = { ...suggested } as Record<string, unknown>;
  delete filteredSuggested.avatarUrl;
  return filteredSuggested;
};
