import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  Mic,
  PanelLeftOpen,
  Plus,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { InvestigatorUser, PatientCRF } from './types/clinical';
import { SEED_INVESTIGATORS, SEED_PATIENTS } from './data/seedPatients';
import {
  createBlankPatientCRF,
  recalculatePatientCRF,
} from './utils/clinicalMath';
import { getPatientKey } from './utils/statisticalCharts';
import { getAccessToken, getIdToken, googleSignIn, initAuth, logout } from './lib/firebase';
import { parseJsonSafe } from './utils/http';
import {
  canAccessNavSection,
  canUserEnterPortal,
  detectNewPendingRequests,
  filterPatientsForUser,
  getPendingApprovalRequests,
  isInvestigatorRole,
  resolveNormalLoginAttempt,
  upsertLoginParticipant,
} from './utils/accessControl';
import {
  loadSidebarDesktopMode,
  saveSidebarDesktopMode,
  type SidebarDesktopMode,
} from './utils/sidebarState';
import { LOGIN_MODE_STORAGE_KEY, LoginGate, type LoginMode } from './components/LoginGate';
import { Sidebar, type NavSection } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ClinicalCollectionView, type FormTabKey } from './components/ClinicalCollectionView';
import { SubmittedDataView } from './components/SubmittedDataView';
import { CRFViewer } from './components/CRFViewer';
import { PatientProfileView } from './components/PatientProfileView';
import { PatientDocumentsView } from './components/PatientDocumentsView';
import { StatisticalAnalysisView } from './components/StatisticalAnalysisView';
import { AIWorkspaceView } from './components/AIWorkspaceView';
import { LiveVoicePanel } from './components/LiveVoicePanel';
import { TeamAccessView, type TeamRoleFilter } from './components/TeamAccessView';

const PATIENTS_STORAGE_KEY = 'desai_t2dm_patients_v1';
const TEAM_STORAGE_KEY = 'desai_t2dm_team_v1';
const PENDING_USER_STORAGE_KEY = 'desai_t2dm_pending_user_v1';

interface PendingApprovalState {
  email: string;
  displayName: string;
  status: string;
  role?: InvestigatorUser['role'];
}

function loadStoredPendingUser(): PendingApprovalState | null {
  try {
    const raw = sessionStorage.getItem(PENDING_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingApprovalState;
    if (parsed && typeof parsed.email === 'string') return parsed;
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveStoredPendingUser(value: PendingApprovalState | null): void {
  try {
    if (value) {
      sessionStorage.setItem(PENDING_USER_STORAGE_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(PENDING_USER_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function loadStoredPatients(): PatientCRF[] {
  try {
    const raw = localStorage.getItem(PATIENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PatientCRF[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p) => recalculatePatientCRF(p));
      }
    }
  } catch {
    // ignore storage errors
  }
  return SEED_PATIENTS;
}

function loadStoredTeam(): InvestigatorUser[] {
  try {
    const raw = localStorage.getItem(TEAM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InvestigatorUser[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return SEED_INVESTIGATORS;
}

export default function App() {
  const autostartPreview = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [authReady, setAuthReady] = useState(autostartPreview);
  const [previewMode, setPreviewMode] = useState(autostartPreview);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<InvestigatorUser | null>(
    autostartPreview ? SEED_INVESTIGATORS[0] : null
  );
  const [impersonatedUser, setImpersonatedUser] = useState<InvestigatorUser | null>(null);
  const [pendingUser, setPendingUser] = useState<PendingApprovalState | null>(
    autostartPreview ? null : loadStoredPendingUser
  );
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [patients, setPatients] = useState<PatientCRF[]>(loadStoredPatients);
  const [investigators, setInvestigators] = useState<InvestigatorUser[]>(loadStoredTeam);
  const [backendConnected, setBackendConnected] = useState(false);
  const [teamRefreshing, setTeamRefreshing] = useState(false);
  const [teamActionError, setTeamActionError] = useState<string | null>(null);
  const [teamInitialFilter, setTeamInitialFilter] = useState<TeamRoleFilter>('all');
  const [dismissedPendingBannerSig, setDismissedPendingBannerSig] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission
      : 'unsupported'
  );
  const bellContainerRef = useRef<HTMLDivElement | null>(null);
  const previousPendingUidsRef = useRef<Set<string> | null>(null);

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarDesktopMode>(loadSidebarDesktopMode);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedContributorFilter, setSelectedContributorFilter] = useState<string>('All');

  useEffect(() => {
    saveStoredPendingUser(pendingUser);
  }, [pendingUser]);

  const handleChangeSidebarMode = useCallback((mode: SidebarDesktopMode) => {
    setSidebarMode(mode);
    saveSidebarDesktopMode(mode);
  }, []);

  const activeUser = impersonatedUser || currentUser;
  const isInvestigator = useMemo(() => isInvestigatorRole(activeUser), [activeUser]);
  const scopedPatients = useMemo(
    () => filterPatientsForUser(patients, activeUser),
    [patients, activeUser]
  );

  // Form state for New / Edit Patient
  const [editingOriginalKey, setEditingOriginalKey] = useState<string | null>(null);
  const [draftCrf, setDraftCrf] = useState<PatientCRF>(() => createBlankPatientCRF(1));
  const [formInitialTab, setFormInitialTab] = useState<FormTabKey>('info');
  const [selectedCrfKey, setSelectedCrfKey] = useState<string | null>(null);

  // Persist local preview state cleanly
  useEffect(() => {
    try {
      localStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(patients));
    } catch {
      // ignore
    }
  }, [patients]);

  useEffect(() => {
    try {
      localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(investigators));
    } catch {
      // ignore
    }
  }, [investigators]);

  const syncFromBackend = useCallback(
    async (idToken: string, mode: LoginMode = 'investigator') => {
      try {
        const headers = { Authorization: `Bearer ${idToken}` };
        const meRes = await fetch(`/api/me?mode=${encodeURIComponent(mode)}`, { headers });

        if (!meRes.ok) {
          const errPayload = await parseJsonSafe<{ error?: string }>(meRes);
          setBackendConnected(false);
          setCurrentUser(null);
          setImpersonatedUser(null);
          setAuthError(
            errPayload?.error || 'Unable to verify your portal permission with the server. Please try signing in again.'
          );
          return;
        }

        const me = await parseJsonSafe<InvestigatorUser>(meRes);
        if (!me) {
          setBackendConnected(false);
          setCurrentUser(null);
          setImpersonatedUser(null);
          setAuthError('Empty account response from server. Please try again.');
          return;
        }

        setAuthError(null);
        setBackendConnected(true);
        setInvestigators((prev) => upsertLoginParticipant(prev, me));

        if (!canUserEnterPortal(me)) {
          setPendingUser({
            email: me.email,
            displayName: me.displayName,
            status: me.status,
            role: me.role,
          });
          setCurrentUser(null);
          setImpersonatedUser(null);
          return;
        }

        setPendingUser(null);
        setImpersonatedUser(null);
        setPreviewMode(false);
        setCurrentUser(me);

        const patRes = await fetch('/api/patients', { headers });
        if (patRes.ok) {
          const dbPatients = await parseJsonSafe<PatientCRF[]>(patRes);
          if (Array.isArray(dbPatients)) {
            if (isInvestigatorRole(me)) {
              if (dbPatients.length > 0) {
                setPatients(dbPatients.map((p) => recalculatePatientCRF(p)));
              }
            } else {
              setPatients(dbPatients.map((p) => recalculatePatientCRF(p)));
            }
          }
        }

        if (isInvestigatorRole(me)) {
          const teamRes = await fetch('/api/team', { headers });
          if (teamRes.ok) {
            const dbTeam = await parseJsonSafe<InvestigatorUser[]>(teamRes);
            if (Array.isArray(dbTeam) && dbTeam.length > 0) {
              setInvestigators(dbTeam);
              setTeamActionError(null);
            }
          } else {
            const errPayload = await parseJsonSafe<{ error?: string }>(teamRes);
            setTeamActionError(errPayload?.error || 'Unable to load pending login requests from server.');
          }
        }
      } catch {
        setBackendConnected(false);
        setCurrentUser(null);
        setImpersonatedUser(null);
        setAuthError('Network error while checking portal authorization. Please try again.');
      }
    },
    []
  );

  const refreshTeamRoster = useCallback(async () => {
    if (!firebaseUser || !isInvestigatorRole(currentUser)) return;
    setTeamRefreshing(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const teamRes = await fetch('/api/team', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (teamRes.ok) {
        const dbTeam = await parseJsonSafe<InvestigatorUser[]>(teamRes);
        if (Array.isArray(dbTeam) && dbTeam.length > 0) {
          setInvestigators(dbTeam);
          setTeamActionError(null);
        }
      } else {
        const errPayload = await parseJsonSafe<{ error?: string }>(teamRes);
        setTeamActionError(errPayload?.error || 'Unable to sync login approval requests.');
      }
    } catch {
      // ignore transient network glitches during polling
    } finally {
      setTeamRefreshing(false);
    }
  }, [firebaseUser, currentUser]);

  useEffect(() => {
    let settled = false;
    const failsafeTimer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setAuthReady(true);
      }
    }, 1000);

    const unsub = initAuth(async (user, token) => {
      settled = true;
      window.clearTimeout(failsafeTimer);
      setFirebaseUser(user);
      if (token) setAccessToken(token);
      if (user) {
        let savedMode: LoginMode = 'investigator';
        try {
          const stored = sessionStorage.getItem(LOGIN_MODE_STORAGE_KEY);
          if (stored === 'normal' || stored === 'investigator') {
            savedMode = stored;
          }
        } catch {
          // ignore
        }
        const idToken = await user.getIdToken();
        await syncFromBackend(idToken, savedMode);
      } else if (!autostartPreview) {
        setCurrentUser(null);
      }
      setAuthReady(true);
    });
    return () => {
      window.clearTimeout(failsafeTimer);
      unsub();
    };
  }, [autostartPreview, syncFromBackend]);

  // Live poll approval requests for logged-in investigators so new loginers arrive automatically
  useEffect(() => {
    if (!firebaseUser || !backendConnected || !isInvestigatorRole(currentUser)) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshTeamRoster();
      }
    }, 5000);

    const handleFocus = () => {
      void refreshTeamRoster();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [firebaseUser, backendConnected, currentUser, refreshTeamRoster]);

  useEffect(() => {
    if (activeNav === 'team' && firebaseUser && backendConnected && isInvestigatorRole(currentUser)) {
      void refreshTeamRoster();
    }
  }, [activeNav, firebaseUser, backendConnected, currentUser, refreshTeamRoster]);

  // Automatically poll server while a user is waiting on the pending approval screen
  useEffect(() => {
    if (activeUser || !pendingUser || pendingUser.status !== 'pending') return;

    const checkPendingApproval = async () => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          await syncFromBackend(
            idToken,
            pendingUser.role === 'normal' ? 'normal' : 'investigator'
          );
        } catch {
          // ignore transient poll failures
        }
        return;
      }

      try {
        const res = await fetch(
          `/api/normal-login/status?email=${encodeURIComponent(pendingUser.email)}`
        );
        if (!res.ok) return;
        const serverUser = await parseJsonSafe<InvestigatorUser>(res);
        if (!serverUser) return;
        setInvestigators((prev) => upsertLoginParticipant(prev, serverUser));
        if (canUserEnterPortal(serverUser)) {
          setPendingUser(null);
          setImpersonatedUser(null);
          setPreviewMode(false);
          setSelectedContributorFilter('All');
          setActiveNav('dashboard');
          setCurrentUser(serverUser);
          setPatients((prev) => filterPatientsForUser(prev, serverUser));
        } else if (serverUser.status !== pendingUser.status) {
          setPendingUser({
            email: serverUser.email,
            displayName: serverUser.displayName,
            status: serverUser.status,
            role: serverUser.role,
          });
        }
      } catch {
        // ignore transient poll failures
      }
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkPendingApproval();
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeUser, pendingUser, firebaseUser, syncFromBackend]);

  const handleGoogleSignIn = async (mode: LoginMode = 'investigator'): Promise<string | null> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      try {
        sessionStorage.setItem(LOGIN_MODE_STORAGE_KEY, mode);
      } catch {
        // ignore
      }
      const result = await googleSignIn();
      if (!result) return null;
      setFirebaseUser(result.user);
      if (result.accessToken) setAccessToken(result.accessToken);
      setPreviewMode(false);
      await syncFromBackend(result.idToken, mode);
      return result.accessToken;
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleNormalLogin = async (params: { displayName: string; email: string }) => {
    const resolved = resolveNormalLoginAttempt(investigators, params);
    if (resolved.requiresGoogleSignIn) {
      setAuthError(
        'This email is registered as an Investigator account. Please sign in with Google under Investigator Login.'
      );
      return;
    }

    let finalUser = resolved.user;
    let canEnter = false;

    setAuthError(null);
    setAuthLoading(true);

    try {
      const res = await fetch('/api/normal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: resolved.user.uid,
          email: resolved.user.email,
          displayName: resolved.user.displayName,
        }),
      });
      if (!res.ok) {
        const errBody = await parseJsonSafe<{ error?: string }>(res);
        setAuthError(
          errBody?.error || 'Unable to verify login permission with the server. Please try again.'
        );
        return;
      }
      const serverUser = await parseJsonSafe<InvestigatorUser>(res);
      if (!serverUser) {
        setAuthError('Invalid server response during login. Please try again.');
        return;
      }
      finalUser = serverUser;
      canEnter = canUserEnterPortal(serverUser);
      setInvestigators((prev) => upsertLoginParticipant(prev, serverUser));
    } catch {
      setAuthError('Unable to reach server to submit your login request. Please check your connection.');
      return;
    } finally {
      setAuthLoading(false);
    }

    if (!canEnter) {
      setPendingUser({
        email: finalUser.email,
        displayName: finalUser.displayName,
        status: finalUser.status,
        role: finalUser.role,
      });
      setCurrentUser(null);
      setImpersonatedUser(null);
      setAuthReady(true);
      return;
    }

    setPendingUser(null);
    setImpersonatedUser(null);
    setPreviewMode(false);
    setSelectedContributorFilter('All');
    setActiveNav('dashboard');
    setCurrentUser(finalUser);
    setPatients((prev) => filterPatientsForUser(prev, finalUser));
    setAuthReady(true);
  };

  const handleRetryPendingCheck = async () => {
    if (!pendingUser) return;
    if (firebaseUser) {
      setAuthLoading(true);
      try {
        const idToken = await firebaseUser.getIdToken();
        await syncFromBackend(idToken, pendingUser.role === 'normal' ? 'normal' : 'investigator');
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(
        `/api/normal-login/status?email=${encodeURIComponent(pendingUser.email)}`
      );
      if (res.status === 404) {
        await handleNormalLogin({
          displayName: pendingUser.displayName || pendingUser.email.split('@')[0],
          email: pendingUser.email,
        });
        return;
      }
      if (!res.ok) {
        const errBody = await parseJsonSafe<{ error?: string }>(res);
        setAuthError(errBody?.error || 'Unable to check approval status right now.');
        return;
      }
      const serverUser = await parseJsonSafe<InvestigatorUser>(res);
      if (!serverUser) return;
      setInvestigators((prev) => upsertLoginParticipant(prev, serverUser));
      if (canUserEnterPortal(serverUser)) {
        setPendingUser(null);
        setImpersonatedUser(null);
        setPreviewMode(false);
        setSelectedContributorFilter('All');
        setActiveNav('dashboard');
        setCurrentUser(serverUser);
        setPatients((prev) => filterPatientsForUser(prev, serverUser));
      } else {
        setPendingUser({
          email: serverUser.email,
          displayName: serverUser.displayName,
          status: serverUser.status,
          role: serverUser.role,
        });
      }
    } catch {
      setAuthError('Network error while checking approval status. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEnterUserAccount = (targetUser: InvestigatorUser) => {
    if (!isInvestigatorRole(currentUser)) return;
    setImpersonatedUser(targetUser);
    setGlobalSearch('');
    setSelectedContributorFilter('All');
    setSelectedCrfKey(null);
    setActiveNav('dashboard');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleExitUserAccount = () => {
    setImpersonatedUser(null);
    setGlobalSearch('');
    setSelectedContributorFilter('All');
    setActiveNav('team');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleLogout = async () => {
    await logout();
    setFirebaseUser(null);
    setAccessToken(null);
    setCurrentUser(null);
    setImpersonatedUser(null);
    setPendingUser(null);
    saveStoredPendingUser(null);
    setAuthError(null);
    setPreviewMode(false);
    setBackendConnected(false);
    setSelectedContributorFilter('All');
    setActiveNav('dashboard');
  };

  const startNewPatient = () => {
    const blank = createBlankPatientCRF(1);
    blank.investigatorName = activeUser?.displayName || '';
    blank.investigatorEmail = activeUser?.email || '';
    blank.createdByUid = activeUser?.uid || '';
    setEditingOriginalKey(null);
    setDraftCrf(blank);
    setFormInitialTab('info');
    setActiveNav('new-patient');
  };

  const startEditPatient = (
    patient: PatientCRF,
    tab: FormTabKey = 'info'
  ) => {
    setEditingOriginalKey(getPatientKey(patient));
    setDraftCrf(recalculatePatientCRF(patient));
    setFormInitialTab(tab);
    setActiveNav('new-patient');
  };

  const handleSavePatient = async (finalCrf: PatientCRF) => {
    const recalculated = recalculatePatientCRF({
      ...finalCrf,
      investigatorName: finalCrf.investigatorName || activeUser?.displayName || '',
      investigatorEmail: finalCrf.investigatorEmail || activeUser?.email || '',
      createdByUid: finalCrf.createdByUid || activeUser?.uid || '',
      verifiedAt: finalCrf.verifiedAt || new Date().toISOString(),
    });

    if (backendConnected && firebaseUser) {
      const idToken = await getIdToken();
      if (idToken) {
        if (editingOriginalKey && finalCrf.id) {
          const res = await fetch(`/api/patients/${finalCrf.id}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(recalculated),
          });
          if (res.ok) {
            const saved = await parseJsonSafe<PatientCRF & { fallbackMode?: boolean }>(res);
            if (saved && !saved.fallbackMode) {
              setPatients((prev) =>
                prev.map((p) => (getPatientKey(p) === editingOriginalKey ? saved : p))
              );
              setEditingOriginalKey(getPatientKey(saved));
              setDraftCrf(saved);
              setActiveNav('dashboard');
              return;
            }
          }
        } else {
          const res = await fetch('/api/patients', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(recalculated),
          });
          if (res.ok) {
            const created = await parseJsonSafe<PatientCRF & { fallbackMode?: boolean }>(res);
            if (created && !created.fallbackMode) {
              setPatients((prev) => [created, ...prev]);
              setActiveNav('dashboard');
              return;
            }
          }
        }
      }
    }

    // Local preview / offline fallback persistence
    setPatients((prev) => {
      if (editingOriginalKey) {
        return prev.map((p) =>
          getPatientKey(p) === editingOriginalKey ? recalculated : p
        );
      }
      const nextId =
        prev.reduce((max, p) => Math.max(max, p.id ?? 0), 0) + 1;
      return [{ ...recalculated, id: nextId }, ...prev];
    });
    setActiveNav('dashboard');
  };

  const handleInlinePatientUpdate = async (updated: PatientCRF) => {
    const recalculated = recalculatePatientCRF(updated);
    const updatedKey = getPatientKey(recalculated);
    if (backendConnected && firebaseUser && updated.id) {
      const idToken = await getIdToken();
      if (idToken) {
        await fetch(`/api/patients/${updated.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recalculated),
        }).catch(() => {});
      }
    }
    setPatients((prev) =>
      prev.map((p) => (getPatientKey(p) === updatedKey ? recalculated : p))
    );
  };

  const handleDeletePatient = async (patient: PatientCRF) => {
    const targetKey = getPatientKey(patient);
    if (backendConnected && firebaseUser && patient.id) {
      const idToken = await getIdToken();
      if (idToken) {
        await fetch(`/api/patients/${patient.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
        }).catch(() => {});
      }
    }
    setPatients((prev) => prev.filter((p) => getPatientKey(p) !== targetKey));
  };

  const handleBatchUpsertPatients = async (
    items: Array<{ matchedExistingKey?: string; patient: PatientCRF }>
  ): Promise<{ updatedCount: number; createdCount: number; savedPatients: PatientCRF[] }> => {
    const updatesByKey = new Map<string, PatientCRF>();
    const creates: PatientCRF[] = [];

    for (const item of items) {
      const stamped = recalculatePatientCRF({
        ...item.patient,
        investigatorName: item.patient.investigatorName || activeUser?.displayName || '',
        investigatorEmail: item.patient.investigatorEmail || activeUser?.email || '',
        createdByUid: item.patient.createdByUid || activeUser?.uid || '',
        verifiedAt: item.patient.verifiedAt || new Date().toISOString(),
      });

      if (item.matchedExistingKey) {
        updatesByKey.set(item.matchedExistingKey, stamped);
      } else {
        creates.push(stamped);
      }
    }

    const updatesList = Array.from(updatesByKey.values());
    let persistedUpdates = updatesList;
    let persistedCreates = creates;

    if (backendConnected && firebaseUser && (updatesList.length > 0 || creates.length > 0)) {
      const idToken = await getIdToken();
      if (idToken) {
        try {
          const res = await fetch('/api/patients/batch', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ creates, updates: updatesList }),
          });
          if (res.ok) {
            const data = await parseJsonSafe<{
              created?: PatientCRF[];
              updated?: PatientCRF[];
              fallbackMode?: boolean;
            }>(res);
            if (data && !data.fallbackMode) {
              if (Array.isArray(data.updated) && data.updated.length > 0) {
                persistedUpdates = data.updated.map((p) => recalculatePatientCRF(p));
              }
              if (Array.isArray(data.created) && data.created.length > 0) {
                persistedCreates = data.created.map((p) => recalculatePatientCRF(p));
              }
            }
          }
        } catch {
          // Fall back cleanly to local state + localStorage persistence
        }
      }
    }

    const savedBatch: PatientCRF[] = [...persistedUpdates, ...persistedCreates];

    setPatients((prev) => {
      let nextMaxId = prev.reduce((max, p) => Math.max(max, p.id ?? 0), 0);
      const updateMap = new Map<string, PatientCRF>();

      persistedUpdates.forEach((updatedPatient) => {
        for (const [origKey, candidate] of updatesByKey.entries()) {
          if (
            getPatientKey(candidate) === getPatientKey(updatedPatient) ||
            (updatedPatient.id && candidate.id === updatedPatient.id)
          ) {
            updateMap.set(origKey, updatedPatient);
          }
        }
      });

      const updatedPrev = prev.map((existing) => {
        const key = getPatientKey(existing);
        return updateMap.get(key) || updatesByKey.get(key) || existing;
      });

      const stampedCreates = persistedCreates.map((c) => {
        if (c.id && c.id > 0) return c;
        nextMaxId += 1;
        return { ...c, id: nextMaxId };
      });

      return [...stampedCreates, ...updatedPrev];
    });

    return {
      updatedCount: updatesByKey.size,
      createdCount: persistedCreates.length,
      savedPatients: savedBatch,
    };
  };

  const handleUpdateInvestigatorStatus = async (
    uid: string,
    nextStatus: 'approved' | 'rejected'
  ) => {
    setTeamActionError(null);
    if (backendConnected && firebaseUser) {
      const idToken = await getIdToken();
      if (!idToken) {
        setTeamActionError('Session expired. Please sign in again to update permissions.');
        return;
      }
      const res = await fetch(`/api/team/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const errPayload = await parseJsonSafe<{ error?: string }>(res);
        setTeamActionError(errPayload?.error || 'Failed to update login permission.');
        return;
      }
      const updatedUser = await parseJsonSafe<InvestigatorUser>(res);
      if (updatedUser) {
        setInvestigators((prev) =>
          prev.map((inv) => (inv.uid === uid ? { ...inv, ...updatedUser } : inv))
        );
        return;
      }
    }
    setInvestigators((prev) =>
      prev.map((inv) => (inv.uid === uid ? { ...inv, status: nextStatus } : inv))
    );
  };

  const handleDeleteInvestigator = async (uid: string) => {
    setTeamActionError(null);
    if (backendConnected && firebaseUser) {
      const idToken = await getIdToken();
      if (!idToken) {
        setTeamActionError('Session expired. Please sign in again to delete profiles.');
        return;
      }
      const res = await fetch(`/api/team/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const errPayload = await parseJsonSafe<{ error?: string }>(res);
        setTeamActionError(errPayload?.error || 'Failed to delete login account.');
        return;
      }
    }
    setInvestigators((prev) => prev.filter((inv) => inv.uid !== uid));
  };

  const handleViewCrf = (patient: PatientCRF) => {
    setSelectedCrfKey(getPatientKey(patient));
    setActiveNav('crf');
  };

  const pendingTeamRequests = useMemo(
    () => getPendingApprovalRequests(investigators, impersonatedUser ? null : currentUser),
    [investigators, currentUser, impersonatedUser]
  );

  const pendingBannerSig = useMemo(
    () => pendingTeamRequests.map((u) => u.uid).sort().join(','),
    [pendingTeamRequests]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const baseTitle = 'Desai T2DM Phenotype Study Portal';
    if (isInvestigator && !impersonatedUser && pendingTeamRequests.length > 0) {
      document.title = `(${pendingTeamRequests.length} Pending) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [isInvestigator, impersonatedUser, pendingTeamRequests.length]);

  // Fire browser desktop notification when a brand-new pending request arrives while open
  useEffect(() => {
    if (!isInvestigator || impersonatedUser) {
      previousPendingUidsRef.current = null;
      return;
    }

    const newlyArrived = detectNewPendingRequests(
      previousPendingUidsRef.current,
      pendingTeamRequests
    );
    previousPendingUidsRef.current = new Set(pendingTeamRequests.map((u) => u.uid));

    if (
      newlyArrived.length > 0 &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      window.Notification.permission === 'granted'
    ) {
      const first = newlyArrived[0];
      const title =
        newlyArrived.length === 1
          ? `New Login Request: ${first.displayName || first.email}`
          : `${newlyArrived.length} New Login Approval Requests`;
      const body =
        newlyArrived.length === 1
          ? `${first.email} is waiting for investigator approval to enter Desai T2DM Study Portal.`
          : 'Open Team Access in Desai T2DM Study Portal to approve or reject pending requests.';
      try {
        const note = new window.Notification(title, {
          body,
          tag: 'desai-t2dm-pending-requests',
        });
        note.onclick = () => {
          window.focus();
          setTeamInitialFilter('pending');
          setActiveNav('team');
          note.close();
        };
      } catch {
        // ignore environments where Notification constructor is restricted
      }
    }
  }, [isInvestigator, impersonatedUser, pendingTeamRequests]);

  useEffect(() => {
    if (!bellOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (bellContainerRef.current && !bellContainerRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBellOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [bellOpen]);

  const handleEnableDesktopNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await window.Notification.requestPermission();
      setNotificationPermission(perm);
    } catch {
      // ignore permission prompt cancellation
    }
  };

  // Global quick search filter when typing in top header search bar (scoped by user role)
  const globalMatchedPatients = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return scopedPatients;
    return scopedPatients.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        p.uhid.toLowerCase().includes(q)
    );
  }, [scopedPatients, globalSearch]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F6F9F7] flex items-center justify-center text-sm text-[#4B6157]">
        Loading clinical study portal...
      </div>
    );
  }

  if (!activeUser) {
    return (
      <LoginGate
        onGoogleSignIn={handleGoogleSignIn}
        onNormalLogin={handleNormalLogin}
        onRetryPendingCheck={handleRetryPendingCheck}
        loading={authLoading}
        error={authError}
        pendingApprovalUser={pendingUser}
        onLogout={handleLogout}
      />
    );
  }

  const effectiveNav: NavSection = canAccessNavSection(activeNav, activeUser)
    ? activeNav
    : 'dashboard';

  return (
    <div className="min-h-screen bg-[#F6F9F7] bg-[radial-gradient(ellipse_at_top_right,_rgba(4,120,87,0.06),_transparent_55%)] flex flex-col lg:flex-row">
      <Sidebar
        activeNav={effectiveNav}
        onSelectNav={(nav) => {
          if (!canAccessNavSection(nav, activeUser)) return;
          if (nav === 'new-patient') {
            startNewPatient();
          } else {
            if (nav === 'team') {
              setTeamInitialFilter(pendingTeamRequests.length > 0 ? 'pending' : 'all');
            }
            setActiveNav(nav);
          }
        }}
        userName={activeUser.displayName || 'Investigator'}
        userEmail={activeUser.email}
        userRole={activeUser.role}
        userStatus={activeUser.status}
        isPreviewMode={previewMode && !firebaseUser}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onToggleMobile={() => setMobileMenuOpen((v) => !v)}
        desktopMode={sidebarMode}
        onChangeDesktopMode={handleChangeSidebarMode}
        pendingApprovalCount={pendingTeamRequests.length}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-20 no-print">
          {impersonatedUser && (
            <div className="bg-[#053B2B] text-white px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-800">
              <div className="flex items-center gap-2 text-xs">
                <UserCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>
                  Entered Account:{' '}
                  <strong className="font-semibold">
                    {impersonatedUser.displayName || impersonatedUser.email}
                  </strong>{' '}
                  <span className="text-emerald-200/90">({impersonatedUser.email})</span>
                </span>
              </div>
              <button
                type="button"
                onClick={handleExitUserAccount}
                className="px-3 py-1 rounded-lg bg-white text-[#053B2B] hover:bg-emerald-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Investigator Account</span>
              </button>
            </div>
          )}

          {/* Top Utility Header matching layout */}
          <header className="bg-white/85 backdrop-blur-md border-b border-[#DDE8E2] px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_1px_12px_-6px_rgba(5,59,43,0.12)]">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {sidebarMode === 'hidden' && (
              <button
                type="button"
                onClick={() => handleChangeSidebarMode('expanded')}
                aria-label="Show sidebar"
                title="Show side navigation"
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-[#053B2B] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <PanelLeftOpen className="w-4 h-4 text-[#047857]" />
                <span>Show Sidebar</span>
              </button>
            )}

            {activeNav === 'dashboard' ? (
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="font-display text-base font-bold text-[#14201B] truncate">
                  Study Overview &amp; Patient Registry
                </h1>
              </div>
            ) : (
              <div className="relative flex-1 max-w-md min-w-[200px]">
                <Search className="w-4 h-4 text-[#6B8076] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Quick search patient by Name or UHID..."
                  aria-label="Global patient search"
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-[#F6F9F7] border border-[#DDE8E2] text-xs focus:outline-none focus:border-[#047857] focus:bg-white"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 ml-auto">
            {isInvestigator && !impersonatedUser && (
              <div ref={bellContainerRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setBellOpen((v) => !v);
                    if (firebaseUser && backendConnected) {
                      void refreshTeamRoster();
                    }
                  }}
                  aria-label={
                    pendingTeamRequests.length > 0
                      ? `Pending login notifications (${pendingTeamRequests.length})`
                      : 'Login approval notifications'
                  }
                  aria-expanded={bellOpen}
                  title="Login approval notifications"
                  className={`relative p-2 rounded-full border transition-colors ${
                    pendingTeamRequests.length > 0
                      ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'border-[#DDE8E2] bg-white text-[#053B2B] hover:bg-[#EFF5F1]'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {pendingTeamRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums shadow-sm">
                      {pendingTeamRequests.length}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div
                    role="dialog"
                    aria-label="Approval notifications"
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#D4E2DA] rounded-2xl shadow-xl z-40 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-[#F6F9F7] border-b border-[#E5EEE9] flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-[#14201B]">
                          Login Approval Requests
                        </div>
                        <div className="text-[11px] text-[#4B6157]">
                          {pendingTeamRequests.length === 0
                            ? 'No pending requests right now'
                            : `${pendingTeamRequests.length} awaiting investigator approval`}
                        </div>
                      </div>
                      {notificationPermission === 'default' && (
                        <button
                          type="button"
                          onClick={() => void handleEnableDesktopNotifications()}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#D4E2DA] hover:bg-[#EFF5F1] text-[11px] font-semibold text-[#047857] whitespace-nowrap"
                        >
                          Enable Alerts
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-[#EEF3F0]">
                      {pendingTeamRequests.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-[#6B8076]">
                          All login requests have been reviewed.
                        </div>
                      ) : (
                        pendingTeamRequests.map((req) => (
                          <div key={req.uid} className="px-4 py-3 space-y-2">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#14201B] truncate">
                                {req.displayName || req.email}
                              </div>
                              <div className="text-[11px] font-mono text-[#4B6157] truncate">
                                {req.email} ·{' '}
                                {req.role === 'normal' ? 'User Login' : 'Investigator'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleUpdateInvestigatorStatus(req.uid, 'approved')
                                }
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleUpdateInvestigatorStatus(req.uid, 'rejected')
                                }
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-[11px] font-semibold inline-flex items-center justify-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="px-4 py-2.5 bg-[#FAFDFB] border-t border-[#E5EEE9] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBellOpen(false);
                          setTeamInitialFilter(
                            pendingTeamRequests.length > 0 ? 'pending' : 'all'
                          );
                          setActiveNav('team');
                        }}
                        className="text-xs font-semibold text-[#047857] hover:underline"
                      >
                        Open Team Access
                      </button>
                      <button
                        type="button"
                        onClick={() => setBellOpen(false)}
                        className="text-xs text-[#6B8076] hover:text-[#14201B]"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setVoiceModalOpen(true)}
              className="px-3 sm:px-3.5 py-2 rounded-full border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-[#053B2B] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Mic className="w-3.5 h-3.5 text-[#047857]" />
              <span>Voice Conversation</span>
            </button>

            {activeNav !== 'dashboard' && activeNav !== 'new-patient' && (
              <button
                type="button"
                onClick={startNewPatient}
                className="px-3.5 sm:px-4 py-2 rounded-full bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New patient</span>
              </button>
            )}

            <div className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border border-[#DDE8E2] bg-white shrink-0">
              {activeUser.photoUrl ? (
                <img
                  src={activeUser.photoUrl}
                  alt={activeUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#053B2B] text-white text-[10px] font-bold flex items-center justify-center">
                  {(activeUser.displayName || 'BD').slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-[#14201B] whitespace-nowrap">
                {(() => {
                  const parts = (activeUser.displayName || 'User').trim().split(/\s+/);
                  if (parts.length >= 2 && /^(dr|prof|mr|mrs|ms)\.?$/i.test(parts[0])) {
                    return `${parts[0]} ${parts[1]}`;
                  }
                  return parts[0];
                })()}
              </span>
              <span className="text-[10px] font-mono font-semibold text-[#047857] border-l border-[#DDE8E2] pl-2 whitespace-nowrap">
                {isInvestigator ? 'Investigator' : 'User'}
              </span>
            </div>
          </div>
          </header>
        </div>

        {/* Main Workspace Canvas */}
        <main className="flex-1 p-5 md:p-6 max-w-[1440px] w-full mx-auto">
          {isInvestigator &&
            !impersonatedUser &&
            pendingTeamRequests.length > 0 &&
            effectiveNav !== 'team' &&
            dismissedPendingBannerSig !== pendingBannerSig && (
              <section
                aria-label="Pending login approval requests"
                className="mb-5 bg-amber-50/90 border border-amber-300 rounded-2xl p-4 shadow-sm no-print"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-[#14201B]">
                          {pendingTeamRequests.length}{' '}
                          {pendingTeamRequests.length === 1
                            ? 'New Login Approval Request'
                            : 'Pending Login Approval Requests'}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-200/80 text-amber-900">
                          Permission Required
                        </span>
                      </div>
                      <p className="text-xs text-[#4B6157] mt-0.5">
                        Approve or reject new sign-ins before they can enter the study portal.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setTeamInitialFilter('pending');
                        setActiveNav('team');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/70 text-xs font-semibold text-[#14201B] transition-colors whitespace-nowrap"
                    >
                      Review in Team Access
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedPendingBannerSig(pendingBannerSig)}
                      aria-label="Dismiss approval notification temporarily"
                      title="Dismiss notification"
                      className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-200/60 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {teamActionError && (
                  <p role="alert" className="mt-2.5 text-xs text-red-700 font-medium">
                    {teamActionError}
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  {pendingTeamRequests.slice(0, 3).map((req) => (
                    <div
                      key={req.uid}
                      className="bg-white border border-amber-200/90 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#14201B] truncate">
                          {req.displayName || req.email}{' '}
                          <span className="text-[11px] font-medium text-amber-800">
                            · {req.role === 'normal' ? 'User Login' : 'Investigator Login'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#4B6157] truncate">
                          {req.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleUpdateInvestigatorStatus(req.uid, 'approved')}
                          aria-label={`Approve ${req.displayName || req.email}`}
                          className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdateInvestigatorStatus(req.uid, 'rejected')}
                          aria-label={`Reject ${req.displayName || req.email}`}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingTeamRequests.length > 3 && (
                    <div className="text-[11px] font-medium text-amber-900 pl-1">
                      +{pendingTeamRequests.length - 3} more pending requests in Team Access.
                    </div>
                  )}
                </div>
              </section>
            )}

          <div key={effectiveNav} className="view-enter">
            {effectiveNav === 'dashboard' && (
              <DashboardView
                patients={globalMatchedPatients}
                isInvestigator={isInvestigator}
                userName={activeUser.displayName}
                onNewPatient={startNewPatient}
                onEditPatient={(p, tab) => startEditPatient(p, tab || 'info')}
                onViewCRF={handleViewCrf}
                onDeletePatient={handleDeletePatient}
              />
            )}

            {effectiveNav === 'new-patient' && (
              <ClinicalCollectionView
                key={`${editingOriginalKey || 'new'}-${formInitialTab}`}
                crf={draftCrf}
                existingParticipantIds={patients.map((p) => p.participantId)}
                isEditing={Boolean(editingOriginalKey)}
                initialTab={formInitialTab}
                onUpdateCrf={setDraftCrf}
                onSavePatient={handleSavePatient}
                onCancel={() => setActiveNav('dashboard')}
              />
            )}

            {effectiveNav === 'data' && (
              <SubmittedDataView
                patients={globalMatchedPatients}
                isInvestigator={isInvestigator}
                initialContributorFilter={selectedContributorFilter}
                accessToken={accessToken ?? getAccessToken()}
                onRequestGoogleSignIn={() => handleGoogleSignIn('investigator')}
                onEditPatient={(p, tab) => startEditPatient(p, tab || 'info')}
                onViewCRF={handleViewCrf}
                onDeletePatient={handleDeletePatient}
              />
            )}

            {effectiveNav === 'crf' && (
              <CRFViewer
                patients={scopedPatients}
                selectedParticipantId={selectedCrfKey}
                onSelectParticipant={setSelectedCrfKey}
                onEditInCollectionForm={(p) => startEditPatient(p, 'info')}
                onUpdatePatientInline={handleInlinePatientUpdate}
              />
            )}

            {effectiveNav === 'patient-profile' && (
              <PatientProfileView
                patients={scopedPatients}
                selectedParticipantId={selectedCrfKey}
                onSelectParticipant={setSelectedCrfKey}
                onViewCRF={handleViewCrf}
                onEditPatient={(p) => startEditPatient(p, 'info')}
                onNewPatient={startNewPatient}
              />
            )}

            {effectiveNav === 'patient-documents' && (
              <PatientDocumentsView
                patients={globalMatchedPatients}
                selectedParticipantId={selectedCrfKey}
                onSelectParticipant={setSelectedCrfKey}
                onUpdatePatientInline={handleInlinePatientUpdate}
                onOpenProfile={(p) => {
                  setSelectedCrfKey(getPatientKey(p));
                  setActiveNav('patient-profile');
                }}
                onViewCRF={handleViewCrf}
                onEditPatient={(p) => startEditPatient(p, 'info')}
                onNewPatient={startNewPatient}
              />
            )}

            {effectiveNav === 'statistics' && (
              <StatisticalAnalysisView patients={scopedPatients} onNewPatient={startNewPatient} />
            )}

            {effectiveNav === 'ai' && (
              <AIWorkspaceView
                patients={scopedPatients}
                accessToken={accessToken ?? getAccessToken()}
                activeUser={{
                  displayName: activeUser.displayName,
                  email: activeUser.email,
                  uid: activeUser.uid,
                }}
                onRequestGoogleSignIn={() => handleGoogleSignIn('investigator')}
                onUpdatePatientInline={handleInlinePatientUpdate}
                onBatchUpsertPatients={handleBatchUpsertPatients}
                onCreatePatientFromReport={(draftFromReport) => {
                  setEditingOriginalKey(null);
                  setDraftCrf(
                    recalculatePatientCRF({
                      ...draftFromReport,
                      investigatorName: draftFromReport.investigatorName || activeUser?.displayName || '',
                      investigatorEmail:
                        draftFromReport.investigatorEmail || activeUser?.email || '',
                      createdByUid: activeUser?.uid || '',
                    })
                  );
                  setFormInitialTab('labs');
                  setActiveNav('new-patient');
                }}
                onViewCRF={handleViewCrf}
                onNavigateToData={() => setActiveNav('data')}
              />
            )}

            {effectiveNav === 'team' && isInvestigator && (
              <TeamAccessView
                investigators={investigators}
                patients={patients}
                currentUserUid={activeUser.uid}
                currentUserRole={activeUser.role}
                initialFilter={teamInitialFilter}
                onUpdateStatus={handleUpdateInvestigatorStatus}
                onDeleteMember={handleDeleteInvestigator}
                onInspectParticipantRecords={(email) => {
                  setSelectedContributorFilter(email);
                  setActiveNav('data');
                }}
                onEnterUserAccount={handleEnterUserAccount}
                onRefreshTeam={refreshTeamRoster}
                isRefreshing={teamRefreshing}
                actionError={teamActionError}
              />
            )}
          </div>
        </main>
      </div>

      {voiceModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Voice Conversation"
        >
          <div className="modal-pop-in bg-white border border-[#DDE8E2] rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#14201B]">
                  Voice Conversation
                </h2>
                <p className="text-xs text-[#4B6157]">
                  Bidirectional clinical voice assistant for cohort phenotyping, Blue Index, DDS-17, and CRFs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVoiceModalOpen(false)}
                aria-label="Close voice conversation"
                className="p-1.5 rounded-lg hover:bg-[#F6F9F7] text-[#4B6157] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <LiveVoicePanel patients={scopedPatients} compact />
          </div>
        </div>
      )}
    </div>
  );
}
