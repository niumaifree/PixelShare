import { Heart, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageCardProps {
  index?: number;
  imageUrl: string;
  title?: string | null;
  isFavorited?: boolean;
  onFavorite?: (url: string) => void;
  onDownload?: (url: string) => void;
  onClick?: (url: string) => void;
  showDelete?: boolean;
  onDelete?: () => void;
}

export default function ImageCard({
  index = 0,
  imageUrl,
  title,
  isFavorited,
  onFavorite,
  onDownload,
  onClick,
  showDelete,
  onDelete,
}: ImageCardProps) {
  return (
    <div
      className="relative group bg-gray-100 rounded-xl overflow-hidden shadow-sm cursor-zoom-in"
      data-testid={`image-card-${index}`}
      onClick={() => onClick?.(imageUrl)}
    >
      {/* Natural-ratio image — h-auto lets the browser use the intrinsic dimensions */}
      <img
        src={imageUrl}
        alt={title || "Photo"}
        className="w-full h-auto block transition-transform duration-300 ease-out group-hover:scale-[1.02]"
        loading="lazy"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-between p-3 bg-gradient-to-b from-black/40 via-transparent to-black/60">
        {/* Top row: heart */}
        <div className="flex justify-between items-start pointer-events-auto">
          <div>
            {onFavorite && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-white/20 hover:bg-white/40 text-white border-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onFavorite(imageUrl);
                }}
              >
                <Heart className={isFavorited ? "fill-primary text-primary" : ""} size={20} />
              </Button>
            )}
          </div>

          {/* Delete + Download */}
          <div className="flex gap-2">
            {showDelete && onDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="rounded-full px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 size={15} className="mr-1" /> Delete
              </Button>
            )}
            {onDownload && (
              <Button
                variant="default"
                size="sm"
                className="rounded-full px-3 bg-primary hover:bg-primary/90 text-white font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(imageUrl);
                }}
              >
                <Download size={15} className="mr-1" /> Save
              </Button>
            )}
          </div>
        </div>

        {/* Bottom row: title */}
        {title && (
          <div className="pointer-events-none">
            <p className="text-white text-sm font-medium drop-shadow-md line-clamp-2">{title}</p>
          </div>
        )}
      </div>
    </div>
  );
}
