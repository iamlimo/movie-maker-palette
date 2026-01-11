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
      banners: {
        Row: {
          created_at: string
          cta_link: string | null
          cta_text: string | null
          display_order: number
          id: string
          image_url: string | null
          is_visible: boolean
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_visible?: boolean
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_visible?: boolean
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cast_crew: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          name: string
          photo_url: string | null
          role: string
          social_links: Json | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          role: string
          social_links?: Json | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          role?: string
          social_links?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      content_sections: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          display_order: number
          id: string
          section_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          display_order?: number
          id?: string
          section_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          display_order?: number
          id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_sections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_cast: {
        Row: {
          cast_crew_id: string
          character_name: string | null
          created_at: string
          credit_order: number | null
          episode_id: string
          id: string
          role_type: string
        }
        Insert: {
          cast_crew_id: string
          character_name?: string | null
          created_at?: string
          credit_order?: number | null
          episode_id: string
          id?: string
          role_type: string
        }
        Update: {
          cast_crew_id?: string
          character_name?: string | null
          created_at?: string
          credit_order?: number | null
          episode_id?: string
          id?: string
          role_type?: string
        }
        Relationships: []
      }
      episodes: {
        Row: {
          created_at: string
          description: string | null
          duration: number | null
          episode_number: number
          id: string
          price: number
          published_at: string | null
          release_date: string | null
          rental_expiry_duration: number
          season_id: string
          status: Database["public"]["Enums"]["content_status"]
          thumbnail_url: string | null
          title: string
          trailer_url: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: number | null
          episode_number: number
          id?: string
          price?: number
          published_at?: string | null
          release_date?: string | null
          rental_expiry_duration?: number
          season_id: string
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title: string
          trailer_url?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: number | null
          episode_number?: number
          id?: string
          price?: number
          published_at?: string | null
          release_date?: string | null
          rental_expiry_duration?: number
          season_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title?: string
          trailer_url?: string | null
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
      favorites: {
        Row: {
          added_at: string
          content_id: string
          content_type: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          content_id: string
          content_type: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          content_id?: string
          content_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          audit_id: string
          created_at: string | null
          details: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          audit_id?: string
          created_at?: string | null
          details?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          audit_id?: string
          created_at?: string | null
          details?: Json | null
        }
        Relationships: []
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
      movie_cast: {
        Row: {
          cast_crew_id: string
          character_name: string | null
          created_at: string
          credit_order: number | null
          id: string
          movie_id: string
          role_type: string
        }
        Insert: {
          cast_crew_id: string
          character_name?: string | null
          created_at?: string
          credit_order?: number | null
          id?: string
          movie_id: string
          role_type: string
        }
        Update: {
          cast_crew_id?: string
          character_name?: string | null
          created_at?: string
          credit_order?: number | null
          id?: string
          movie_id?: string
          role_type?: string
        }
        Relationships: []
      }
      movies: {
        Row: {
          age_restriction: number | null
          cast_info: string | null
          content_warnings: string[] | null
          created_at: string
          description: string | null
          director: string | null
          duration: number | null
          genre_id: string | null
          id: string
          landscape_poster_url: string | null
          language: string | null
          optimization_metadata: Json | null
          price: number
          production_company: string | null
          rating: string | null
          release_date: string | null
          rental_expiry_duration: number | null
          slider_cover_url: string | null
          status: Database["public"]["Enums"]["content_status"]
          thumbnail_url: string | null
          title: string
          trailer_url: string | null
          updated_at: string
          uploaded_by: string | null
          video_url: string | null
          viewer_discretion: string | null
        }
        Insert: {
          age_restriction?: number | null
          cast_info?: string | null
          content_warnings?: string[] | null
          created_at?: string
          description?: string | null
          director?: string | null
          duration?: number | null
          genre_id?: string | null
          id?: string
          landscape_poster_url?: string | null
          language?: string | null
          optimization_metadata?: Json | null
          price?: number
          production_company?: string | null
          rating?: string | null
          release_date?: string | null
          rental_expiry_duration?: number | null
          slider_cover_url?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title: string
          trailer_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
          video_url?: string | null
          viewer_discretion?: string | null
        }
        Update: {
          age_restriction?: number | null
          cast_info?: string | null
          content_warnings?: string[] | null
          created_at?: string
          description?: string | null
          director?: string | null
          duration?: number | null
          genre_id?: string | null
          id?: string
          landscape_poster_url?: string | null
          language?: string | null
          optimization_metadata?: Json | null
          price?: number
          production_company?: string | null
          rating?: string | null
          release_date?: string | null
          rental_expiry_duration?: number | null
          slider_cover_url?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title?: string
          trailer_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
          video_url?: string | null
          viewer_discretion?: string | null
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
      payment_attempts: {
        Row: {
          attempt_number: number
          attempted_at: string
          completed_at: string | null
          error_message: string | null
          id: string
          payment_id: string
          provider_response: Json | null
          status: string
        }
        Insert: {
          attempt_number?: number
          attempted_at?: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          payment_id: string
          provider_response?: Json | null
          status?: string
        }
        Update: {
          attempt_number?: number
          attempted_at?: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          payment_id?: string
          provider_response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          enhanced_status:
            | Database["public"]["Enums"]["enhanced_payment_status"]
            | null
          error_message: string | null
          expires_at: string | null
          flow_direction: string | null
          id: string
          intent_id: string
          last_retry_at: string | null
          metadata: Json | null
          method: string | null
          provider: string | null
          provider_reference: string | null
          purpose: string
          reference_id: string | null
          retry_count: number | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_date: string
          transaction_type:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          enhanced_status?:
            | Database["public"]["Enums"]["enhanced_payment_status"]
            | null
          error_message?: string | null
          expires_at?: string | null
          flow_direction?: string | null
          id?: string
          intent_id?: string
          last_retry_at?: string | null
          metadata?: Json | null
          method?: string | null
          provider?: string | null
          provider_reference?: string | null
          purpose?: string
          reference_id?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_date?: string
          transaction_type?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          enhanced_status?:
            | Database["public"]["Enums"]["enhanced_payment_status"]
            | null
          error_message?: string | null
          expires_at?: string | null
          flow_direction?: string | null
          id?: string
          intent_id?: string
          last_retry_at?: string | null
          metadata?: Json | null
          method?: string | null
          provider?: string | null
          provider_reference?: string | null
          purpose?: string
          reference_id?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_date?: string
          transaction_type?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          created_at: string | null
          metadata: Json | null
          payout_date: string | null
          payout_id: string
          producer_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          metadata?: Json | null
          payout_date?: string | null
          payout_id?: string
          producer_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          metadata?: Json | null
          payout_date?: string | null
          payout_id?: string
          producer_id?: string | null
          status?: string
          updated_at?: string | null
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
          first_name: string | null
          id: string
          last_name: string | null
          name: string
          phone_number: string | null
          profile_image_url: string | null
          status: string | null
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          name: string
          phone_number?: string | null
          profile_image_url?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          name?: string
          phone_number?: string | null
          profile_image_url?: string | null
          status?: string | null
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
          amount: number
          content_id: string
          content_type: string
          created_at: string
          expires_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          content_id: string
          content_type: string
          created_at?: string
          expires_at: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          content_id?: string
          content_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          price: number
          rental_expiry_duration: number
          season_number: number
          status: Database["public"]["Enums"]["content_status"]
          tv_show_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          price?: number
          rental_expiry_duration?: number
          season_number: number
          status?: Database["public"]["Enums"]["content_status"]
          tv_show_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          price?: number
          rental_expiry_duration?: number
          season_number?: number
          status?: Database["public"]["Enums"]["content_status"]
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
      sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_visible: boolean
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_visible?: boolean
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_visible?: boolean
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      slider_items: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          description: string | null
          genre: string | null
          id: string
          is_featured: boolean
          is_rentable: boolean
          poster_url: string | null
          price: number
          promotion_badge_text: string | null
          promotion_ends_at: string | null
          promotion_priority: number
          promotion_starts_at: string | null
          promotion_type: Database["public"]["Enums"]["promotion_type"]
          rating: string | null
          release_date: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_featured?: boolean
          is_rentable?: boolean
          poster_url?: string | null
          price?: number
          promotion_badge_text?: string | null
          promotion_ends_at?: string | null
          promotion_priority?: number
          promotion_starts_at?: string | null
          promotion_type?: Database["public"]["Enums"]["promotion_type"]
          rating?: string | null
          release_date?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_featured?: boolean
          is_rentable?: boolean
          poster_url?: string | null
          price?: number
          promotion_badge_text?: string | null
          promotion_ends_at?: string | null
          promotion_priority?: number
          promotion_starts_at?: string | null
          promotion_type?: Database["public"]["Enums"]["promotion_type"]
          rating?: string | null
          release_date?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      transactions_ledger: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          ledger_id: string
          party: string
          party_id: string | null
          payment_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          ledger_id?: string
          party: string
          party_id?: string | null
          payment_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          ledger_id?: string
          party?: string
          party_id?: string | null
          payment_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_show_cast: {
        Row: {
          cast_crew_id: string
          character_name: string | null
          created_at: string
          credit_order: number | null
          id: string
          role_type: string
          tv_show_id: string
        }
        Insert: {
          cast_crew_id: string
          character_name?: string | null
          created_at?: string
          credit_order?: number | null
          id?: string
          role_type: string
          tv_show_id: string
        }
        Update: {
          cast_crew_id?: string
          character_name?: string | null
          created_at?: string
          credit_order?: number | null
          id?: string
          role_type?: string
          tv_show_id?: string
        }
        Relationships: []
      }
      tv_shows: {
        Row: {
          age_restriction: number | null
          cast_info: string | null
          content_warnings: string[] | null
          created_at: string
          description: string | null
          director: string | null
          genre_id: string | null
          genres: string[] | null
          id: string
          landscape_poster_url: string | null
          language: string | null
          optimization_metadata: Json | null
          price: number
          production_company: string | null
          rating: string | null
          release_date: string | null
          slider_cover_url: string | null
          status: Database["public"]["Enums"]["content_status"]
          thumbnail_url: string | null
          title: string
          trailer_url: string | null
          updated_at: string
          uploaded_by: string | null
          viewer_discretion: string | null
        }
        Insert: {
          age_restriction?: number | null
          cast_info?: string | null
          content_warnings?: string[] | null
          created_at?: string
          description?: string | null
          director?: string | null
          genre_id?: string | null
          genres?: string[] | null
          id?: string
          landscape_poster_url?: string | null
          language?: string | null
          optimization_metadata?: Json | null
          price?: number
          production_company?: string | null
          rating?: string | null
          release_date?: string | null
          slider_cover_url?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title: string
          trailer_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
          viewer_discretion?: string | null
        }
        Update: {
          age_restriction?: number | null
          cast_info?: string | null
          content_warnings?: string[] | null
          created_at?: string
          description?: string | null
          director?: string | null
          genre_id?: string | null
          genres?: string[] | null
          id?: string
          landscape_poster_url?: string | null
          language?: string | null
          optimization_metadata?: Json | null
          price?: number
          production_company?: string | null
          rating?: string | null
          release_date?: string | null
          slider_cover_url?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title?: string
          trailer_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
          viewer_discretion?: string | null
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
      user_payments: {
        Row: {
          access_expires_at: string
          amount: number
          created_at: string
          id: string
          payment_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_expires_at: string
          amount: number
          created_at?: string
          id?: string
          payment_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_expires_at?: string
          amount?: number
          created_at?: string
          id?: string
          payment_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          auto_play: boolean | null
          created_at: string
          email_notifications: boolean | null
          id: string
          preferred_genres: string[] | null
          preferred_language: string | null
          push_notifications: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_play?: boolean | null
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          preferred_genres?: string[] | null
          preferred_language?: string | null
          push_notifications?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_play?: boolean | null
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          preferred_genres?: string[] | null
          preferred_language?: string | null
          push_notifications?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          payment_id: string | null
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["wallet_id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string | null
          user_id: string | null
          wallet_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string | null
          user_id?: string | null
          wallet_id?: string
        }
        Update: {
          balance?: number
          updated_at?: string | null
          user_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      watch_history: {
        Row: {
          completed: boolean | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          last_watched_at: string
          playback_position: number | null
          progress: number | null
          updated_at: string
          user_id: string
          video_duration: number | null
        }
        Insert: {
          completed?: boolean | null
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          last_watched_at?: string
          playback_position?: number | null
          progress?: number | null
          updated_at?: string
          user_id: string
          video_duration?: number | null
        }
        Update: {
          completed?: boolean | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          last_watched_at?: string
          playback_position?: number | null
          progress?: number | null
          updated_at?: string
          user_id?: string
          video_duration?: number | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string
          event_type: string
          payload: Json | null
          processed_at: string | null
          provider: string
          provider_event_id: string
        }
        Insert: {
          event_id?: string
          event_type: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string
          provider_event_id: string
        }
        Update: {
          event_id?: string
          event_type?: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_existing_rental: {
        Args: {
          p_content_id: string
          p_content_type: Database["public"]["Enums"]["content_type"]
          p_user_id: string
        }
        Returns: boolean
      }
      cleanup_expired_payments: { Args: never; Returns: number }
      expire_rentals: { Args: never; Returns: number }
      get_current_user_profile: { Args: never; Returns: string }
      get_season_episode_count: {
        Args: { season_id_param: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_finance_action: {
        Args: { p_action: string; p_details?: Json }
        Returns: string
      }
      process_wallet_transaction: {
        Args: {
          p_amount: number
          p_description?: string
          p_metadata?: Json
          p_payment_id?: string
          p_type: string
          p_wallet_id: string
        }
        Returns: string
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
      content_type: "movie" | "episode" | "season"
      enhanced_payment_status:
        | "initiated"
        | "pending"
        | "completed"
        | "failed"
        | "refunded"
        | "success"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      producer_status: "pending" | "approved" | "rejected"
      promotion_type: "standard" | "promoted" | "coming_soon"
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
      content_type: ["movie", "episode", "season"],
      enhanced_payment_status: [
        "initiated",
        "pending",
        "completed",
        "failed",
        "refunded",
        "success",
      ],
      payment_status: ["pending", "completed", "failed", "refunded"],
      producer_status: ["pending", "approved", "rejected"],
      promotion_type: ["standard", "promoted", "coming_soon"],
      rental_status: ["active", "expired"],
      submission_status: ["pending", "under_review", "approved", "rejected"],
      submission_type: ["movie", "tv_show"],
      transaction_type: ["rental", "purchase", "wallet_topup"],
    },
  },
} as const
