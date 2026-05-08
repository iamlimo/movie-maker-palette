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
      email_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          external_id: string | null
          id: string
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string
          template_type: string
          ticket_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          recipient_email: string
          sent_at?: string | null
          status?: string
          subject: string
          template_type: string
          ticket_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_type?: string
          ticket_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
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
          subtitle_url: string | null
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
          subtitle_url?: string | null
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
          subtitle_url?: string | null
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
      job_applications: {
        Row: {
          cover_letter: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          job_listing_id: string
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          portfolio_url: string | null
          resume_url: string | null
          status: string
          years_of_experience: number | null
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          job_listing_id: string
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          status?: string
          years_of_experience?: number | null
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_listing_id?: string
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          status?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_listing_id_fkey"
            columns: ["job_listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          benefits: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          id: string
          location: string | null
          requirements: string | null
          salary_range: string | null
          status: string
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          benefits?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          location?: string | null
          requirements?: string | null
          salary_range?: string | null
          status?: string
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          benefits?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          location?: string | null
          requirements?: string | null
          salary_range?: string | null
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
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
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          subtitle_url: string | null
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
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          subtitle_url?: string | null
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
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          subtitle_url?: string | null
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
      payment_anomalies: {
        Row: {
          anomaly_type: string
          created_at: string | null
          id: string
          message: string
          paystack_data: Json | null
          paystack_reference: string
          rental_payment_id: string
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string
        }
        Insert: {
          anomaly_type: string
          created_at?: string | null
          id?: string
          message: string
          paystack_data?: Json | null
          paystack_reference: string
          rental_payment_id: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          anomaly_type?: string
          created_at?: string | null
          id?: string
          message?: string
          paystack_data?: Json | null
          paystack_reference?: string
          rental_payment_id?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_anomalies_rental_payment_id_fkey"
            columns: ["rental_payment_id"]
            isOneToOne: false
            referencedRelation: "rental_payments"
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
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string
          name?: string
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
      push_device_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          data: Json
          id: string
          sent_count: number
          target: string
          target_user_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          sent_count?: number
          target?: string
          target_user_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          sent_count?: number
          target?: string
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      referral_code_uses: {
        Row: {
          code_id: string
          created_at: string
          discount_applied: number
          id: string
          payment_id: string | null
          user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string
          discount_applied: number
          id?: string
          payment_id?: string | null
          user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string
          discount_applied?: number
          id?: string
          payment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_code_uses_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          max_uses_per_user: number
          min_purchase_amount: number
          times_used: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_user?: number
          min_purchase_amount?: number
          times_used?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_user?: number
          min_purchase_amount?: number
          times_used?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      rental_access: {
        Row: {
          created_at: string
          episode_id: string | null
          expires_at: string
          granted_at: string
          id: string
          metadata: Json
          movie_id: string | null
          rental_intent_id: string | null
          rental_type: string
          revoked_at: string | null
          season_id: string | null
          source: string
          status: Database["public"]["Enums"]["rental_intent_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          expires_at: string
          granted_at?: string
          id?: string
          metadata?: Json
          movie_id?: string | null
          rental_intent_id?: string | null
          rental_type: string
          revoked_at?: string | null
          season_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["rental_intent_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          expires_at?: string
          granted_at?: string
          id?: string
          metadata?: Json
          movie_id?: string | null
          rental_intent_id?: string | null
          rental_type?: string
          revoked_at?: string | null
          season_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["rental_intent_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_access_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_access_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_access_rental_intent_id_fkey"
            columns: ["rental_intent_id"]
            isOneToOne: false
            referencedRelation: "rental_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_access_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rental_intents: {
        Row: {
          created_at: string
          currency: string
          discount_amount: number
          episode_id: string | null
          expires_at: string | null
          failed_at: string | null
          id: string
          metadata: Json
          movie_id: string | null
          paid_at: string | null
          payment_method: string
          paystack_reference: string | null
          price: number
          provider_reference: string | null
          referral_code: string | null
          rental_type: string
          season_id: string | null
          status: Database["public"]["Enums"]["rental_intent_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          discount_amount?: number
          episode_id?: string | null
          expires_at?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json
          movie_id?: string | null
          paid_at?: string | null
          payment_method: string
          paystack_reference?: string | null
          price: number
          provider_reference?: string | null
          referral_code?: string | null
          rental_type: string
          season_id?: string | null
          status?: Database["public"]["Enums"]["rental_intent_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          discount_amount?: number
          episode_id?: string | null
          expires_at?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json
          movie_id?: string | null
          paid_at?: string | null
          payment_method?: string
          paystack_reference?: string | null
          price?: number
          provider_reference?: string | null
          referral_code?: string | null
          rental_type?: string
          season_id?: string | null
          status?: Database["public"]["Enums"]["rental_intent_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_intents_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_intents_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_intents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rental_payments: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          payment_channel: string | null
          payment_status: string | null
          paystack_access_code: string | null
          paystack_reference: string | null
          rental_id: string
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payment_channel?: string | null
          payment_status?: string | null
          paystack_access_code?: string | null
          paystack_reference?: string | null
          rental_id: string
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payment_channel?: string | null
          payment_status?: string | null
          paystack_access_code?: string | null
          paystack_reference?: string | null
          rental_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          expires_at: string
          id: string
          payment_method: string | null
          price: number
          status: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          expires_at: string
          id?: string
          payment_method?: string | null
          price: number
          status?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          payment_method?: string | null
          price?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
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
      ticket_activity_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_value: string | null
          old_value: string | null
          performed_by: string
          ticket_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by: string
          ticket_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string
          comment_text: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          ticket_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          comment_text: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          comment_text?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_templates: {
        Row: {
          category: string
          created_at: string | null
          id: string
          internal_note_template: string | null
          name: string
          suggested_priority: string | null
          title: string
          updated_at: string | null
          user_message_template: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          internal_note_template?: string | null
          name: string
          suggested_priority?: string | null
          title: string
          updated_at?: string | null
          user_message_template?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          internal_note_template?: string | null
          name?: string
          suggested_priority?: string | null
          title?: string
          updated_at?: string | null
          user_message_template?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assigned_team: string | null
          assigned_to: string | null
          attached_content_id: string | null
          attached_payment_id: string | null
          category: string
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          include_system_logs: boolean | null
          internal_notes: string | null
          is_admin_created: boolean | null
          notification_sent: boolean | null
          priority: string
          resolved_at: string | null
          status: string
          template_used: string | null
          ticket_number: string
          title: string
          updated_at: string | null
          user_id: string
          user_message: string
          user_type: string
        }
        Insert: {
          assigned_team?: string | null
          assigned_to?: string | null
          attached_content_id?: string | null
          attached_payment_id?: string | null
          category: string
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          include_system_logs?: boolean | null
          internal_notes?: string | null
          is_admin_created?: boolean | null
          notification_sent?: boolean | null
          priority?: string
          resolved_at?: string | null
          status?: string
          template_used?: string | null
          ticket_number?: string
          title: string
          updated_at?: string | null
          user_id: string
          user_message: string
          user_type?: string
        }
        Update: {
          assigned_team?: string | null
          assigned_to?: string | null
          attached_content_id?: string | null
          attached_payment_id?: string | null
          category?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          include_system_logs?: boolean | null
          internal_notes?: string | null
          is_admin_created?: boolean | null
          notification_sent?: boolean | null
          priority?: string
          resolved_at?: string | null
          status?: string
          template_used?: string | null
          ticket_number?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          user_message?: string
          user_type?: string
        }
        Relationships: []
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
          slug: string
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
          slug: string
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
          slug?: string
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
          role_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
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
      grant_rental_access: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_expires_at: string
          p_metadata?: Json
          p_rental_intent_id?: string
          p_rental_type: string
          p_source?: string
          p_user_id: string
        }
        Returns: string
      }
      has_active_rental_access: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_user_id: string
        }
        Returns: {
          access_type: string
          expires_at: string
          has_access: boolean
          rental_access_id: string
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_finance_action: {
        Args: { p_action: string; p_details?: Json }
        Returns: string
      }
      process_wallet_rental_payment: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_discount_amount?: number
          p_expires_at: string
          p_final_price: number
          p_metadata?: Json
          p_provider_reference?: string
          p_referral_code?: string
          p_user_id: string
        }
        Returns: {
          discount_amount: number
          expires_at: string
          final_price: number
          rental_access_id: string
          rental_intent_id: string
          wallet_balance: number
        }[]
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
      app_role:
        | "user"
        | "admin"
        | "super_admin"
        | "support"
        | "sales"
        | "accounting"
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
      rental_intent_status: "pending" | "paid" | "failed"
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
      app_role: [
        "user",
        "admin",
        "super_admin",
        "support",
        "sales",
        "accounting",
      ],
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
      rental_intent_status: ["pending", "paid", "failed"],
      rental_status: ["active", "expired"],
      submission_status: ["pending", "under_review", "approved", "rejected"],
      submission_type: ["movie", "tv_show"],
      transaction_type: ["rental", "purchase", "wallet_topup"],
    },
  },
} as const
