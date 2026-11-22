import type { AttachmentFile, PatientCRF } from '../types/clinical';
import { inferMimeType, parseDataUrl } from './aiContext';
import { getPatientKey } from './statisticalCharts';

export type DocumentKind = 'pdf' | 'image' | 'text' | 'other';
export type DocumentKindFilter = 'all' | 'pdf' | 'image' | 'other';
export type PatientRosterFilter = 'all' | 'with-docs';

export interface EnrichedPatientDocument {
  attachment: AttachmentFile;
  mimeType: string;
  kind: DocumentKind;
  sectionLabel: string;
  sizeBytes: number | null;
  sizeLabel: string;
  hasPayload: boolean;
}

export interface PatientDocumentGroup {
  patientKey: string;
  patient: PatientCRF;
  documents: EnrichedPatientDocument[];
  totalCount: number;
  pdfCount: number;
  imageCount: number;
  otherCount: number;
  latestUploadedAt: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  sectionA: 'A. Demographics & Baseline',
  sectionB: 'B. Diabetes History',
  sectionC: 'C. Social & Lifestyle',
  sectionD: 'Komplications Score (KS)',
  sectionF: 'DDS-17 Questionnaire',
  vitals: 'Measurements & Vitals',
  labGlycemic: 'Glycemic Profile (HbA1c / Glucose)',
  labBetaCell: 'Beta-Cell & HOMA Panel',
  labLipids: 'Lipid Profile',
  labHaematology: 'Haematology / CBC',
  labRenalHepatic: 'Renal & Hepatic Panel',
  labFibroScan: 'FibroScan Report',
  medications: 'Medications & Prescription',
  'glycemic-lipids': 'Glycemic & Lipid Labs',
  'patient-documents': 'Uploaded Clinical Document',
};

export function formatSectionLabel(sectionKey: string): string {
  const trimmed = (sectionKey || '').trim();
  if (!trimmed) return 'Clinical Document';
  if (SECTION_LABELS[trimmed]) return SECTION_LABELS[trimmed];
  return trimmed
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function detectDocumentKind(mimeType: string, fileName: string): DocumentKind {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(name)) {
    return 'image';
  }
  if (mime.startsWith('text/') || /\.(txt|csv|json|md|log)$/i.test(name)) {
    return 'text';
  }
  return 'other';
}

export function estimateAttachmentBytes(dataUrl?: string): number | null {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const b64 = parsed.base64Data.replace(/\s+/g, '');
  if (!b64) return 0;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

export function formatDocumentSize(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) return 'Metadata only';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '');
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return Uint8Array.from(Buffer.from(clean, 'base64'));
}

export function decodeTextDataUrl(dataUrl?: string): string | null {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  try {
    const bytes = decodeBase64ToBytes(parsed.base64Data);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

export function dataUrlToBlobUrl(dataUrl?: string, fileName?: string): string | null {
  const parsed = parseDataUrl(dataUrl, fileName);
  if (!parsed || typeof URL === 'undefined' || typeof Blob === 'undefined') return null;
  try {
    const bytes = decodeBase64ToBytes(parsed.base64Data);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: parsed.mimeType || inferMimeType(fileName) });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function enrichAttachment(att: AttachmentFile): EnrichedPatientDocument {
  const parsed = parseDataUrl(att.dataUrl, att.name);
  const mimeType = parsed?.mimeType || inferMimeType(att.name);
  const kind = detectDocumentKind(mimeType, att.name);
  const sizeBytes = estimateAttachmentBytes(att.dataUrl);
  return {
    attachment: att,
    mimeType,
    kind,
    sectionLabel: formatSectionLabel(att.section),
    sizeBytes,
    sizeLabel: formatDocumentSize(sizeBytes),
    hasPayload: Boolean(parsed),
  };
}

export interface BuildDocumentGroupsOptions {
  search?: string;
  rosterFilter?: PatientRosterFilter;
  kindFilter?: DocumentKindFilter;
}

export function buildPatientDocumentGroups(
  patients: PatientCRF[],
  options: BuildDocumentGroupsOptions = {}
): PatientDocumentGroup[] {
  const query = (options.search || '').trim().toLowerCase();
  const rosterFilter = options.rosterFilter ?? 'all';
  const kindFilter = options.kindFilter ?? 'all';

  const groups: PatientDocumentGroup[] = [];

  patients.forEach((patient, idx) => {
    const patientKey = getPatientKey(patient, idx);
    const allDocs = (patient.attachments || []).map(enrichAttachment);

    // Filter documents by kind filter
    const kindFilteredDocs =
      kindFilter === 'all'
        ? allDocs
        : allDocs.filter((d) =>
            kindFilter === 'other' ? d.kind === 'text' || d.kind === 'other' : d.kind === kindFilter
          );

    const pdfCount = allDocs.filter((d) => d.kind === 'pdf').length;
    const imageCount = allDocs.filter((d) => d.kind === 'image').length;
    const otherCount = allDocs.length - pdfCount - imageCount;

    const sortedTimestamps = allDocs
      .map((d) => d.attachment.uploadedAt)
      .filter(Boolean)
      .sort();
    const latestUploadedAt = sortedTimestamps.length
      ? sortedTimestamps[sortedTimestamps.length - 1]
      : null;

    if (rosterFilter === 'with-docs' && allDocs.length === 0) {
      return;
    }

    if (kindFilter !== 'all' && kindFilteredDocs.length === 0) {
      return;
    }

    if (query) {
      const patientMatches =
        (patient.patientName || '').toLowerCase().includes(query) ||
        (patient.uhid || '').toLowerCase().includes(query);

      const docMatches = kindFilteredDocs.filter(
        (d) =>
          d.attachment.name.toLowerCase().includes(query) ||
          d.sectionLabel.toLowerCase().includes(query) ||
          d.attachment.section.toLowerCase().includes(query)
      );

      if (!patientMatches && docMatches.length === 0) {
        return;
      }

      const visibleDocs = patientMatches ? kindFilteredDocs : docMatches;
      groups.push({
        patientKey,
        patient,
        documents: visibleDocs,
        totalCount: visibleDocs.length,
        pdfCount: visibleDocs.filter((d) => d.kind === 'pdf').length,
        imageCount: visibleDocs.filter((d) => d.kind === 'image').length,
        otherCount: visibleDocs.filter((d) => d.kind !== 'pdf' && d.kind !== 'image').length,
        latestUploadedAt,
      });
      return;
    }

    groups.push({
      patientKey,
      patient,
      documents: kindFilteredDocs,
      totalCount: kindFilteredDocs.length,
      pdfCount: kindFilteredDocs.filter((d) => d.kind === 'pdf').length,
      imageCount: kindFilteredDocs.filter((d) => d.kind === 'image').length,
      otherCount: kindFilteredDocs.filter((d) => d.kind !== 'pdf' && d.kind !== 'image').length,
      latestUploadedAt,
    });
  });

  return groups;
}

import {
  createClinicalPdfDataUrl,
  createClinicalSvgImageDataUrl,
  encodeAsciiToBase64,
} from './sampleClinicalDocs';

export { createClinicalPdfDataUrl, createClinicalSvgImageDataUrl, encodeAsciiToBase64 };

