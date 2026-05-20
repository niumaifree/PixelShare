import { useState, useCallback } from "react";
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

  const handleClose = useCallback(() => {
    setShareUrl("");
    setShareTitle("");
    setUrlError("");
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
  }, [shareUrl, shareTitle, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

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
            {urlError ? (
              <p id="share-url-error" className="text-xs text-destructive">{urlError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Paste a direct link to a publicly accessible image.</p>
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
          {shareUrl.trim() && isValidImageUrl(shareUrl.trim()) && (
            <div className="rounded-xl overflow-hidden border border-gray-200 max-h-52">
              <img
                src={shareUrl}
                alt="preview"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
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
