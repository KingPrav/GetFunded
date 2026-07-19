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
      activities: {
        Row: {
          created_at: string
          founder_key: string | null
          id: string
          kind: string
          meta: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          founder_key?: string | null
          id?: string
          kind: string
          meta?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          founder_key?: string | null
          id?: string
          kind?: string
          meta?: Json
          user_id?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          claim: string
          confidence: number
          created_at: string
          evidence_urls: string[]
          founder_key: string
          id: string
          source: string
          source_url: string | null
          user_id: string
          verified: string
        }
        Insert: {
          claim: string
          confidence?: number
          created_at?: string
          evidence_urls?: string[]
          founder_key: string
          id?: string
          source: string
          source_url?: string | null
          user_id: string
          verified?: string
        }
        Update: {
          claim?: string
          confidence?: number
          created_at?: string
          evidence_urls?: string[]
          founder_key?: string
          id?: string
          source?: string
          source_url?: string | null
          user_id?: string
          verified?: string
        }
        Relationships: []
      }
      founder_handles: {
        Row: {
          founder_key: string
          github_handle: string | null
          id: string
          scholar_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          founder_key: string
          github_handle?: string | null
          id?: string
          scholar_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          founder_key?: string
          github_handle?: string | null
          id?: string
          scholar_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      founder_memory: {
        Row: {
          category: string
          confidence: number
          content: string
          created_at: string
          embedding: string | null
          founder_key: string
          id: string
          metadata: Json
          pinned: boolean
          source: string
          summary: string | null
          user_id: string
        }
        Insert: {
          category: string
          confidence?: number
          content: string
          created_at?: string
          embedding?: string | null
          founder_key: string
          id?: string
          metadata?: Json
          pinned?: boolean
          source: string
          summary?: string | null
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number
          content?: string
          created_at?: string
          embedding?: string | null
          founder_key?: string
          id?: string
          metadata?: Json
          pinned?: boolean
          source?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      founder_scores: {
        Row: {
          components: Json
          created_at: string
          founder_key: string
          id: string
          reason: string | null
          total: number
          user_id: string
        }
        Insert: {
          components?: Json
          created_at?: string
          founder_key: string
          id?: string
          reason?: string | null
          total: number
          user_id: string
        }
        Update: {
          components?: Json
          created_at?: string
          founder_key?: string
          id?: string
          reason?: string | null
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      interview_turns: {
        Row: {
          ai_notes: Json
          content: string
          created_at: string
          id: string
          interview_id: string
          seq: number
          speaker: string
          user_id: string
        }
        Insert: {
          ai_notes?: Json
          content: string
          created_at?: string
          id?: string
          interview_id: string
          seq: number
          speaker: string
          user_id: string
        }
        Update: {
          ai_notes?: Json
          content?: string
          created_at?: string
          id?: string
          interview_id?: string
          seq?: number
          speaker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_turns_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          created_at: string
          founder_key: string
          id: string
          recommendation: string | null
          scheduled_at: string | null
          score_deltas: Json
          status: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          founder_key: string
          id?: string
          recommendation?: string | null
          scheduled_at?: string | null
          score_deltas?: Json
          status?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          founder_key?: string
          id?: string
          recommendation?: string | null
          scheduled_at?: string | null
          score_deltas?: Json
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_memos: {
        Row: {
          check_size: string | null
          confidence: number | null
          created_at: string
          founder_key: string
          id: string
          next_steps: string[]
          recommendation: string | null
          sections: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          check_size?: string | null
          confidence?: number | null
          created_at?: string
          founder_key: string
          id?: string
          next_steps?: string[]
          recommendation?: string | null
          sections?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          check_size?: string | null
          confidence?: number | null
          created_at?: string
          founder_key?: string
          id?: string
          next_steps?: string[]
          recommendation?: string | null
          sections?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          founder_key: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          founder_key?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          founder_key?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunity_scores: {
        Row: {
          confidence: number
          created_at: string
          evidence: string[]
          founder_key: string
          id: string
          panel: string
          reason: string | null
          score: number
          strengths: string[]
          user_id: string
          weaknesses: string[]
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence?: string[]
          founder_key: string
          id?: string
          panel: string
          reason?: string | null
          score: number
          strengths?: string[]
          user_id: string
          weaknesses?: string[]
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence?: string[]
          founder_key?: string
          id?: string
          panel?: string
          reason?: string | null
          score?: number
          strengths?: string[]
          user_id?: string
          weaknesses?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      thesis_settings: {
        Row: {
          check_size_max: number | null
          check_size_min: number | null
          geographies: string[]
          notes: string | null
          ownership_target: number | null
          risk_tolerance: string | null
          sectors: string[]
          stages: string[]
          time_horizon: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_size_max?: number | null
          check_size_min?: number | null
          geographies?: string[]
          notes?: string | null
          ownership_target?: number | null
          risk_tolerance?: string | null
          sectors?: string[]
          stages?: string[]
          time_horizon?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_size_max?: number | null
          check_size_min?: number | null
          geographies?: string[]
          notes?: string | null
          ownership_target?: number | null
          risk_tolerance?: string | null
          sectors?: string[]
          stages?: string[]
          time_horizon?: string | null
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
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_founder_memory: {
        Args: {
          _founder_key: string
          _match_count?: number
          _query: string
          _user_id: string
        }
        Returns: {
          category: string
          confidence: number
          content: string
          created_at: string
          id: string
          metadata: Json
          similarity: number
          source: string
          summary: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "investor" | "analyst"
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
      app_role: ["admin", "investor", "analyst"],
    },
  },
} as const
