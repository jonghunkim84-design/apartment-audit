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
      anomaly_detections: {
        Row: {
          affected_receipt_ids: string[] | null
          apartment_complex_id: string
          created_at: string
          description: string | null
          details: Json | null
          detection_date: string
          detection_type: Database["public"]["Enums"]["anomaly_detection_type"]
          id: string
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["anomaly_status"]
          updated_at: string
        }
        Insert: {
          affected_receipt_ids?: string[] | null
          apartment_complex_id: string
          created_at?: string
          description?: string | null
          details?: Json | null
          detection_date?: string
          detection_type: Database["public"]["Enums"]["anomaly_detection_type"]
          id?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["anomaly_status"]
          updated_at?: string
        }
        Update: {
          affected_receipt_ids?: string[] | null
          apartment_complex_id?: string
          created_at?: string
          description?: string | null
          details?: Json | null
          detection_date?: string
          detection_type?: Database["public"]["Enums"]["anomaly_detection_type"]
          id?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["anomaly_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_detections_apartment_complex_id_fkey"
            columns: ["apartment_complex_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
        ]
      }
      apartment_complexes: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          unit_count: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          unit_count?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          unit_count?: number | null
        }
        Relationships: []
      }
      audit_checklist_items: {
        Row: {
          category: string
          checked_at: string | null
          checked_by: string | null
          checklist_id: string
          created_at: string
          evidence_url: string | null
          id: string
          item_text: string
          note: string | null
          status: Database["public"]["Enums"]["checklist_item_status"]
        }
        Insert: {
          category: string
          checked_at?: string | null
          checked_by?: string | null
          checklist_id: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          item_text: string
          note?: string | null
          status?: Database["public"]["Enums"]["checklist_item_status"]
        }
        Update: {
          category?: string
          checked_at?: string | null
          checked_by?: string | null
          checklist_id?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          item_text?: string
          note?: string | null
          status?: Database["public"]["Enums"]["checklist_item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "audit_checklist_items_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "audit_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_checklists: {
        Row: {
          apartment_complex_id: string
          created_at: string
          created_by: string | null
          id: string
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["checklist_status"]
          title: string
          updated_at: string
        }
        Insert: {
          apartment_complex_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["checklist_status"]
          title: string
          updated_at?: string
        }
        Update: {
          apartment_complex_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["checklist_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_checklists_apartment_complex_id_fkey"
            columns: ["apartment_complex_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checklists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_findings: {
        Row: {
          apartment_complex_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          receipt_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          apartment_complex_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          receipt_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          apartment_complex_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          receipt_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_apartment_complex_id_fkey"
            columns: ["apartment_complex_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          file_id: string
          id: string
          ip_address: string | null
          metadata: Json | null
          receipt_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          file_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          receipt_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          file_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          receipt_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          apartment_complex_id: string
          business_number: string | null
          contract_amount: number
          contract_end: string | null
          contract_start: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          contractor_name: string
          created_at: string
          created_by: string | null
          document_url: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at: string
        }
        Insert: {
          apartment_complex_id: string
          business_number?: string | null
          contract_amount: number
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          contractor_name: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at?: string
        }
        Update: {
          apartment_complex_id?: string
          business_number?: string | null
          contract_amount?: number
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          contractor_name?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_apartment_complex_id_fkey"
            columns: ["apartment_complex_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      misc_income: {
        Row: {
          amount: number
          apartment_complex_id: string
          category: Database["public"]["Enums"]["misc_income_category"]
          created_at: string
          created_by: string | null
          description: string | null
          evidence_url: string | null
          id: string
          income_date: string
          verified_by: string | null
        }
        Insert: {
          amount: number
          apartment_complex_id: string
          category: Database["public"]["Enums"]["misc_income_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_url?: string | null
          id?: string
          income_date: string
          verified_by?: string | null
        }
        Update: {
          amount?: number
          apartment_complex_id?: string
          category?: Database["public"]["Enums"]["misc_income_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_url?: string | null
          id?: string
          income_date?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "misc_income_apartment_complex_id_fkey"
            columns: ["apartment_complex_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "misc_income_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "misc_income_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apartment_complex_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          apartment_complex_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          apartment_complex_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_apartment_complex_id_fkey"
            columns: ["apartment_complex_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_policy_checks: {
        Row: {
          check_type: Database["public"]["Enums"]["policy_check_type"]
          created_at: string
          details: Json | null
          id: string
          is_violation: boolean
          receipt_id: string
        }
        Insert: {
          check_type: Database["public"]["Enums"]["policy_check_type"]
          created_at?: string
          details?: Json | null
          id?: string
          is_violation?: boolean
          receipt_id: string
        }
        Update: {
          check_type?: Database["public"]["Enums"]["policy_check_type"]
          created_at?: string
          details?: Json | null
          id?: string
          is_violation?: boolean
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_policy_checks_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          ai_parsed_data: Json | null
          amount: number | null
          apartment_complex_id: string
          approval_number: string | null
          business_number: string | null
          card_company: string | null
          card_last_four: string | null
          confidence_score: number | null
          created_at: string
          id: string
          item_description: string | null
          merchant_address: string | null
          merchant_category: string | null
          merchant_name: string | null
          ocr_raw_text: string | null
          original_image_url: string | null
          payment_method: string | null
          policy_flags: Json | null
          receipt_date: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["receipt_status"]
          supply_amount: number | null
          tax_amount: number | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          ai_parsed_data?: Json | null
          amount?: number | null
          apartment_complex_id: string
          approval_number?: string | null
          business_number?: string | null
          card_company?: string | null
          card_last_four?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          item_description?: string | null
          merchant_address?: string | null
          merchant_category?: string | null
          merchant_name?: string | null
          ocr_raw_text?: string | null
          original_image_url?: string | null
          payment_method?: string | null
          policy_flags?: Json | null
          receipt_date?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          supply_amount?: number | null
          tax_amount?: number | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          ai_parsed_data?: Json | null
          amount?: number | null
          apartment_complex_id?: string
          approval_number?: string | null
          business_number?: string | null
          card_company?: string | null
          card_last_four?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          item_description?: string | null
          merchant_address?: string | null
          merchant_category?: string | null
          merchant_name?: string | null
          ocr_raw_text?: string | null
          original_image_url?: string | null
          payment_method?: string | null
          policy_flags?: Json | null
          receipt_date?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          supply_amount?: number | null
          tax_amount?: number | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_apartment_complex_id_fkey"
            columns: ["apartment_complex_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          apartment_complex_id: string
          content: Json | null
          created_at: string
          created_by: string | null
          id: string
          period_end: string | null
          period_start: string | null
          published_at: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          status: Database["public"]["Enums"]["report_status"]
          summary_stats: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          apartment_complex_id: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          status?: Database["public"]["Enums"]["report_status"]
          summary_stats?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          apartment_complex_id?: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          status?: Database["public"]["Enums"]["report_status"]
          summary_stats?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_apartment_complex_id_fkey"
            columns: ["apartment_complex_id"]
            isOneToOne: false
            referencedRelation: "apartment_complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_apartment_complex_id: { Args: never; Returns: string }
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      jwt_ext_period_end: { Args: never; Returns: string }
      jwt_ext_period_start: { Args: never; Returns: string }
      jwt_user_role: { Args: never; Returns: string }
    }
    Enums: {
      anomaly_detection_type:
        | "benfords_law"
        | "acfe_pattern"
        | "statistical_outlier"
      anomaly_status: "open" | "investigating" | "resolved" | "false_positive"
      checklist_item_status: "pending" | "pass" | "fail" | "na"
      checklist_status: "draft" | "in_progress" | "completed"
      contract_status: "active" | "expired" | "terminated"
      contract_type: "service" | "construction" | "supply" | "other"
      misc_income_category:
        | "parking"
        | "rental"
        | "interest"
        | "penalty"
        | "other"
      policy_check_type:
        | "split_payment"
        | "time_restriction"
        | "prohibited_category"
        | "limit_exceeded"
      receipt_status:
        | "pending"
        | "processing"
        | "manual_review"
        | "approved"
        | "rejected"
      report_status: "draft" | "review" | "published"
      report_type: "monthly" | "quarterly" | "annual" | "special"
      severity_level: "low" | "medium" | "high"
      user_role: "admin" | "auditor" | "viewer"
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
      anomaly_detection_type: [
        "benfords_law",
        "acfe_pattern",
        "statistical_outlier",
      ],
      anomaly_status: ["open", "investigating", "resolved", "false_positive"],
      checklist_item_status: ["pending", "pass", "fail", "na"],
      checklist_status: ["draft", "in_progress", "completed"],
      contract_status: ["active", "expired", "terminated"],
      contract_type: ["service", "construction", "supply", "other"],
      misc_income_category: [
        "parking",
        "rental",
        "interest",
        "penalty",
        "other",
      ],
      policy_check_type: [
        "split_payment",
        "time_restriction",
        "prohibited_category",
        "limit_exceeded",
      ],
      receipt_status: [
        "pending",
        "processing",
        "manual_review",
        "approved",
        "rejected",
      ],
      report_status: ["draft", "review", "published"],
      report_type: ["monthly", "quarterly", "annual", "special"],
      severity_level: ["low", "medium", "high"],
      user_role: ["admin", "auditor", "viewer"],
    },
  },
} as const
