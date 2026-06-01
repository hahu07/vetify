import { ExternalBlob } from "@/backend";
import { useBackend } from "@/hooks/use-backend";
import { cn } from "@/lib/utils";
import { Camera, Loader2, User } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface ProfilePhotoUploadProps {
  userId: string;
  displayName: string;
  currentPhotoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  onPhotoUpdated?: (url: string) => void;
}

const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-lg",
  lg: "h-24 w-24 text-2xl",
};

const iconSizes = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-10 w-10",
};

const editButtonSizes = {
  sm: "h-5 w-5 -bottom-0.5 -right-0.5",
  md: "h-6 w-6 -bottom-1 -right-1",
  lg: "h-8 w-8 -bottom-1.5 -right-1.5",
};

const editIconSizes = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfilePhotoUpload({
  userId: _userId,
  displayName,
  currentPhotoUrl,
  size = "md",
  onPhotoUpdated,
}: ProfilePhotoUploadProps) {
  const { actor } = useBackend();
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!actor) {
      toast.error("Backend not connected. Please try again.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blob = ExternalBlob.fromBytes(bytes);
      // Upload to object storage via the backend
      const doc = await actor.uploadDocument(
        "governmentId" as unknown as import("@/types").DocumentType,
        blob,
      );
      const url = doc.storageRef?.getDirectURL();
      if (!url) {
        throw new Error("Upload succeeded but no URL returned.");
      }
      const result = await actor.setProfilePhoto(url);
      if ("__kind__" in result && result.__kind__ === "err") {
        throw new Error(result.err);
      }
      setPhotoUrl(url);
      onPhotoUpdated?.(url);
      toast.success("Profile photo updated successfully.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload photo.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className="relative inline-block"
      data-ocid="profile_photo.upload_zone"
    >
      <div
        className={cn(
          "avatar-upload-zone relative flex items-center justify-center rounded-full overflow-hidden bg-muted border-2 border-border transition-smooth",
          sizeClasses[size],
          uploading && "opacity-60",
        )}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${displayName} profile`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-display font-semibold text-muted-foreground select-none">
            {getInitials(displayName)}
          </span>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2
              className={cn("animate-spin text-primary", iconSizes[size])}
            />
          </div>
        )}
      </div>

      {/* Edit button */}
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-smooth border-2 border-background",
          editButtonSizes[size],
        )}
        aria-label="Change profile photo"
        data-ocid="profile_photo.edit_button"
      >
        <Camera className={editIconSizes[size]} />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
        data-ocid="profile_photo.file_input"
      />
    </div>
  );
}
