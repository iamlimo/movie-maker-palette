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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          parent_comment_id: string | null
          post_id: string
          replies_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id: string
          replies_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id?: string
          replies_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean | null
          member_count: number | null
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          member_count?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          member_count?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          participant_1_id: string
          participant_2_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_1_id: string
          participant_2_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_1_id?: string
          participant_2_id?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_seen: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          created_at: string
          id: string
          name: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          usage_count?: number
        }
        Relationships: []
      }
      interests: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          media_type: string | null
          media_url: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          content: string
          id: string
          is_active: boolean | null
          template_key: string
          title: string
          updated_at: string | null
          updated_by: string
          variables: Json | null
        }
        Insert: {
          content: string
          id?: string
          is_active?: boolean | null
          template_key: string
          title: string
          updated_at?: string | null
          updated_by: string
          variables?: Json | null
        }
        Update: {
          content?: string
          id?: string
          is_active?: boolean | null
          template_key?: string
          title?: string
          updated_at?: string | null
          updated_by?: string
          variables?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          sender_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by: string
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string
        }
        Relationships: []
      }
      post_analytics: {
        Row: {
          click_through_rate: number | null
          id: string
          impressions_count: number | null
          post_id: string
          reach_count: number | null
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          click_through_rate?: number | null
          id?: string
          impressions_count?: number | null
          post_id: string
          reach_count?: number | null
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          click_through_rate?: number | null
          id?: string
          impressions_count?: number | null
          post_id?: string
          reach_count?: number | null
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "trending_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          created_at: string
          hashtag_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          hashtag_id: string
          post_id: string
        }
        Update: {
          created_at?: string
          hashtag_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "trending_hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          media_type: string
          media_url: string
          order_index: number | null
          post_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          media_type: string
          media_url: string
          order_index?: number | null
          post_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          media_type?: string
          media_url?: string
          order_index?: number | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          category: Database["public"]["Enums"]["content_category"] | null
          comments_count: number | null
          content: string | null
          created_at: string | null
          engagement_score: number | null
          enlightenment_score: number | null
          id: string
          is_public: boolean | null
          likes_count: number | null
          location: string | null
          reliability_score: number | null
          saves_count: number | null
          shares_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["content_category"] | null
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          engagement_score?: number | null
          enlightenment_score?: number | null
          id?: string
          is_public?: boolean | null
          likes_count?: number | null
          location?: string | null
          reliability_score?: number | null
          saves_count?: number | null
          shares_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["content_category"] | null
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          engagement_score?: number | null
          enlightenment_score?: number | null
          id?: string
          is_public?: boolean | null
          likes_count?: number | null
          location?: string | null
          reliability_score?: number | null
          saves_count?: number | null
          shares_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_top_creators"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "trending_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          date_of_birth: string | null
          followers_count: number | null
          following_count: number | null
          full_name: string | null
          id: string
          is_private: boolean | null
          is_verified: boolean | null
          nationality: string | null
          onboarding_completed: boolean | null
          phone_number: string | null
          posts_count: number | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          id?: string
          is_private?: boolean | null
          is_verified?: boolean | null
          nationality?: string | null
          onboarding_completed?: boolean | null
          phone_number?: string | null
          posts_count?: number | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          id?: string
          is_private?: boolean | null
          is_verified?: boolean | null
          nationality?: string | null
          onboarding_completed?: boolean | null
          phone_number?: string | null
          posts_count?: number | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_nationality_fkey"
            columns: ["nationality"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          id: string
          reason: string | null
          reported_comment_id: string | null
          reported_post_id: string | null
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          type: Database["public"]["Enums"]["report_type"]
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          reported_comment_id?: string | null
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          type: Database["public"]["Enums"]["report_type"]
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          reported_comment_id?: string | null
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["report_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_comment_id_fkey"
            columns: ["reported_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_post_id_fkey"
            columns: ["reported_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_post_id_fkey"
            columns: ["reported_post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          clicked_result_id: string | null
          created_at: string
          id: string
          query: string
          result_type: string | null
          results_count: number | null
          user_id: string | null
        }
        Insert: {
          clicked_result_id?: string | null
          created_at?: string
          id?: string
          query: string
          result_type?: string | null
          results_count?: number | null
          user_id?: string | null
        }
        Update: {
          clicked_result_id?: string | null
          created_at?: string
          id?: string
          query?: string
          result_type?: string | null
          results_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          activity_type: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          ban_type: string
          banned_by: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          reason: string | null
          user_id: string
        }
        Insert: {
          ban_type?: string
          banned_by: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          user_id: string
        }
        Update: {
          ban_type?: string
          banned_by?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_deletion_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          processed_at: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          created_at: string | null
          id: string
          interest_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interest_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          feed_algorithm_weight: Json | null
          id: string
          notification_prefs: Json
          preferred_categories:
            | Database["public"]["Enums"]["content_category"][]
            | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feed_algorithm_weight?: Json | null
          id?: string
          notification_prefs?: Json
          preferred_categories?:
            | Database["public"]["Enums"]["content_category"][]
            | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          feed_algorithm_weight?: Json | null
          id?: string
          notification_prefs?: Json
          preferred_categories?:
            | Database["public"]["Enums"]["content_category"][]
            | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      word_filters: {
        Row: {
          action: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          replacement_text: string | null
          severity: string
          word: string
        }
        Insert: {
          action?: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          replacement_text?: string | null
          severity?: string
          word: string
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          replacement_text?: string | null
          severity?: string
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_engagement_stats: {
        Row: {
          comments_today: number | null
          likes_today: number | null
          posts_today: number | null
          total_comments: number | null
          total_likes: number | null
          total_shares: number | null
        }
        Relationships: []
      }
      admin_top_creators: {
        Row: {
          avatar_url: string | null
          followers_count: number | null
          full_name: string | null
          posts_count: number | null
          total_likes_received: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      admin_user_stats: {
        Row: {
          active_users_30d: number | null
          active_users_today: number | null
          new_users_30d: number | null
          new_users_today: number | null
          total_users: number | null
        }
        Relationships: []
      }
      trending_hashtags: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          usage_count: number | null
        }
        Relationships: []
      }
      trending_posts_public: {
        Row: {
          comments_count: number | null
          content: string | null
          created_at: string | null
          engagement_score: number | null
          id: string | null
          likes_count: number | null
          saves_count: number | null
          shares_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_top_creators"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "trending_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trending_users: {
        Row: {
          avatar_url: string | null
          followers_count: number | null
          full_name: string | null
          is_verified: boolean | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_notification: {
        Args: {
          _content: string
          _data?: Json
          _sender_id: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: undefined
      }
      log_admin_action: {
        Args: {
          _action: string
          _new_values?: Json
          _old_values?: Json
          _target_id?: string
          _target_type?: string
        }
        Returns: undefined
      }
      notify_mentions_in_text: {
        Args: { _context: Json; _sender_id: string; _text: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "user" | "admin" | "super_admin" | "moderator"
      content_category:
        | "technology"
        | "lifestyle"
        | "education"
        | "entertainment"
        | "sports"
        | "business"
        | "health"
        | "travel"
        | "food"
        | "art"
        | "music"
        | "gaming"
        | "news"
        | "science"
      notification_type:
        | "like"
        | "comment"
        | "follow"
        | "message"
        | "mention"
        | "system"
      report_type:
        | "spam"
        | "harassment"
        | "inappropriate_content"
        | "fake_account"
        | "other"
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
      app_role: ["user", "admin", "super_admin", "moderator"],
      content_category: [
        "technology",
        "lifestyle",
        "education",
        "entertainment",
        "sports",
        "business",
        "health",
        "travel",
        "food",
        "art",
        "music",
        "gaming",
        "news",
        "science",
      ],
      notification_type: [
        "like",
        "comment",
        "follow",
        "message",
        "mention",
        "system",
      ],
      report_type: [
        "spam",
        "harassment",
        "inappropriate_content",
        "fake_account",
        "other",
      ],
    },
  },
} as const
