"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, File, X } from "lucide-react";

interface Props {
  actionId: string;
  existingUrl?: string | null;
}

export function QualiopiPreuveUpload({ actionId, existingUrl }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 10 MB)');
      return;
    }

    const allowed = ['application/pdf', 'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      setError('Format non autorisé. Formats acceptés : PDF, JPG, PNG, DOCX');
      return;
    }

    setError(null);
    setFileName(file.name);
    upload(file);
  }

  function upload(file: File) {
    startTransition(async () => {
      const fd = new FormData();
      fd.append('file', file);

      try {
        const res = await fetch(`/qualiopi/actions/${actionId}/upload`, {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Erreur upload');
          return;
        }
        setPreview(data.url);
        router.refresh();
      } catch {
        setError('Erreur réseau lors de l\'upload');
      }
    });
  }

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="flex items-center gap-2 p-2 bg-surface border border-border rounded">
          <File className="h-4 w-4 text-foreground-muted shrink-0" />
          <a
            href={preview}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-accent hover:underline truncate flex-1"
          >
            {fileName ?? preview.split('/').pop()}
          </a>
          <button
            onClick={() => inputRef.current?.click()}
            className="text-[11px] text-foreground-muted hover:text-foreground px-2 py-0.5 border border-border rounded"
          >
            Remplacer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded text-[12px] text-foreground-muted hover:border-accent hover:text-accent disabled:opacity-60 transition-colors w-full"
        >
          <Upload className="h-3.5 w-3.5" />
          {isPending ? 'Téléversement...' : 'Téléverser une pièce jointe (PDF, JPG, PNG, DOCX — max 10 MB)'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <p className="text-[11px] text-red-600 flex items-center gap-1">
          <X className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
