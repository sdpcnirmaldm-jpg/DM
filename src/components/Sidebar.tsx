import React from 'react';
import {
  LayoutDashboard,
  UserPlus,
  Table2,
  FileText,
  HeartPulse,
  BarChart3,
  Sparkles,
  Users,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  EyeOff,
  FolderOpen,
} from 'lucide-react';

import type { InvestigatorUser } from '../types/clinical';
import { canAccessNavSection } from '../utils/accessControl';
import type { SidebarDesktopMode } from '../utils/sidebarState';

export type NavSection =
  | 'dashboard'
  | 'new-patient'
  | 'data'
  | 'crf'
  | 'patient-profile'
  | 'patient-documents'
  | 'statistics'
  | 'ai'
  | 'team';

interface SidebarProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  userEmail: string;
  userName: string;
  userRole: InvestigatorUser['role'];
  userStatus?: InvestigatorUser['status'];
  isPreviewMode: boolean;
  onLogout: () => void;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  desktopMode?: SidebarDesktopMode;
  onChangeDesktopMode?: (mode: SidebarDesktopMode) => void;
  pendingApprovalCount?: number;
}

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new-patient', label: 'New Patient', icon: UserPlus },
  { id: 'data', label: 'Data', icon: Table2 },
  { id: 'crf', label: 'CRF', icon: FileText },
  { id: 'patient-profile', label: 'Patient Profile', icon: HeartPulse },
  { id: 'patient-documents', label: 'Patient Documents', icon: FolderOpen },
  { id: 'statistics', label: 'Statistical Analysis', icon: BarChart3 },
  { id: 'ai', label: 'AI Analysis', icon: Sparkles },
  { id: 'team', label: 'Team Access', icon: Users },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onSelectNav,
  userName,
  userEmail,
  userRole,
  userStatus = 'approved',
  isPreviewMode,
  onLogout,
  mobileOpen,
  onToggleMobile,
  desktopMode = 'expanded',
  onChangeDesktopMode,
  pendingApprovalCount = 0,
}) => {
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    canAccessNavSection(item.id, { role: userRole, status: userStatus })
  );
  const isMinimized = desktopMode === 'minimized';
  const isHidden = desktopMode === 'hidden';
  const initials = (userName || 'BD')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'BD';

  const desktopWidthClass = isHidden
    ? 'lg:w-0 lg:min-w-0 lg:opacity-0 lg:invisible lg:pointer-events-none lg:shadow-none'
    : isMinimized
    ? 'lg:w-[76px]'
    : 'lg:w-[256px]';

  return (
    <>
      {/* Mobile Header Trigger */}
      <div className="lg:hidden flex items-center justify-between bg-gradient-to-r from-[#053B2B] to-[#042F22] text-white px-4 py-3 sticky top-0 z-30 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-lg px-2 py-1">
            <img
              src="/assets/aistudio/Screenshot_20261114-122005-display-0.png_b2588ec0.png"
              alt="Desai Diabetes & Endocrine Clinic"
              referrerPolicy="no-referrer"
              className="h-7 w-auto object-contain"
            />
          </div>
          <span className="font-display font-semibold text-sm whitespace-nowrap">
            T2DM Phenotype Study
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleMobile}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-lg hover:bg-emerald-900/60"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop on mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onToggleMobile}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Rail — pinned on desktop so scrolling main content never scrolls the sidebar */}
      <aside
        data-desktop-mode={desktopMode}
        className={`fixed inset-y-0 left-0 z-40 w-[256px] lg:sticky lg:top-0 lg:h-screen ${desktopWidthClass} shrink-0 bg-gradient-to-b from-[#053B2B] via-[#043426] to-[#022319] text-white flex flex-col justify-between transition-all duration-200 overflow-x-hidden no-print shadow-[4px_0_24px_-16px_rgba(5,59,43,0.45)] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Clinic Logo & Desktop Controls */}
        <div className="shrink-0 border-b border-emerald-900/70">
          {/* Expanded Header (always shown on mobile drawer; shown on desktop when expanded) */}
          <div className={`${isMinimized ? 'lg:hidden' : ''} p-3.5 space-y-2.5`}>
            <div className="hidden lg:flex items-center justify-between gap-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-emerald-300/75 pl-1">
                Navigation
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChangeDesktopMode?.('minimized')}
                  aria-label="Minimize sidebar"
                  title="Minimize sidebar"
                  className="p-1.5 rounded-lg text-emerald-200/85 hover:text-white hover:bg-emerald-900/60 transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onChangeDesktopMode?.('hidden')}
                  aria-label="Hide sidebar"
                  title="Hide sidebar"
                  className="p-1.5 rounded-lg text-emerald-200/85 hover:text-white hover:bg-emerald-900/60 transition-colors"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-[#F2FBF6] rounded-xl p-2.5 flex items-center justify-center shadow-sm transition-transform duration-200 hover:scale-[1.015]">
              <img
                src="/assets/aistudio/Screenshot_20261114-122005-display-0.png_b2588ec0.png"
                alt="Desai Diabetes & Endocrine Clinic - Hormones to Harmony"
                referrerPolicy="no-referrer"
                className="h-12 w-auto object-contain"
              />
            </div>
          </div>

          {/* Minimized Header (desktop only) */}
          <div
            className={`${
              isMinimized ? 'hidden lg:flex' : 'hidden'
            } flex-col items-center gap-2 px-2 py-3`}
          >
            <div
              title="Desai Diabetes & Endocrine Clinic"
              className="w-10 h-10 rounded-xl bg-[#F2FBF6] text-[#053B2B] font-display font-bold text-xs flex items-center justify-center shadow-sm select-none"
            >
              DD
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChangeDesktopMode?.('expanded')}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="p-1.5 rounded-lg text-emerald-200/85 hover:text-white hover:bg-emerald-900/60 transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onChangeDesktopMode?.('hidden')}
                aria-label="Hide sidebar"
                title="Hide sidebar"
                className="p-1.5 rounded-lg text-emerald-200/85 hover:text-white hover:bg-emerald-900/60 transition-colors"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Independently scrollable Navigation Items */}
        <nav
          className={`flex-1 min-h-0 overflow-y-auto ${
            isMinimized ? 'p-3 lg:px-2.5 lg:py-3' : 'p-3'
          } space-y-1`}
          aria-label="Primary study navigation"
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            const hasPendingBadge = item.id === 'team' && pendingApprovalCount > 0;
            const itemLabel = hasPendingBadge
              ? `${item.label} (${pendingApprovalCount} pending)`
              : item.label;
            return (
              <button
                key={item.id}
                type="button"
                title={itemLabel}
                aria-label={itemLabel}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onSelectNav(item.id);
                  if (mobileOpen) onToggleMobile();
                }}
                className={`relative group w-full flex items-center ${
                  isMinimized
                    ? 'gap-3 lg:gap-0 lg:justify-center px-3.5 lg:px-0'
                    : 'gap-3 px-3.5'
                } py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-[#053B2B] shadow-sm font-semibold translate-x-0.5 lg:translate-x-0'
                    : 'text-emerald-100/85 hover:bg-emerald-900/55 hover:text-white hover:translate-x-0.5 lg:hover:translate-x-0'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                    isActive ? 'text-[#047857]' : 'text-emerald-300/80'
                  }`}
                />
                <span className={isMinimized ? 'lg:hidden' : ''}>{item.label}</span>
                {item.id === 'ai' && (
                  <span
                    className={`ml-auto text-[10px] font-mono font-semibold tracking-wider ${
                      isActive ? 'text-[#047857]' : 'text-emerald-300/80'
                    } ${isMinimized ? 'lg:hidden' : ''}`}
                  >
                    AI
                  </span>
                )}
                {hasPendingBadge && (
                  <>
                    <span
                      className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-mono font-bold tabular-nums ${
                        isActive
                          ? 'bg-amber-500 text-white'
                          : 'bg-amber-400 text-[#053B2B]'
                      } ${isMinimized ? 'lg:hidden' : ''}`}
                    >
                      {pendingApprovalCount}
                    </span>
                    {isMinimized && (
                      <span
                        className="hidden lg:block absolute top-1.5 right-2.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#043426]"
                        aria-hidden="true"
                      />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Investigator Footer */}
        <div className="shrink-0 p-4 border-t border-emerald-900/70">
          <div
            className={`${
              isMinimized ? 'lg:hidden' : ''
            } flex items-center justify-between gap-2 px-1`}
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-white truncate">{userName}</div>
              <div className="text-[11px] text-emerald-200/75 truncate">
                {userRole === 'normal'
                  ? `Normal Portal · ${userEmail}`
                  : isPreviewMode
                  ? 'Investigator Preview Mode'
                  : userEmail}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
              className="p-2 rounded-lg text-emerald-200 hover:bg-emerald-900/60 hover:text-white transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Minimized Footer (desktop only) */}
          <div
            className={`${
              isMinimized ? 'hidden lg:flex' : 'hidden'
            } flex-col items-center gap-2`}
          >
            <div
              title={`${userName} (${userEmail})`}
              className="w-8 h-8 rounded-full bg-emerald-800/80 border border-emerald-700/70 text-white text-[11px] font-semibold flex items-center justify-center select-none"
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
              className="p-2 rounded-lg text-emerald-200 hover:bg-emerald-900/60 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
