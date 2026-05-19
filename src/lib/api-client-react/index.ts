import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";

export interface Favorite {
  id: string;
  imageUrl: string;
  userId: string;
  createdAt: string;
}

export interface Image {
  id: string;
  imageUrl: string;
  title: string | null;
  userId: string;
  createdAt: string;
}

const FAVORITES_KEY = "pixelshare_favorites";
const IMAGES_KEY = "pixelshare_images";

function loadFromStorage<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getListFavoritesQueryKey(): string[] {
  return ["favorites"];
}

export function getListImagesQueryKey(): string[] {
  return ["images"];
}

export function useListFavorites(options?: {
  query?: { enabled?: boolean; queryKey?: string[] };
}) {
  const { user } = useUser();
  const enabled = options?.query?.enabled ?? true;
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListFavoritesQueryKey(),
    queryFn: (): Favorite[] => {
      if (!user) return [];
      const all = loadFromStorage<Favorite>(FAVORITES_KEY);
      return all.filter((f) => f.userId === user.id);
    },
    enabled,
  });
}

export function useAddFavorite() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { data: { imageUrl: string } }) => {
      if (!user) throw new Error("Not signed in");
      const all = loadFromStorage<Favorite>(FAVORITES_KEY);
      const already = all.find(
        (f) => f.userId === user.id && f.imageUrl === args.data.imageUrl
      );
      if (already) return already;
      const newFav: Favorite = {
        id: crypto.randomUUID(),
        imageUrl: args.data.imageUrl,
        userId: user.id,
        createdAt: new Date().toISOString(),
      };
      saveToStorage(FAVORITES_KEY, [...all, newFav]);
      return newFav;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
    },
  });
}

export function useRemoveFavoriteByUrl() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { data: { imageUrl: string } }) => {
      if (!user) throw new Error("Not signed in");
      const all = loadFromStorage<Favorite>(FAVORITES_KEY);
      const updated = all.filter(
        (f) => !(f.userId === user.id && f.imageUrl === args.data.imageUrl)
      );
      saveToStorage(FAVORITES_KEY, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
    },
  });
}

export function useListImages() {
  return useQuery({
    queryKey: getListImagesQueryKey(),
    queryFn: (): Image[] => {
      return loadFromStorage<Image>(IMAGES_KEY);
    },
  });
}

export function useAddUpload() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { data: { imageUrl: string; title?: string | null } }) => {
      if (!user) throw new Error("Not signed in");
      const all = loadFromStorage<Image>(IMAGES_KEY);
      const newImage: Image = {
        id: crypto.randomUUID(),
        imageUrl: args.data.imageUrl,
        title: args.data.title ?? null,
        userId: user.id,
        createdAt: new Date().toISOString(),
      };
      saveToStorage(IMAGES_KEY, [newImage, ...all]);
      return newImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
    },
  });
}
