export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      account_balances: {
        Row: {
          account_name: string
          budget_period_id: string
          created_at: string
          estimated_final_balance: number | null
          final_balance: number | null
          final_balance_set: boolean | null
          id: string
          starting_balance: number | null
          starting_balance_set: boolean | null
          updated_at: string
        }
        Insert: {
          account_name: string
          budget_period_id: string
          created_at?: string
          estimated_final_balance?: number | null
          final_balance?: number | null
          final_balance_set?: boolean | null
          id?: string
          starting_balance?: number | null
          starting_balance_set?: boolean | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          budget_period_id?: string
          created_at?: string
          estimated_final_balance?: number | null
          final_balance?: number | null
          final_balance_set?: boolean | null
          id?: string
          starting_balance?: number | null
          starting_balance_set?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balances_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_calculations: {
        Row: {
          budget_period_id: string
          calculation_data: Json
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          budget_period_id: string
          calculation_data: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          budget_period_id?: string
          calculation_data?: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_calculations_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: true
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          account: string | null
          amount: number
          budget_period_id: string
          category_id: string
          category_type: string
          created_at: string
          financed_from: string | null
          id: string
          is_personal: boolean
          name: string
          person_name: string | null
          updated_at: string
        }
        Insert: {
          account?: string | null
          amount?: number
          budget_period_id: string
          category_id: string
          category_type: string
          created_at?: string
          financed_from?: string | null
          id?: string
          is_personal?: boolean
          name: string
          person_name?: string | null
          updated_at?: string
        }
        Update: {
          account?: string | null
          amount?: number
          budget_period_id?: string
          category_id?: string
          category_type?: string
          created_at?: string
          financed_from?: string | null
          id?: string
          is_personal?: boolean
          name?: string
          person_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_config: {
        Row: {
          config_data: Json
          config_type: string
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          config_data: Json
          config_type: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          config_data?: Json
          config_type?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      budget_holidays: {
        Row: {
          budget_period_id: string
          created_at: string
          holiday_date: string
          holiday_name: string
          id: string
        }
        Insert: {
          budget_period_id: string
          created_at?: string
          holiday_date: string
          holiday_name: string
          id?: string
        }
        Update: {
          budget_period_id?: string
          created_at?: string
          holiday_date?: string
          holiday_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_holidays_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_income: {
        Row: {
          amount: number
          budget_period_id: string
          created_at: string
          id: string
          income_type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          budget_period_id: string
          created_at?: string
          id?: string
          income_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_period_id?: string
          created_at?: string
          id?: string
          income_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_income_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_periods: {
        Row: {
          created_at: string
          id: string
          month: number
          updated_at: string
          user_id: string | null
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          updated_at?: string
          user_id?: string | null
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      budget_subcategories: {
        Row: {
          account: string | null
          amount: number
          budget_category_id: string
          created_at: string
          financed_from: string | null
          id: string
          name: string
          subcategory_id: string
          updated_at: string
        }
        Insert: {
          account?: string | null
          amount?: number
          budget_category_id: string
          created_at?: string
          financed_from?: string | null
          id?: string
          name: string
          subcategory_id: string
          updated_at?: string
        }
        Update: {
          account?: string | null
          amount?: number
          budget_category_id?: string
          created_at?: string
          financed_from?: string | null
          id?: string
          name?: string
          subcategory_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_subcategories_budget_category_id_fkey"
            columns: ["budget_category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_templates: {
        Row: {
          created_at: string
          id: string
          template_data: Json
          template_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          template_data: Json
          template_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          template_data?: Json
          template_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      budget_transfers: {
        Row: {
          budget_period_id: string
          created_at: string
          daily_transfer: number
          id: string
          transfer_account: number
          updated_at: string
          weekend_transfer: number
        }
        Insert: {
          budget_period_id: string
          created_at?: string
          daily_transfer?: number
          id?: string
          transfer_account?: number
          updated_at?: string
          weekend_transfer?: number
        }
        Update: {
          budget_period_id?: string
          created_at?: string
          daily_transfer?: number
          id?: string
          transfer_account?: number
          updated_at?: string
          weekend_transfer?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_transfers_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: true
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
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
    Enums: {},
  },
} as const
