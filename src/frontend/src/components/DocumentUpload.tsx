import { ExternalBlob } from "@/backend";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/types";
import { AlertCircle, FileCheck, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

interface DocumentUploadProps {
  docType: DocumentType;
  label: string;
  description?: string;
  isUploaded?: boolean;
  onUpload: (docType: DocumentType, blob: ExternalBlob) => Promise<void>;
  accept?: string;
  className?: string;
  "data-ocid"?: string;
}

export function DocumentUpload({
  docType,
  label,
  description,
  isUploaded = false,
  onUpload,
  accept = ".pdf,.jpg,.jpeg,.png",
  className,
  "data-ocid": dataOcid,
}: DocumentUploadProps) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(isUploaded);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) => {
        setProgress(pct);
      });
      await onUpload(docType, blob);
      setUploaded(true);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div data-ocid={dataOcid} className={cn("space-y-2", className)}>
      <label
        htmlFor={`doc-upload-${docType}`}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <button
        type="button"
        aria-label="Upload document"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-smooth",
          uploaded
            ? "border-primary/40 bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-primary/5",
          uploading && "opacity-75",
        )}
      >
        <input
          ref={inputRef}
          id={`doc-upload-${docType}`}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleChange}
          data-ocid={dataOcid ? `${dataOcid}_input` : undefined}
        />
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Uploading…</p>
            <div className="mt-3 w-full max-w-xs">
              <Progress value={progress} className="h-1.5" />
            </div>
          </>
        ) : uploaded ? (
          <>
            <FileCheck className="h-8 w-8 text-primary" />
            <p className="mt-2 text-sm font-medium text-primary">
              Document uploaded
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Click to replace
            </p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">
              Drop file here or{" "}
              <span className="text-primary font-semibold">browse</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PDF, JPG, PNG supported
            </p>
          </>
        )}
      </button>
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
