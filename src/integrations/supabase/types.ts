export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      episodes: {
        Row: {
          created_at: string
          duration: number | null
          episode_number: number
          id: string
          price: number
          release_date: string | null
          season_id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          episode_number: number
          id?: string
          price?: number
          release_date?: string | null
          season_id: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          episode_number?: number
          id?: string
          price?: number
          release_date?: string | null
          season_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      movies: {
        Row: {
          created_at: string
          description: string | null
          duration: number | null
          genre_id: string | null
          id: string
          language: string | null
          price: number
          rating: string | null
          release_date: string | null
          rental_expiry_duration: number | null
          status: Database["public"]["Enums"]["content_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: number | null
          genre_id?: string | null
          id?: string
          language?: string | null
          price?: number
          rating?: string | null
          release_date?: string | null
          rental_expiry_duration?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: number | null
          genre_id?: string | null
          id?: string
          language?: string | null
          price?: number
          rating?: string | null
          release_date?: string | null
          rental_expiry_duration?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movies_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          id: string
          method: string | null
          reference_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          method?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          method?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      producers: {
        Row: {
          bio: string | null
          company_name: string
          created_at: string
          id: string
          reviewer_id: string | null
          status: Database["public"]["Enums"]["producer_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          company_name: string
          created_at?: string
          id?: string
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["producer_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          company_name?: string
          created_at?: string
          id?: string
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["producer_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          id: string
          name: string
          phone_number: string | null
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          id?: string
          name: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          id?: string
          name?: string
          phone_number?: string | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          price_paid: number
          purchase_date: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          price_paid: number
          purchase_date?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          price_paid?: number
          purchase_date?: string
          user_id?: string
        }
        Relationships: []
      }
      rentals: {
        Row: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          expiration_date: string
          id: string
          price_paid: number
          rental_date: string
          status: Database["public"]["Enums"]["rental_status"]
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          expiration_date: string
          id?: string
          price_paid: number
          rental_date?: string
          status?: Database["public"]["Enums"]["rental_status"]
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          expiration_date?: string
          id?: string
          price_paid?: number
          rental_date?: string
          status?: Database["public"]["Enums"]["rental_status"]
          user_id?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          season_number: number
          tv_show_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          season_number: number
          tv_show_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          season_number?: number
          tv_show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_tv_show_id_fkey"
            columns: ["tv_show_id"]
            isOneToOne: false
            referencedRelation: "tv_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          description: string | null
          file_url: string | null
          id: string
          producer_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          title: string
          type: Database["public"]["Enums"]["submission_type"]
        }
        Insert: {
          description?: string | null
          file_url?: string | null
          id?: string
          producer_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          title: string
          type: Database["public"]["Enums"]["submission_type"]
        }
        Update: {
          description?: string | null
          file_url?: string | null
          id?: string
          producer_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          title?: string
          type?: Database["public"]["Enums"]["submission_type"]
        }
        Relationships: [
          {
            foreignKeyName: "submissions_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "producers"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_shows: {
        Row: {
          created_at: string
          description: string | null
          genre_id: string | null
          id: string
          language: string | null
          price: number
          rating: string | null
          release_date: string | null
          status: Database["public"]["Enums"]["content_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          genre_id?: string | null
          id?: string
          language?: string | null
          price?: number
          rating?: string | null
          release_date?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          genre_id?: string | null
          id?: string
          language?: string | null
          price?: number
          rating?: string | null
          release_date?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_shows_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: Json
      }
      update_user_role_by_email: {
        Args: { _email: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "admin" | "super_admin"
      content_status: "pending" | "approved" | "rejected"
      content_type: "movie" | "episode"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      producer_status: "pending" | "approved" | "rejected"
      rental_status: "active" | "expired"
      submission_status: "pending" | "under_review" | "approved" | "rejected"
      submission_type: "movie" | "tv_show"
      transaction_type: "rental" | "purchase" | "wallet_topup"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "admin", "super_admin"],
      content_status: ["pending", "approved", "rejected"],
      content_type: ["movie", "episode"],
      payment_status: ["pending", "completed", "failed", "refunded"],
      producer_status: ["pending", "approved", "rejected"],
      rental_status: ["active", "expired"],
      submission_status: ["pending", "under_review", "approved", "rejected"],
      submission_type: ["movie", "tv_show"],
      transaction_type: ["rental", "purchase", "wallet_topup"],
    },
  },
} as const
