import React, { useRef } from 'react';
import { Paperclip, Camera, Sparkles, X, FileText } from 'lucide-react';
import type { AttachmentFile } from '../../types/clinical';

interface SectionAttachmentBarProps {
  sectionKey: string;
  sectionLabel: string;
  attachments: AttachmentFile[];
  onAddAttachment: (file: AttachmentFile) => void;
  onRemoveAttachment: (id: string) => void;
  onAIExtract?: (base64Data: string, mimeType: string, sectionLabel: string) => void;
  aiBusy?: boolean;
}

export const SectionAttachmentBar: React.FC<SectionAttachmentBarProps> = ({
  sectionKey,
  sectionLabel,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  onAIExtract,
  aiBusy,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const sectionFiles = attachments.filter((a) => a.section === sectionKey);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, triggerAI: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const id = `${sectionKey}-${Date.now()}`;
      onAddAttachment({
        id,
        name: file.name,
        section: sectionKey,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
      if (triggerAI && onAIExtract && dataUrl.includes(',')) {
        const base64Data = dataUrl.split(',')[1];
        onAIExtract(base64Data, file.type || 'image/jpeg', sectionLabel);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="mt-4 pt-3 border-t border-[#EEF3F0] flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFileChange(e, false)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileChange(e, true)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-xs font-medium text-[#14201B] inline-flex items-center gap-1.5"
        >
          <Paperclip className="w-3.5 h-3.5 text-[#047857]" />
          <span>File / Photo Attach</span>
        </button>

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={aiBusy}
          className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#F6F9F7] text-xs font-medium text-[#14201B] inline-flex items-center gap-1.5"
        >
          <Camera className="w-3.5 h-3.5 text-[#047857]" />
          <span>Click &amp; Attach</span>
        </button>

        {onAIExtract && (
          <label className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-medium text-[#053B2B] inline-flex items-center gap-1.5 cursor-pointer">
            <Sparkles className="w-3.5 h-3.5 text-[#047857]" />
            <span>{aiBusy ? 'Extracting...' : 'AI Upload & Autofill'}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={aiBusy}
              onChange={(e) => handleFileChange(e, true)}
            />
          </label>
        )}
      </div>

      {sectionFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {sectionFiles.map((file) => (
            <span
              key={file.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F6F9F7] border border-[#DDE8E2] text-xs text-[#14201B]"
            >
              <FileText className="w-3 h-3 text-[#047857]" />
              <span className="max-w-[140px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(file.id)}
                aria-label={`Remove ${file.name}`}
                className="text-[#6B8076] hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
