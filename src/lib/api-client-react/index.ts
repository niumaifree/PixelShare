import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { supabase } from "@/lib/supabase";

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

export function getListFavoritesQueryKey(): string[] {
  return ["favorites"];
}

export function getListImagesQueryKey(): string[] {
  return ["community_images"];
}

export function useListFavorites(options?: {
  query?: { enabled?: boolean; queryKey?: string[] };
}) {
  const { user } = useUser();
  const enabled = options?.query?.enabled ?? true;
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListFavoritesQueryKey(),
    queryFn: async (): Promise<Favorite[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        imageUrl: r.image_url,
        userId: r.user_id,
        createdAt: r.created_at,
      }));
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
      const { data, error } = await supabase
        .from("favorites")
        .upsert(
          { image_url: args.data.imageUrl, user_id: user.id },
          { onConflict: "user_id,image_url" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
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
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("image_url", args.data.imageUrl);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
    },
  });
}

export function useListImages() {
  return useQuery({
    queryKey: getListImagesQueryKey(),
    queryFn: async (): Promise<Image[]> => {
      const { data, error } = await supabase
        .from("community_images")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        imageUrl: r.image_url,
        title: r.title,
        userId: r.user_id,
        createdAt: r.created_at,
      }));
    },
  });
}

export function useAddUpload() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { data: { imageUrl: string; title?: string | null } }) => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("community_images")
        .insert({
          image_url: args.data.imageUrl,
          title: args.data.title ?? null,
          user_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
    },
  });
}
