export type SidebarDesktopMode = 'expanded' | 'minimized' | 'hidden';

export const SIDEBAR_MODE_STORAGE_KEY = 'desai_t2dm_sidebar_mode_v1';

export function parseSidebarDesktopMode(raw: string | null | undefined): SidebarDesktopMode {
  if (raw === 'minimized' || raw === 'hidden' || raw === 'expanded') {
    return raw;
  }
  return 'expanded';
}

export function loadSidebarDesktopMode(): SidebarDesktopMode {
  try {
    if (typeof window === 'undefined') return 'expanded';
    return parseSidebarDesktopMode(window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY));
  } catch {
    return 'expanded';
  }
}

export function saveSidebarDesktopMode(mode: SidebarDesktopMode): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export function nextSidebarDesktopMode(
  current: SidebarDesktopMode,
  action: 'minimize' | 'expand' | 'hide' | 'toggle-minimize'
): SidebarDesktopMode {
  switch (action) {
    case 'minimize':
      return 'minimized';
    case 'expand':
      return 'expanded';
    case 'hide':
      return 'hidden';
    case 'toggle-minimize':
      return current === 'minimized' ? 'expanded' : 'minimized';
  }
}
