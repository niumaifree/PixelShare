import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { Download, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LightboxProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
  isFavorited?: boolean;
  onFavorite?: (url: string) => void;
  onDownload?: (url: string) => void;
}

export default function Lightbox({
  url,
  isOpen,
  onClose,
  isFavorited,
  onFavorite,
  onDownload,
}: LightboxProps) {
  const { isSignedIn } = useUser();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    } else {
      const timer = setTimeout(() => setShow(false), 200);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!show && !isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 transition-opacity duration-200 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
      data-testid="lightbox-overlay"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        data-testid="lightbox-close"
      >
        <X size={32} />
      </button>

      <div
        className="relative flex flex-col items-center max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {url && (
          <img
            src={url}
            alt="Lightbox view"
            className="max-h-[80vh] max-w-[90vw] object-contain shadow-2xl rounded-sm"
            data-testid="lightbox-img"
          />
        )}

        <div className="mt-4 flex items-center gap-4">
          {isSignedIn && onFavorite && (
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full bg-white/10 hover:bg-white/20 border-0 text-white"
              onClick={() => onFavorite(url)}
            >
              <Heart
                className={isFavorited ? "fill-primary text-primary" : ""}
                size={20}
              />
            </Button>
          )}
          <Button
            className="rounded-full bg-primary hover:bg-primary/90 text-white font-semibold px-6"
            onClick={() => onDownload?.(url)}
            data-testid="lightbox-download"
          >
            <Download className="mr-2" size={18} />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
