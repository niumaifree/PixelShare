import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before starting the app."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  favorites: {
    id: string;
    image_url: string;
    user_id: string;
    created_at: string;
  };
  community_images: {
    id: string;
    image_url: string;
    title: string | null;
    user_id: string;
    created_at: string;
  };
};
