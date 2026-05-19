import { useState, useCallback } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import ImageCard from "@/components/ImageCard";
import MasonryGrid from "@/components/MasonryGrid";
import Lightbox from "@/components/Lightbox";
import {
  useListFavorites,
  useRemoveFavoriteByUrl,
  getListFavoritesQueryKey,
} from "@workspace/api-client-react";

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

export default function CollectionPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: favorites = [], isLoading } = useListFavorites({
    query: {
      enabled: !!isSignedIn,
      queryKey: getListFavoritesQueryKey(),
    },
  });

  const removeFavoriteByUrl = useRemoveFavoriteByUrl();

  const handleDownload = useCallback(async (url: string) => {
    toast({ title: "Downloading…" });
    try {
      await downloadImageClientSide(url);
    } catch {
      toast({ title: "Download failed", description: "Could not fetch the image.", variant: "destructive" });
    }
  }, [toast]);

  const handleUnfavorite = useCallback((url: string) => {
    removeFavoriteByUrl.mutate(
      { data: { imageUrl: url } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
          toast({ title: "Removed from favorites" });
        },
      }
    );
  }, [removeFavoriteByUrl, queryClient, toast]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="w-[30px] h-[30px] rounded-full border-[3px] border-[#ddd] border-t-primary animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-[500px] mx-auto mt-20 p-8 bg-white rounded-2xl shadow-sm text-center border border-gray-100">
          <h2 className="text-2xl font-bold mb-2 text-foreground">Sign in to continue</h2>
          <p className="text-muted-foreground mb-6">You need to be signed in to view your collection.</p>
          <Button
            onClick={() => setLocation("/sign-in")}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-6"
          >
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />

      <main className="max-w-[1600px] mx-auto px-[4%] mt-12">
        <div className="mb-10">
          <h1 className="text-4xl font-[800] tracking-tight mb-2 text-foreground">My Collection</h1>
          <p className="text-muted-foreground">
            {favorites.length > 0
              ? `${favorites.length} saved photo${favorites.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-[40px] h-[40px] rounded-full border-[4px] border-[#ddd] border-t-primary animate-spin" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-3xl">❤️</div>
            <h2 className="text-2xl font-bold mb-4">No favorites yet</h2>
            <p className="text-muted-foreground mb-8">Browse photos and tap the heart to save ones you love.</p>
            <Button
              onClick={() => setLocation("/")}
              className="bg-primary hover:bg-primary/90 rounded-full px-8 py-6 text-base font-semibold"
            >
              Browse Photos
            </Button>
          </div>
        ) : (
          <MasonryGrid>
            {favorites.map((fav, i) => (
              <ImageCard
                key={fav.id}
                index={i}
                imageUrl={fav.imageUrl}
                isFavorited={true}
                onFavorite={handleUnfavorite}
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
        isFavorited={true}
        onDownload={handleDownload}
      />
    </div>
  );
}
