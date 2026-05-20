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
  imageUrl: string;  // thumbnail (~400px) — favorites key
  fullUrl: string;   // full-quality for lightbox / download
  title?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BATCH = 20;
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string;
const PICSUM_TOTAL_PAGES = 100;
const SESSION_START_PAGE = Math.floor(Math.random() * PICSUM_TOTAL_PAGES) + 1;

// ---------------------------------------------------------------------------
// Picsum metadata cache (fetched once per session for search)
// ---------------------------------------------------------------------------
let picsumCachePromise: Promise<{ id: string; author: string; width: number; height: number }[]> | null = null;

function getPicsumCache() {
  if (!picsumCachePromise) {
    // Fetch first 5 pages (limit=100 each → up to 500 images) for author filtering
    picsumCachePromise = Promise.all(
      [1, 2, 3, 4, 5].map(p =>
        fetch(`https://picsum.photos/v2/list?page=${p}&limit=100`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      )
    ).then(pages => pages.flat());
  }
  return picsumCachePromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function picsumRawToGallery(img: { id: string; author: string; width: number; height: number }): GalleryImage {
  const thumbH = Math.round(400 * img.height / img.width);
  const fullH = Math.round(1200 * img.height / img.width);
  return {
    id: `picsum-${img.id}`,
    imageUrl: `https://picsum.photos/id/${img.id}/400/${thumbH}`,
    fullUrl: `https://picsum.photos/id/${img.id}/1200/${fullH}`,
    title: img.author,
  };
}

// ---------------------------------------------------------------------------
// Image fetchers — browse mode (merged feed)
// ---------------------------------------------------------------------------
async function fetchPicsumPage(pageIndex: number): Promise<GalleryImage[]> {
  const page = ((SESSION_START_PAGE + pageIndex - 1) % PICSUM_TOTAL_PAGES) + 1;
  const res = await fetch(`https://picsum.photos/v2/list?page=${page}&limit=${BATCH}`);
  if (!res.ok) return [];
  const data = await res.json() as { id: string; author: string; width: number; height: number }[];
  return data.map(picsumRawToGallery);
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
    imageUrl: img.urls.small,
    fullUrl: img.urls.regular,
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
// Search fetchers
// ---------------------------------------------------------------------------
async function searchUnsplash(query: string, pageIndex: number): Promise<GalleryImage[]> {
  if (!UNSPLASH_ACCESS_KEY || !query.trim()) return [];
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${pageIndex}&per_page=${BATCH}`,
    { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
  );
  if (!res.ok) return [];
  const data = await res.json() as {
    results: {
      id: string;
      description: string | null;
      alt_description: string | null;
      user: { name: string };
      urls: { small: string; regular: string };
    }[];
  };
  return (data.results ?? []).map(img => ({
    id: `unsplash-search-${img.id}`,
    imageUrl: img.urls.small,
    fullUrl: img.urls.regular,
    title: img.description ?? img.alt_description ?? img.user.name,
  }));
}

async function searchPicsumByAuthor(query: string): Promise<GalleryImage[]> {
  const lower = query.toLowerCase();
  const all = await getPicsumCache();
  return all
    .filter(img => img.author.toLowerCase().includes(lower))
    .map(picsumRawToGallery);
}

// ---------------------------------------------------------------------------
// BrowsePage — infinite scroll + search
// ---------------------------------------------------------------------------
export function BrowsePage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const batchRef = useRef(0);
  const isLoadingRef = useRef(false);
  const [lightboxKey, setLightboxKey] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Search
  const [inputQuery, setInputQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const isSearchMode = activeQuery.trim().length > 0;

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

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setActiveQuery(inputQuery), 400);
    return () => clearTimeout(t);
  }, [inputQuery]);

  // Reset gallery when query changes
  useEffect(() => {
    setImages([]);
    batchRef.current = 0;
    isLoadingRef.current = false;
  }, [activeQuery]);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    const pageIndex = batchRef.current + 1;
    batchRef.current = pageIndex;
    try {
      let newImages: GalleryImage[];
      if (isSearchMode) {
        // Search: Unsplash keyword + Picsum author (only fetch Picsum on page 1)
        const [unsplash, picsum] = await Promise.all([
          searchUnsplash(activeQuery, pageIndex),
          pageIndex === 1 ? searchPicsumByAuthor(activeQuery) : Promise.resolve([] as GalleryImage[]),
        ]);
        newImages = shuffle([...unsplash, ...picsum]);
      } else {
        newImages = await fetchMergedPage(pageIndex);
      }
      if (newImages.length > 0) {
        setImages(prev => {
          const seen = new Set(prev.map(i => i.id));
          return [...prev, ...newImages.filter(i => !seen.has(i.id))];
        });
      }
    } catch {
      toast({ title: "Failed to load photos", variant: "destructive" });
      batchRef.current = pageIndex - 1;
    } finally {
      isLoadingRef.current = false;
    }
  }, [activeQuery, isSearchMode, toast]);

  // Initial / search load
  useEffect(() => {
    if (isSearchMode) {
      loadMore();
    } else {
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery]);

  // Throttled scroll → infinite load
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 800) {
          loadMore();
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  const lightboxImg = useMemo(
    () => (lightboxKey ? images.find(i => i.imageUrl === lightboxKey) ?? null : null),
    [lightboxKey, images]
  );

  const handleDownload = useCallback(async (url: string) => {
    toast({ title: "Downloading…" });
    try {
      await downloadImage(url);
    } catch (e) {
      if ((e as Error).message === "cors_fallback") {
        toast({ title: "Opened in new tab", description: "Source site blocks direct download." });
      } else {
        toast({ title: "Download failed", variant: "destructive" });
      }
    }
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
      <Header
        onShare={handleShare}
        searchQuery={inputQuery}
        onSearchChange={setInputQuery}
      />

      {isSearchMode && (
        <div className="max-w-[1600px] mx-auto px-[4%] pt-5 pb-1">
          <p className="text-sm text-muted-foreground">
            Unsplash keyword + Picsum photographer results for{" "}
            <span className="font-semibold text-foreground">"{activeQuery}"</span>
          </p>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-[4%] py-8">
        {images.length === 0 && isSearchMode && (
          <div className="flex justify-center py-20">
            <div className="w-[40px] h-[40px] rounded-full border-[4px] border-[#ddd] border-t-primary animate-spin" />
          </div>
        )}
        <MasonryGrid>
          {images.map((img, i) => (
            <ImageCard
              key={img.id}
              index={i}
              imageUrl={img.imageUrl}
              title={img.title}
              isFavorited={favoriteUrls.has(img.imageUrl)}
              onFavorite={handleFavorite}
              onDownload={() => handleDownload(img.fullUrl)}
              onClick={() => setLightboxKey(img.imageUrl)}
            />
          ))}
        </MasonryGrid>
        <div className="h-32" />
      </main>

      <Lightbox
        url={lightboxImg?.fullUrl || ""}
        favoriteUrl={lightboxImg?.imageUrl}
        isOpen={!!lightboxKey}
        onClose={() => setLightboxKey(null)}
        isFavorited={lightboxKey ? favoriteUrls.has(lightboxKey) : false}
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
  const [lightboxKey, setLightboxKey] = useState<string | null>(null);
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
    try {
      await downloadImage(url);
    } catch (e) {
      if ((e as Error).message === "cors_fallback") {
        toast({ title: "Opened in new tab", description: "Source site blocks direct download." });
      } else {
        toast({ title: "Download failed", variant: "destructive" });
      }
    }
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
                onClick={(url) => setLightboxKey(url)}
              />
            ))}
          </MasonryGrid>
        )}
      </main>

      <Lightbox
        url={lightboxKey ?? ""}
        isOpen={!!lightboxKey}
        onClose={() => setLightboxKey(null)}
        isFavorited={lightboxKey ? favoriteUrls.has(lightboxKey) : false}
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
