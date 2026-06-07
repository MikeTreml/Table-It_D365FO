import { useMemo } from 'react';
import { useProfileStore } from '../stores/profileStore';

export function getUrlProfileId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('profileId') ?? params.get('profile');
}

export function useUrlProfile() {
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfile = useProfileStore((s) => s.activeProfile());
  const urlProfileId = useMemo(() => getUrlProfileId(), []);

  return useMemo(
    () => profiles.find((profile) => profile.id === urlProfileId) ?? activeProfile,
    [activeProfile, profiles, urlProfileId],
  );
}

