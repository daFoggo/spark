// Placeholder: an empty `public` schema. Replace with the output of
// `pnpm exec supabase gen types typescript --linked > lib/supabase/database.types.ts` (from apps/web)
// once the project has tables, and after every migration (docs/providers.md §4).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
