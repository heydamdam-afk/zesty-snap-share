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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      banned_invites: {
        Row: {
          banned_by: string | null
          created_at: string
          device_id: string
          event_id: string
          id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          device_id: string
          event_id: string
          id?: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          device_id?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banned_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      commentaires: {
        Row: {
          contenu: string
          created_at: string
          id: string
          invite_id: string
          photo_id: string
        }
        Insert: {
          contenu: string
          created_at?: string
          id?: string
          invite_id: string
          photo_id: string
        }
        Update: {
          contenu?: string
          created_at?: string
          id?: string
          invite_id?: string
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commentaires_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commentaires_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_admins: {
        Row: {
          created_at: string
          event_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_admins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          code_acces: string
          commentaires_actifs: boolean
          contact: string | null
          cover_url: string | null
          created_at: string
          event_date: string | null
          expire_at: string | null
          id: string
          lieu: string | null
          likes_actifs: boolean
          slug: string
          status: Database["public"]["Enums"]["event_status"]
          telechargement_actif: boolean
          titre: string
        }
        Insert: {
          code_acces: string
          commentaires_actifs?: boolean
          contact?: string | null
          cover_url?: string | null
          created_at?: string
          event_date?: string | null
          expire_at?: string | null
          id?: string
          lieu?: string | null
          likes_actifs?: boolean
          slug: string
          status?: Database["public"]["Enums"]["event_status"]
          telechargement_actif?: boolean
          titre: string
        }
        Update: {
          code_acces?: string
          commentaires_actifs?: boolean
          contact?: string | null
          cover_url?: string | null
          created_at?: string
          event_date?: string | null
          expire_at?: string | null
          id?: string
          lieu?: string | null
          likes_actifs?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["event_status"]
          telechargement_actif?: boolean
          titre?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          avatar_url: string | null
          created_at: string
          device_id: string
          email: string | null
          event_id: string
          id: string
          prenom: string
          rgpd_consent: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          device_id: string
          email?: string | null
          event_id: string
          id?: string
          prenom: string
          rgpd_consent?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          device_id?: string
          email?: string | null
          event_id?: string
          id?: string
          prenom?: string
          rgpd_consent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          invite_id: string
          photo_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_id: string
          photo_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_id?: string
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_photos: {
        Row: {
          created_at: string
          id: string
          position: number
          post_id: string
          url_full: string | null
          url_medium: string | null
          url_miniature: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          post_id: string
          url_full?: string | null
          url_medium?: string | null
          url_miniature?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          post_id?: string
          url_full?: string | null
          url_medium?: string | null
          url_miniature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_photos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          contenu_texte: string | null
          created_at: string
          event_id: string
          id: string
          invite_id: string
          nb_likes: number
          url_full: string | null
          url_medium: string | null
          url_miniature: string | null
        }
        Insert: {
          contenu_texte?: string | null
          created_at?: string
          event_id: string
          id?: string
          invite_id: string
          nb_likes?: number
          url_full?: string | null
          url_medium?: string | null
          url_miniature?: string | null
        }
        Update: {
          contenu_texte?: string | null
          created_at?: string
          event_id?: string
          id?: string
          invite_id?: string
          nb_likes?: number
          url_full?: string | null
          url_medium?: string | null
          url_miniature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ban_invite_cascade: {
        Args: { _device_id: string; _event_id: string }
        Returns: boolean
      }
      delete_own_commentaire: {
        Args: { _commentaire_id: string; _device_id: string }
        Returns: boolean
      }
      delete_own_like: {
        Args: { _device_id: string; _photo_id: string }
        Returns: boolean
      }
      is_event_admin: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      update_own_invite: {
        Args: {
          _avatar_url?: string
          _device_id: string
          _email?: string
          _event_id: string
          _rgpd_consent?: boolean
        }
        Returns: {
          avatar_url: string | null
          created_at: string
          device_id: string
          email: string | null
          event_id: string
          id: string
          prenom: string
          rgpd_consent: boolean
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      event_status: "active" | "expired" | "archived"
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
      event_status: ["active", "expired", "archived"],
    },
  },
} as const
