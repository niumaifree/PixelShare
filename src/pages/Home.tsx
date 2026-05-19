import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import Header from "@/components/Header";
import ImageCard from "@/components/ImageCard";
import MasonryGrid from "@/components/MasonryGrid";
import Lightbox from "@/components/Lightbox";
import {
  useListFavorites,
  useAddFavorite,
  useRemoveFavoriteByUrl,
  useListImages,
  useAddUpload,
  getListFavoritesQueryKey,
  getListImagesQueryKey,
} from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GalleryImage {
  id: string;
  imageUrl: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Unsplash image loader — fetches high-quality photos via Unsplash API
// ---------------------------------------------------------------------------
const BATCH = 20;
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string;

async function fetchUnsplashPage(pageIndex: number): Promise<GalleryImage[]> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn("VITE_UNSPLASH_ACCESS_KEY is not set");
    return [];
  }
  const res = await fetch(
    `https://api.unsplash.com/photos?page=${pageIndex}&per_page=${BATCH}&order_by=latest`,
    { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
  );
  if (!res.ok) return [];
  const data = await res.json() as {
    id: string;
    description: string | null;
    alt_description: string | null;
    user: { name: string };
    urls: { regular: string; full: string };
  }[];
  return data.map(img => ({
    id: `unsplash-${img.id}`,
    imageUrl: img.urls.regular,
    title: img.description ?? img.alt_description ?? img.user.name,
  }));
}

// ---------------------------------------------------------------------------
// Pure client-side download: fetch → Blob → anchor click
// ---------------------------------------------------------------------------
async function downloadImageClientSide(url: string): Promise<void> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  const ext = blob.type.includes("png") ? "png" : blob.type.includes("gif") ? "gif" : "jpg";
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `pixelshare-photo.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

// ---------------------------------------------------------------------------
// BrowsePage — infinite scroll
// ---------------------------------------------------------------------------
export function BrowsePage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const batchRef = useRef(0);
  const isLoadingRef = useRef(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareTitle, setShareTitle] = useState("");

  const { isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: favorites = [] } = useListFavorites({
    query: { enabled: !!isSignedIn, queryKey: getListFavoritesQueryKey() },
  });
  const addFavorite = useAddFavorite();
  const removeFavoriteByUrl = useRemoveFavoriteByUrl();
  const addUpload = useAddUpload();

  const favoriteUrls = useMemo(() => new Set(favorites.map((f) => f.imageUrl)), [favorites]);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    const pageIndex = batchRef.current + 1;
    batchRef.current = pageIndex;
    try {
      const newImages = await fetchUnsplashPage(pageIndex);
      if (newImages.length > 0) {
        setImages(prev => {
          const seen = new Set(prev.map(i => i.id));
          return [...prev, ...newImages.filter(i => !seen.has(i.id))];
        });
      }
    } catch {
      // silently retry on next scroll
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  // Pre-load first two pages on mount in parallel
  useEffect(() => {
    (async () => {
      isLoadingRef.current = true;
      batchRef.current = 2;
      try {
        const [p1, p2] = await Promise.all([fetchUnsplashPage(1), fetchUnsplashPage(2)]);
        setImages([...p1, ...p2]);
      } finally {
        isLoadingRef.current = false;
      }
    })();
  }, []);

  // Scroll-based infinite load
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (scrolled >= total - 800) loadMore();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  const handleDownload = useCallback(async (url: string) => {
    toast({ title: "Downloading…" });
    try { await downloadImageClientSide(url); }
    catch { toast({ title: "Download failed", variant: "destructive" }); }
  }, [toast]);

  const handleFavorite = useCallback((url: string) => {
    if (!isSignedIn) {
      toast({ title: "Sign in to save favorites", variant: "destructive" });
      setLocation("/sign-in");
      return;
    }
    if (favoriteUrls.has(url)) {
      removeFavoriteByUrl.mutate(
        { data: { imageUrl: url } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() }) }
      );
    } else {
      addFavorite.mutate(
        { data: { imageUrl: url } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() }) }
      );
    }
  }, [isSignedIn, favoriteUrls, addFavorite, removeFavoriteByUrl, queryClient, toast, setLocation]);

  const handleShare = useCallback(() => {
    if (!isSignedIn) { setLocation("/sign-in"); return; }
    setShareOpen(true);
  }, [isSignedIn, setLocation]);

  const handleShareSubmit = useCallback(() => {
    if (!shareUrl.trim()) return;
    addUpload.mutate(
      { data: { imageUrl: shareUrl.trim(), title: shareTitle.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: "Photo shared!" });
          setShareUrl(""); setShareTitle(""); setShareOpen(false);
          queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
          setLocation("/community");
        },
        onError: () => toast({ title: "Failed to share", variant: "destructive" }),
      }
    );
  }, [shareUrl, shareTitle, addUpload, toast, queryClient, setLocation]);

  return (
    <div className="min-h-screen bg-background">
      <Header onShare={handleShare} />
      <main className="max-w-[1600px] mx-auto px-[4%] py-8">
        <MasonryGrid>
          {images.map((img, i) => (
            <ImageCard
              key={img.id}
              index={i}
              imageUrl={img.imageUrl}
              title={img.title}
              isFavorited={favoriteUrls.has(img.imageUrl)}
              onFavorite={handleFavorite}
              onDownload={handleDownload}
              onClick={setLightboxUrl}
            />
          ))}
        </MasonryGrid>
        {/* Scroll trigger padding — load next batch before hitting the very bottom */}
        <div className="h-32" />
      </main>

      <Lightbox
        url={lightboxUrl || ""}
        isOpen={!!lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        isFavorited={lightboxUrl ? favoriteUrls.has(lightboxUrl) : false}
        onFavorite={handleFavorite}
        onDownload={handleDownload}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
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
                onChange={(e) => setShareUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShareSubmit()}
              />
              <p className="text-xs text-muted-foreground">Paste a direct link to a publicly accessible image.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-title">Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="share-title"
                placeholder="A beautiful sunset…"
                value={shareTitle}
                onChange={(e) => setShareTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShareSubmit()}
              />
            </div>
            {shareUrl.trim() && (
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
            <Button variant="outline" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button
              onClick={handleShareSubmit}
              disabled={!shareUrl.trim() || addUpload.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {addUpload.isPending ? "Sharing…" : "Share Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommunityPage — user-submitted photos
// ---------------------------------------------------------------------------
export function CommunityPage() {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareTitle, setShareTitle] = useState("");

  const { isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: favorites = [] } = useListFavorites({
    query: { enabled: !!isSignedIn, queryKey: getListFavoritesQueryKey() },
  });
  const { data: communityImages = [], isLoading } = useListImages();
  const addFavorite = useAddFavorite();
  const removeFavoriteByUrl = useRemoveFavoriteByUrl();
  const addUpload = useAddUpload();

  const favoriteUrls = useMemo(() => new Set(favorites.map((f) => f.imageUrl)), [favorites]);

  const handleDownload = useCallback(async (url: string) => {
    toast({ title: "Downloading…" });
    try { await downloadImageClientSide(url); }
    catch { toast({ title: "Download failed", variant: "destructive" }); }
  }, [toast]);

  const handleFavorite = useCallback((url: string) => {
    if (!isSignedIn) {
      toast({ title: "Sign in to save favorites", variant: "destructive" });
      setLocation("/sign-in");
      return;
    }
    if (favoriteUrls.has(url)) {
      removeFavoriteByUrl.mutate(
        { data: { imageUrl: url } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() }) }
      );
    } else {
      addFavorite.mutate(
        { data: { imageUrl: url } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() }) }
      );
    }
  }, [isSignedIn, favoriteUrls, addFavorite, removeFavoriteByUrl, queryClient, toast, setLocation]);

  const handleShare = useCallback(() => {
    if (!isSignedIn) { setLocation("/sign-in"); return; }
    setShareOpen(true);
  }, [isSignedIn, setLocation]);

  const handleShareSubmit = useCallback(() => {
    if (!shareUrl.trim()) return;
    addUpload.mutate(
      { data: { imageUrl: shareUrl.trim(), title: shareTitle.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: "Photo shared!" });
          setShareUrl(""); setShareTitle(""); setShareOpen(false);
          queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
        },
        onError: () => toast({ title: "Failed to share", variant: "destructive" }),
      }
    );
  }, [shareUrl, shareTitle, addUpload, toast, queryClient]);

  return (
    <div className="min-h-screen bg-background">
      <Header onShare={handleShare} />
      <main className="max-w-[1600px] mx-auto px-[4%] py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-[40px] h-[40px] rounded-full border-[4px] border-[#ddd] border-t-primary animate-spin" />
          </div>
        ) : communityImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-3xl">📷</div>
            <h2 className="text-2xl font-bold mb-4">No community photos yet</h2>
            <p className="text-muted-foreground mb-8">Be the first to share a photo.</p>
            <Button
              onClick={handleShare}
              className="bg-primary hover:bg-primary/90 rounded-full px-8 py-6 text-base font-semibold"
            >
              Share a Photo
            </Button>
          </div>
        ) : (
          <MasonryGrid>
            {communityImages.map((img, i) => (
              <ImageCard
                key={img.id}
                index={i}
                imageUrl={img.imageUrl}
                title={img.title ?? undefined}
                isFavorited={favoriteUrls.has(img.imageUrl)}
                onFavorite={handleFavorite}
                onDownload={handleDownload}
                onClick={setLightboxUrl}
              />
            ))}
          </MasonryGrid>
        )}
      </main>

      <Lightbox
        url={lightboxUrl || ""}
        isOpen={!!lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        isFavorited={lightboxUrl ? favoriteUrls.has(lightboxUrl) : false}
        onFavorite={handleFavorite}
        onDownload={handleDownload}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Share a Photo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-url-c">Image URL <span className="text-primary">*</span></Label>
              <Input
                id="share-url-c"
                placeholder="https://example.com/photo.jpg"
                value={shareUrl}
                onChange={(e) => setShareUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShareSubmit()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-title-c">Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="share-title-c"
                placeholder="A beautiful sunset…"
                value={shareTitle}
                onChange={(e) => setShareTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShareSubmit()}
              />
            </div>
            {shareUrl.trim() && (
              <div className="rounded-xl overflow-hidden border border-gray-200 max-h-52">
                <img src={shareUrl} alt="preview" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button
              onClick={handleShareSubmit}
              disabled={!shareUrl.trim() || addUpload.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {addUpload.isPending ? "Sharing…" : "Share Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Default export — Browse page
export default BrowsePage;
