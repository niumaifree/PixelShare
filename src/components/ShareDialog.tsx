import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidImageUrl } from "@/lib/utils";

type ImgStatus = "idle" | "loading" | "valid" | "error";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (imageUrl: string, title: string | null) => void;
  isPending?: boolean;
}

export default function ShareDialog({ open, onOpenChange, onSubmit, isPending }: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [urlError, setUrlError] = useState("");
  const [imgStatus, setImgStatus] = useState<ImgStatus>("idle");

  // Test if the image actually loads whenever the URL changes
  useEffect(() => {
    const trimmed = shareUrl.trim();
    if (!trimmed || !isValidImageUrl(trimmed)) {
      setImgStatus("idle");
      return;
    }
    setImgStatus("loading");
    const img = new Image();
    img.onload = () => setImgStatus("valid");
    img.onerror = () => setImgStatus("error");
    img.src = trimmed;
    return () => { img.onload = null; img.onerror = null; };
  }, [shareUrl]);

  const handleClose = useCallback(() => {
    setShareUrl("");
    setShareTitle("");
    setUrlError("");
    setImgStatus("idle");
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(() => {
    const trimmed = shareUrl.trim();
    if (!trimmed) return;
    if (!isValidImageUrl(trimmed)) {
      setUrlError("Please enter a valid http/https URL.");
      return;
    }
    setUrlError("");
    onSubmit(trimmed, shareTitle.trim() || null);
    setShareUrl("");
    setShareTitle("");
    setImgStatus("idle");
  }, [shareUrl, shareTitle, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const showPreview = isValidImageUrl(shareUrl.trim()) && shareUrl.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Share a Photo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-url">Image URL <span className="text-primary">*</span></Label>
            <Input
              id="share-url"
              placeholder="https://example.com/photo.jpg"
              value={shareUrl}
              onChange={(e) => { setShareUrl(e.target.value); setUrlError(""); }}
              onKeyDown={handleKeyDown}
              aria-describedby={urlError ? "share-url-error" : undefined}
            />
            {urlError && (
              <p id="share-url-error" className="text-xs text-destructive">{urlError}</p>
            )}
            {!urlError && (
              <p className="text-xs text-muted-foreground">
                Paste a direct link to a publicly accessible image.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-title">Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="share-title"
              placeholder="A beautiful sunset…"
              value={shareTitle}
              onChange={(e) => setShareTitle(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {showPreview && (
            <div className="flex flex-col gap-1.5">
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 min-h-[80px] flex items-center justify-center">
                {imgStatus === "loading" && (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-primary animate-spin" />
                )}
                {(imgStatus === "valid" || imgStatus === "loading") && (
                  <img
                    src={shareUrl.trim()}
                    alt="preview"
                    className={`w-full max-h-52 object-cover transition-opacity ${imgStatus === "valid" ? "opacity-100" : "opacity-0 absolute"}`}
                    onError={() => setImgStatus("error")}
                  />
                )}
                {imgStatus === "error" && (
                  <div className="text-center py-4 px-3">
                    <p className="text-xs text-amber-600 font-medium">⚠ Image failed to load</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      It may not be visible to others, or the site may block direct linking.
                    </p>
                  </div>
                )}
              </div>
              {imgStatus === "valid" && (
                <p className="text-xs text-green-600">✓ Image loaded successfully</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!shareUrl.trim() || isPending}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {isPending ? "Sharing…" : "Share Photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
