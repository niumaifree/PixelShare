import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { downloadImage } from "@/lib/utils";
import Header from "@/components/Header";
import ImageCard from "@/components/ImageCard";
import MasonryGrid from "@/components/MasonryGrid";
import Lightbox from "@/components/Lightbox";
import ShareDialog from "@/components/ShareDialog";
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
// Image loaders — Picsum + Unsplash, merged together
// ---------------------------------------------------------------------------
const BATCH = 20;
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string;

const PICSUM_TOTAL_PAGES = 100;
const SESSION_START_PAGE = Math.floor(Math.random() * PICSUM_TOTAL_PAGES) + 1;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchPicsumPage(pageIndex: number): Promise<GalleryImage[]> {
  const page = ((SESSION_START_PAGE + pageIndex - 1) % PICSUM_TOTAL_PAGES) + 1;
  const res = await fetch(`https://picsum.photos/v2/list?page=${page}&limit=${BATCH}`);
  if (!res.ok) return [];
  const data = await res.json() as {
    id: string; author: string; width: number; height: number;
  }[];
  return data.map(img => {
    const h = Math.round(400 * img.height / img.width);
    return {
      id: `picsum-${img.id}`,
      imageUrl: `https://picsum.photos/id/${img.id}/400/${h}`,
      title: img.author,
    };
  });
}

async function fetchUnsplashPage(pageIndex: number): Promise<GalleryImage[]> {
  if (!UNSPLASH_ACCESS_KEY) return [];
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
    urls: { small: string; regular: string };
  }[];
  return data.map(img => ({
    id: `unsplash-${img.id}`,
    // Use `small` (~400px) for the grid, `regular` is served separately for lightbox
    imageUrl: img.urls.small,
    title: img.description ?? img.alt_description ?? img.user.name,
  }));
}

async function fetchMergedPage(pageIndex: number): Promise<GalleryImage[]> {
  const [picsum, unsplash] = await Promise.all([
    fetchPicsumPage(pageIndex),
    fetchUnsplashPage(pageIndex),
  ]);
  return shuffle([...picsum, ...unsplash]);
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
      const newImages = await fetchMergedPage(pageIndex);
      if (newImages.length > 0) {
        setImages(prev => {
          const seen = new Set(prev.map(i => i.id));
          return [...prev, ...newImages.filter(i => !seen.has(i.id))];
        });
      }
    } catch {
      toast({ title: "Failed to load more photos", variant: "destructive" });
      // Revert page counter so next scroll attempt retries the same page
      batchRef.current = pageIndex - 1;
    } finally {
      isLoadingRef.current = false;
    }
  }, [toast]);

  // Pre-load first two pages on mount in parallel
  useEffect(() => {
    (async () => {
      isLoadingRef.current = true;
      batchRef.current = 2;
      try {
        const [p1, p2] = await Promise.all([fetchMergedPage(1), fetchMergedPage(2)]);
        setImages([...p1, ...p2]);
      } catch {
        toast({ title: "Failed to load photos", variant: "destructive" });
      } finally {
        isLoadingRef.current = false;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll-based infinite load — throttled with a rAF flag
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrolled = window.scrollY + window.innerHeight;
        const total = document.documentElement.scrollHeight;
        if (scrolled >= total - 800) loadMore();
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  const handleDownload = useCallback(async (url: string) => {
    toast({ title: "Downloading…" });
    try { await downloadImage(url); }
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

  const handleShareSubmit = useCallback((imageUrl: string, title: string | null) => {
    addUpload.mutate(
      { data: { imageUrl, title } },
      {
        onSuccess: () => {
          toast({ title: "Photo shared!" });
          setShareOpen(false);
          queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
          setLocation("/community");
        },
        onError: () => toast({ title: "Failed to share", variant: "destructive" }),
      }
    );
  }, [addUpload, toast, queryClient, setLocation]);

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

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        onSubmit={handleShareSubmit}
        isPending={addUpload.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommunityPage — user-submitted photos
// ---------------------------------------------------------------------------
export function CommunityPage() {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

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
    try { await downloadImage(url); }
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

  const handleShareSubmit = useCallback((imageUrl: string, title: string | null) => {
    addUpload.mutate(
      { data: { imageUrl, title } },
      {
        onSuccess: () => {
          toast({ title: "Photo shared!" });
          setShareOpen(false);
          queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
        },
        onError: () => toast({ title: "Failed to share", variant: "destructive" }),
      }
    );
  }, [addUpload, toast, queryClient]);

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
            <button
              onClick={handleShare}
              className="bg-primary hover:bg-primary/90 rounded-full px-8 py-4 text-base font-semibold text-white transition-colors"
            >
              Share a Photo
            </button>
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

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        onSubmit={handleShareSubmit}
        isPending={addUpload.isPending}
      />
    </div>
  );
}

export default BrowsePage;
