import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Clock,
  LogIn,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { InvestigatorUser, PatientCRF } from '../types/clinical';
import { canApproveTargetUser, summarizeLoginParticipants } from '../utils/accessControl';
import { DoubleConfirmDeleteModal } from './DoubleConfirmDeleteModal';

export type TeamRoleFilter = 'all' | 'investigators' | 'normal' | 'pending';

interface TeamAccessViewProps {
  investigators: InvestigatorUser[];
  patients: PatientCRF[];
  currentUserUid: string;
  currentUserRole: InvestigatorUser['role'];
  initialFilter?: TeamRoleFilter;
  onUpdateStatus: (uid: string, nextStatus: 'approved' | 'rejected') => Promise<void>;
  onDeleteMember: (uid: string) => Promise<void> | void;
  onInspectParticipantRecords: (email: string) => void;
  onEnterUserAccount: (user: InvestigatorUser) => void;
  onRefreshTeam?: () => Promise<void> | void;
  isRefreshing?: boolean;
  actionError?: string | null;
}

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-800',
  'bg-teal-100 text-teal-800',
  'bg-slate-200 text-slate-700',
  'bg-lime-100 text-lime-800',
  'bg-amber-100 text-amber-800',
];

function getInitials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export const TeamAccessView: React.FC<TeamAccessViewProps> = ({
  investigators,
  patients,
  currentUserUid,
  currentUserRole,
  initialFilter = 'all',
  onUpdateStatus,
  onDeleteMember,
  onInspectParticipantRecords,
  onEnterUserAccount,
  onRefreshTeam,
  isRefreshing = false,
  actionError = null,
}) => {
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<InvestigatorUser | null>(null);
  const [roleFilter, setRoleFilter] = useState<TeamRoleFilter>(initialFilter);
  const [mutatingUid, setMutatingUid] = useState<string | null>(null);

  useEffect(() => {
    setRoleFilter(initialFilter);
  }, [initialFilter]);

  const summaries = useMemo(
    () => summarizeLoginParticipants(investigators, patients),
    [investigators, patients]
  );

  const allInvestigatorsCount = summaries.filter(
    (s) => s.user.role === 'owner' || s.user.role === 'researcher'
  ).length;
  const approvedInvestigatorsCount = summaries.filter(
    (s) => s.user.role === 'owner' || (s.user.role === 'researcher' && s.user.status === 'approved')
  ).length;
  const approvedNormalCount = summaries.filter(
    (s) => s.user.role === 'normal' && s.user.status === 'approved'
  ).length;
  const pendingCount = summaries.filter((s) => s.user.status === 'pending').length;
  const pendingOrRevokedCount = summaries.filter(
    (s) => s.user.role !== 'owner' && s.user.status !== 'approved'
  ).length;
  const normalLoginsCount = summaries.filter((s) => s.user.role === 'normal').length;

  const visibleSummaries = useMemo(() => {
    if (roleFilter === 'investigators') {
      return summaries.filter((s) => s.user.role === 'owner' || s.user.role === 'researcher');
    }
    if (roleFilter === 'normal') {
      return summaries.filter((s) => s.user.role === 'normal');
    }
    if (roleFilter === 'pending') {
      return summaries.filter((s) => s.user.status === 'pending');
    }
    return summaries;
  }, [summaries, roleFilter]);

  const handleStatusChange = async (uid: string, nextStatus: 'approved' | 'rejected') => {
    setMutatingUid(uid);
    try {
      await onUpdateStatus(uid, nextStatus);
    } finally {
      setMutatingUid(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#047857]">
            TEAM &amp; LOGIN PARTICIPANTS
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[#14201B] mt-0.5">
            Investigators &amp; Login Profiles
          </h2>
          <p className="text-sm text-[#4B6157] mt-1">
            Approve or deny pending login requests before new users can enter the study portal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefreshTeam && (
            <button
              type="button"
              onClick={() => onRefreshTeam()}
              disabled={isRefreshing}
              aria-label="Refresh login requests"
              className="px-3 py-2 rounded-xl border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-xs font-semibold text-[#053B2B] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#047857] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          )}

          <div
            className="inline-flex flex-wrap items-center p-1 bg-white border border-[#DDE8E2] rounded-xl gap-1"
            role="tablist"
            aria-label="Filter login participants"
          >
            <button
              type="button"
              role="tab"
              aria-selected={roleFilter === 'all'}
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                roleFilter === 'all'
                  ? 'bg-[#047857] text-white'
                  : 'text-[#4B6157] hover:text-[#14201B]'
              }`}
            >
              All Logins ({summaries.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={roleFilter === 'investigators'}
              onClick={() => setRoleFilter('investigators')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                roleFilter === 'investigators'
                  ? 'bg-[#047857] text-white'
                  : 'text-[#4B6157] hover:text-[#14201B]'
              }`}
            >
              Investigators ({allInvestigatorsCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={roleFilter === 'normal'}
              onClick={() => setRoleFilter('normal')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                roleFilter === 'normal'
                  ? 'bg-[#047857] text-white'
                  : 'text-[#4B6157] hover:text-[#14201B]'
              }`}
            >
              User Logins ({normalLoginsCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={roleFilter === 'pending'}
              onClick={() => setRoleFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                roleFilter === 'pending'
                  ? 'bg-amber-600 text-white'
                  : pendingCount > 0
                  ? 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                  : 'text-[#4B6157] hover:text-[#14201B]'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Pending ({pendingCount})</span>
            </button>
          </div>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Oversight KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#DDE8E2] rounded-xl px-4 py-3">
          <div className="text-xs text-[#4B6157]">Total Login Accounts</div>
          <div className="font-mono text-xl font-bold text-[#14201B] tabular-nums mt-0.5">
            {summaries.length}
          </div>
          <div className="text-[11px] text-[#6B8076] mt-0.5">
            {approvedInvestigatorsCount}{' '}
            {approvedInvestigatorsCount === 1 ? 'investigator' : 'investigators'} ·{' '}
            {approvedNormalCount} approved {approvedNormalCount === 1 ? 'user' : 'users'}
            {pendingOrRevokedCount > 0 ? ` · ${pendingOrRevokedCount} pending/revoked` : ''}
          </div>
        </div>
        <div className="bg-white border border-[#DDE8E2] rounded-xl px-4 py-3">
          <div className="text-xs text-[#4B6157]">Total Cohort Patient CRFs</div>
          <div className="font-mono text-xl font-bold text-[#047857] tabular-nums mt-0.5">
            {patients.length}
          </div>
          <div className="text-[11px] text-[#6B8076] mt-0.5">
            Accessible in full by investigators
          </div>
        </div>
        <div
          className={`border rounded-xl px-4 py-3 ${
            pendingCount > 0
              ? 'bg-amber-50/70 border-amber-300'
              : 'bg-white border-[#DDE8E2]'
          }`}
        >
          <div className="text-xs text-[#4B6157]">Awaiting Permission</div>
          <div className="font-mono text-xl font-bold text-amber-700 tabular-nums mt-0.5">
            {pendingCount}
          </div>
          <div className="text-[11px] text-[#6B8076] mt-0.5">
            {pendingCount === 0
              ? 'All active requests reviewed'
              : 'Requires investigator approval to enter portal'}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#DDE8E2] rounded-2xl divide-y divide-[#EEF3F0] overflow-hidden">
        {visibleSummaries.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[#4B6157]">
            <Users className="w-6 h-6 text-[#6B8076] mx-auto mb-2" />
            No login participants match this filter yet.
          </div>
        ) : (
          visibleSummaries.map((entry, idx) => {
            const person = entry.user;
            const isApproved = person.status === 'approved';
            const isPending = person.status === 'pending';
            const isOwner = person.role === 'owner';
            const isSelf = person.uid === currentUserUid;
            const tone = AVATAR_TONES[idx % AVATAR_TONES.length];
            const canApproveOrRevoke = canApproveTargetUser(currentUserRole, person);
            const canDelete = canApproveTargetUser(currentUserRole, person);
            const canEnterAccount = !isSelf && isApproved;
            const isMutating = mutatingUid === person.uid;

            const identityContent = (
              <>
                {person.photoUrl ? (
                  <img
                    src={person.photoUrl}
                    alt={person.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#DDE8E2]"
                  />
                ) : (
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${tone}`}
                  >
                    {getInitials(person.displayName, person.email)}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-semibold text-[#14201B] truncate ${
                        canEnterAccount ? 'group-hover:text-[#047857] transition-colors' : ''
                      }`}
                    >
                      {person.displayName || person.email}
                    </span>
                    <span className="text-[11px] font-medium text-[#047857]">
                      · {entry.roleLabel}
                    </span>
                  </div>
                  <div className="text-xs text-[#6B8076] truncate">
                    {person.email}
                    {entry.lastActivityAt && (
                      <>
                        {' '}
                        · Active {entry.lastActivityAt.slice(0, 10)}
                      </>
                    )}
                  </div>
                </div>
              </>
            );

            return (
              <div
                key={person.uid}
                className={`px-5 py-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                  isPending
                    ? 'bg-amber-50/45 border-l-4 border-l-amber-500'
                    : canEnterAccount
                    ? 'hover:bg-[#F3FAF6]'
                    : 'bg-[#FAFDFB]'
                }`}
              >
                {canEnterAccount ? (
                  <button
                    type="button"
                    onClick={() => onEnterUserAccount(person)}
                    title={`Click to enter ${person.displayName || person.email}'s account`}
                    aria-label={`Enter profile for ${person.displayName || person.email}`}
                    className="flex items-center gap-3.5 min-w-0 flex-1 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#047857] cursor-pointer group"
                  >
                    {identityContent}
                  </button>
                ) : (
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {identityContent}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <span className="font-mono text-xs font-semibold text-[#14201B] tabular-nums px-2.5 py-1 rounded-lg bg-[#F6F9F7] border border-[#DDE8E2]">
                    {entry.patientCount} {entry.patientCount === 1 ? 'patient' : 'patients'}
                  </span>

                  {canEnterAccount && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnterUserAccount(person);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#053B2B] hover:bg-[#047857] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Enter Account</span>
                    </button>
                  )}

                  {entry.patientCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectParticipantRecords(person.email);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-[#DDE8E2] bg-white hover:bg-[#ECFDF5] hover:text-[#047857] hover:border-[#BFD5C9] text-xs font-semibold text-[#14201B] inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>View Records</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      isApproved
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isPending
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {person.status}
                  </span>

                  {canApproveOrRevoke ? (
                    isApproved ? (
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(person.uid, 'rejected');
                        }}
                        className="px-3.5 py-1.5 rounded-xl border border-[#DDE8E2] bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-medium text-[#14201B] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(person.uid, 'approved');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        {isPending && (
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(person.uid, 'rejected');
                            }}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    !isOwner &&
                    isPending && (
                      <span className="text-[11px] text-[#6B8076] italic whitespace-nowrap">
                        Owner approval needed
                      </span>
                    )
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteUser(person);
                      }}
                      aria-label={`Delete ${person.displayName || person.email}`}
                      title="Delete login account"
                      className="px-2.5 py-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <DoubleConfirmDeleteModal
        open={Boolean(confirmDeleteUser)}
        title="Delete Login Account?"
        itemName={confirmDeleteUser?.displayName || confirmDeleteUser?.email || ''}
        itemMeta={confirmDeleteUser?.email}
        description="This removes the account from Team & Login Participants and revokes their portal access."
        confirmLabel="Yes, Delete Account"
        onCancel={() => setConfirmDeleteUser(null)}
        onConfirm={async () => {
          if (!confirmDeleteUser) return;
          await onDeleteMember(confirmDeleteUser.uid);
          setConfirmDeleteUser(null);
        }}
      />
    </div>
  );
};
