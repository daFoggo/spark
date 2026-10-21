export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          date: string
          goal_id: string | null
          habit_id: string | null
          hours: number | null
          id: number
          level: string
          note: string | null
          source: string
          task_id: string | null
          topic: string | null
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          date: string
          goal_id?: string | null
          habit_id?: string | null
          hours?: number | null
          id?: never
          level?: string
          note?: string | null
          source: string
          task_id?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          goal_id?: string | null
          habit_id?: string | null
          hours?: number | null
          id?: never
          level?: string
          note?: string | null
          source?: string
          task_id?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoints: {
        Row: {
          created_at: string
          done_on: string | null
          goal_id: string
          id: string
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          done_on?: string | null
          goal_id: string
          id?: string
          position?: number
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          done_on?: string | null
          goal_id?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          becoming: string | null
          created_at: string
          id: string
          if_hard_obstacle: string | null
          if_hard_plan: string | null
          name: string
          position: number
          slug: string
          status: string
          target_date: string | null
          updated_at: string
          user_id: string
          why: string | null
        }
        ComputedFields: never
        Insert: {
          becoming?: string | null
          created_at?: string
          id?: string
          if_hard_obstacle?: string | null
          if_hard_plan?: string | null
          name: string
          position?: number
          slug: string
          status?: string
          target_date?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Update: {
          becoming?: string | null
          created_at?: string
          id?: string
          if_hard_obstacle?: string | null
          if_hard_plan?: string | null
          name?: string
          position?: number
          slug?: string
          status?: string
          target_date?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Relationships: []
      }
      habit_schedules: {
        Row: {
          created_at: string
          every_n: number | null
          habit_id: string
          id: string
          kind: string
          updated_at: string
          user_id: string
          valid_from: string
          weekdays: number[] | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          every_n?: number | null
          habit_id: string
          id?: string
          kind: string
          updated_at?: string
          user_id?: string
          valid_from: string
          weekdays?: number[] | null
        }
        Update: {
          created_at?: string
          every_n?: number | null
          habit_id?: string
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string
          valid_from?: string
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_schedules_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          created_at: string
          cue: string | null
          full_version: string | null
          goal_id: string | null
          id: string
          minimum_version: string | null
          name: string
          paused_from: string | null
          paused_until: string | null
          position: number
          starts_on: string
          time_of_day: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          created_at?: string
          cue?: string | null
          full_version?: string | null
          goal_id?: string | null
          id?: string
          minimum_version?: string | null
          name: string
          paused_from?: string | null
          paused_until?: string | null
          position?: number
          starts_on: string
          time_of_day?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          cue?: string | null
          full_version?: string | null
          goal_id?: string | null
          id?: string
          minimum_version?: string | null
          name?: string
          paused_from?: string | null
          paused_until?: string | null
          position?: number
          starts_on?: string
          time_of_day?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          completed_at: string | null
          created_at: string
          focus_task_ids: string[]
          habit_choices: NonNullable<Json>
          id: string
          reflection: string | null
          updated_at: string
          user_id: string
          week_start_on: string
        }
        ComputedFields: never
        Insert: {
          completed_at?: string | null
          created_at?: string
          focus_task_ids?: string[]
          habit_choices?: NonNullable<Json>
          id?: string
          reflection?: string | null
          updated_at?: string
          user_id?: string
          week_start_on: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          focus_task_ids?: string[]
          habit_choices?: NonNullable<Json>
          id?: string
          reflection?: string | null
          updated_at?: string
          user_id?: string
          week_start_on?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          created_on: string
          done_on: string | null
          focus_from: string | null
          goal_id: string | null
          id: string
          list: string
          note: string | null
          title: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_on?: string
          done_on?: string | null
          focus_from?: string | null
          goal_id?: string | null
          id?: string
          list?: string
          note?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          created_on?: string
          done_on?: string | null
          focus_from?: string | null
          goal_id?: string | null
          id?: string
          list?: string
          note?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          adopted_on: string
          created_at: string
          pet_name: string
          timezone: string
          timezone_confirmed: boolean
          updated_at: string
          user_id: string
          week_start: number
        }
        ComputedFields: never
        Insert: {
          adopted_on?: string
          created_at?: string
          pet_name?: string
          timezone?: string
          timezone_confirmed?: boolean
          updated_at?: string
          user_id: string
          week_start?: number
        }
        Update: {
          adopted_on?: string
          created_at?: string
          pet_name?: string
          timezone?: string
          timezone_confirmed?: boolean
          updated_at?: string
          user_id?: string
          week_start?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_review: {
        Args: {
          p_choices: Json
          p_focus: string[]
          p_reflection: string
          p_week_start: string
        }
        Returns: undefined
      }
      create_goal: {
        Args: { p_name: string }
        Returns: {
          id: string
          slug: string
          status: string
        }[]
      }
      create_habit: {
        Args: {
          p_cue: string
          p_every_n: number
          p_full: string
          p_goal_id?: string
          p_kind: string
          p_minimum: string
          p_name: string
          p_time_of_day: string
          p_weekdays: number[]
        }
        Returns: string
      }
      log_task: { Args: { p_task_id: string }; Returns: number }
      move_checkpoint: {
        Args: { p_checkpoint_id: string; p_direction: number }
        Returns: undefined
      }
      set_checkpoint_done: {
        Args: { p_checkpoint_id: string; p_done: boolean }
        Returns: string
      }
      set_habit_schedule: {
        Args: {
          p_every_n: number
          p_habit_id: string
          p_kind: string
          p_weekdays: number[]
        }
        Returns: undefined
      }
      set_task_done: {
        Args: { p_done: boolean; p_task_id: string }
        Returns: string
      }
      toggle_check_in: {
        Args: { p_date: string; p_habit_id: string; p_level: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
