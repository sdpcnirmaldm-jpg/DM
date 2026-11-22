import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import type { StatusColor } from '../types/clinical';

export interface StatusLegendEntry {
  color: StatusColor;
  tagLabel: string;
  clinicalState: string;
  dotClass: string;
  badgeClass: string;
  filterValue: 'Complete' | 'ReportPending' | 'MultiplePending';
  description: string;
}

export const STATUS_LEGEND_ENTRIES: StatusLegendEntry[] = [
  {
    color: 'green',
    tagLabel: 'Enrolled · Complete',
    clinicalState: '0 pending',
    dotClass: 'bg-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    filterValue: 'Complete',
    description:
      'Participant is fully enrolled with all baseline demographics, vitals, lab panel, FibroScan, C-peptide/HOMA, and follow-up 2nd HbA1c completed.',
  },
  {
    color: 'yellow',
    tagLabel: '2nd HbA1c Pending',
    clinicalState: '1 pending',
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    filterValue: 'ReportPending',
    description:
      'Enrolled with complete baseline CRF and diagnostic workup; only the follow-up (2nd) HbA1c value is awaited.',
  },
  {
    color: 'orange',
    tagLabel: 'Reports Pending',
    clinicalState: '1–3 reports',
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    filterValue: 'ReportPending',
    description:
      'Baseline enrollment recorded; awaiting specialty investigation reports (2nd HbA1c, FibroScan LSM/CAP, or C-peptide beta-cell assay).',
  },
  {
    color: 'red',
    tagLabel: 'Multiple Pending',
    clinicalState: 'Action needed',
    dotClass: 'bg-red-600',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    filterValue: 'MultiplePending',
    description:
      'Provisional enrollment with multiple required CRF sections pending (demographics, anthropometry, blood tests, medications, or DDS-17).',
  },
];

interface StatusLegendProps {
  activeStatusFilter?: string;
  onSelectStatusFilter?: (filterValue: string) => void;
  selectedDate?: string | null;
  onClearDate?: () => void;
}

export const StatusLegend: React.FC<StatusLegendProps> = ({
  activeStatusFilter,
  onSelectStatusFilter,
  selectedDate,
  onClearDate,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-label="Patient status tag legend"
      className="bg-white border border-[#DDE8E2] rounded-2xl px-4 py-2.5 space-y-2.5 shadow-[0_2px_12px_-8px_rgba(5,59,43,0.12)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {!expanded ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#4B6157]">
            {STATUS_LEGEND_ENTRIES.map((entry) => {
              const isActive = activeStatusFilter === entry.filterValue;
              return (
                <button
                  key={entry.color}
                  type="button"
                  onClick={() =>
                    onSelectStatusFilter?.(isActive ? 'FollowupDate' : entry.filterValue)
                  }
                  title={entry.description}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#EFF7F3] text-[#053B2B] font-semibold'
                      : 'hover:bg-[#F6F9F7] text-[#354A41]'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${entry.dotClass}`} />
                  <span>{entry.tagLabel}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-[#14201B]">
            <Info className="w-3.5 h-3.5 text-[#047857] shrink-0" />
            <span>Patient Status Tag Guide</span>
            <span className="text-[11px] font-normal text-[#6B8076] hidden sm:inline">
              — Explains enrollment completeness &amp; pending follow-up tags
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 ml-auto">
          {selectedDate && onClearDate && (
            <button
              type="button"
              onClick={onClearDate}
              className="text-xs font-medium text-[#047857] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Date Filter: {selectedDate}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="text-xs font-medium text-[#4B6157] hover:text-[#14201B] inline-flex items-center gap-1 whitespace-nowrap"
          >
            <span>{expanded ? 'Collapse legend' : 'Status guide'}</span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 view-enter">
          {STATUS_LEGEND_ENTRIES.map((entry) => {
            const isActive = activeStatusFilter === entry.filterValue;
            return (
              <button
                key={entry.color}
                type="button"
                onClick={() =>
                  onSelectStatusFilter?.(isActive ? 'FollowupDate' : entry.filterValue)
                }
                className={`card-elevate text-left rounded-xl border p-2.5 transition-colors ${
                  isActive
                    ? 'border-[#047857] bg-[#F2F7F4]'
                    : 'border-[#EEF3F0] bg-[#FAFDFB] hover:border-[#BFD5C9]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14201B]">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${entry.dotClass}`} />
                    <span>{entry.tagLabel}</span>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap ${entry.badgeClass}`}
                  >
                    {entry.clinicalState}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-[#4B6157]">
                  {entry.description}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
