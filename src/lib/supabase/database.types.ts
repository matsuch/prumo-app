export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      fixed_income: {
        Row: {
          created_at: string
          data_aplicacao: string
          emissor: string
          id: string
          indexador: string
          isento: boolean
          taxa: number
          user_id: string
          valor_aplicado: number
          vencimento: string | null
        }
        Insert: {
          created_at?: string
          data_aplicacao: string
          emissor?: string
          id?: string
          indexador: string
          isento?: boolean
          taxa: number
          user_id?: string
          valor_aplicado: number
          vencimento?: string | null
        }
        Update: {
          created_at?: string
          data_aplicacao?: string
          emissor?: string
          id?: string
          indexador?: string
          isento?: boolean
          taxa?: number
          user_id?: string
          valor_aplicado?: number
          vencimento?: string | null
        }
        Relationships: []
      }
      fixed_expenses: {
        Row: {
          created_at: string
          id: string
          mes: string
          nome: string
          pago: number
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          mes?: string
          nome?: string
          pago?: number
          user_id?: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          mes?: string
          nome?: string
          pago?: number
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      goals: {
        Row: {
          aporte_mensal: number
          created_at: string
          data_alvo: string
          id: string
          nome: string
          user_id: string
          valor_alvo: number
        }
        Insert: {
          aporte_mensal?: number
          created_at?: string
          data_alvo: string
          id?: string
          nome?: string
          user_id?: string
          valor_alvo: number
        }
        Update: {
          aporte_mensal?: number
          created_at?: string
          data_alvo?: string
          id?: string
          nome?: string
          user_id?: string
          valor_alvo?: number
        }
        Relationships: []
      }
      pluggy_items: {
        Row: {
          connector_name: string | null
          created_at: string
          execution_status: string | null
          id: string
          item_id: string
          last_successful_update_at: string | null
          last_synced_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          connector_name?: string | null
          created_at?: string
          execution_status?: string | null
          id?: string
          item_id: string
          last_successful_update_at?: string | null
          last_synced_at?: string | null
          status?: string | null
          user_id?: string
        }
        Update: {
          connector_name?: string | null
          created_at?: string
          execution_status?: string | null
          id?: string
          item_id?: string
          last_successful_update_at?: string | null
          last_synced_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pluggy_accounts: {
        Row: {
          brand: string | null
          external_id: string
          id: string
          item_id: string
          limite_disponivel: number | null
          limite_total: number | null
          nome: string
          saldo: number
          tipo: string
          updated_at: string
          user_id: string
          vencimento: string | null
        }
        Insert: {
          brand?: string | null
          external_id: string
          id?: string
          item_id: string
          limite_disponivel?: number | null
          limite_total?: number | null
          nome?: string
          saldo?: number
          tipo: string
          updated_at?: string
          user_id?: string
          vencimento?: string | null
        }
        Update: {
          brand?: string | null
          external_id?: string
          id?: string
          item_id?: string
          limite_disponivel?: number | null
          limite_total?: number | null
          nome?: string
          saldo?: number
          tipo?: string
          updated_at?: string
          user_id?: string
          vencimento?: string | null
        }
        Relationships: []
      }
      monthly_goal: {
        Row: {
          id: string
          mes: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          id?: string
          mes: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Update: {
          id?: string
          mes?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      monthly_income: {
        Row: {
          id: string
          itens: Json
          mes: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          id?: string
          itens?: Json
          mes: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Update: {
          id?: string
          itens?: Json
          mes?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      pluggy_bills: {
        Row: {
          account_id: string
          closing_date: string | null
          due_date: string | null
          external_id: string
          id: string
          item_id: string
          minimum_payment: number | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          closing_date?: string | null
          due_date?: string | null
          external_id: string
          id?: string
          item_id: string
          minimum_payment?: number | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          closing_date?: string | null
          due_date?: string | null
          external_id?: string
          id?: string
          item_id?: string
          minimum_payment?: number | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_transactions: {
        Row: {
          account_id: string
          categoria: string | null
          data: string | null
          descricao: string
          estabelecimento: string | null
          external_id: string
          id: string
          item_id: string
          parcela: number | null
          tipo: string | null
          total_parcelas: number | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          account_id: string
          categoria?: string | null
          data?: string | null
          descricao?: string
          estabelecimento?: string | null
          external_id: string
          id?: string
          item_id: string
          parcela?: number | null
          tipo?: string | null
          total_parcelas?: number | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Update: {
          account_id?: string
          categoria?: string | null
          data?: string | null
          descricao?: string
          estabelecimento?: string | null
          external_id?: string
          id?: string
          item_id?: string
          parcela?: number | null
          tipo?: string | null
          total_parcelas?: number | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      pluggy_positions: {
        Row: {
          categoria: string
          external_id: string
          id: string
          item_id: string
          nome: string
          rendimento: number
          updated_at: string
          user_id: string
          valor_atual: number
          valor_investido: number
        }
        Insert: {
          categoria: string
          external_id: string
          id?: string
          item_id: string
          nome?: string
          rendimento?: number
          updated_at?: string
          user_id?: string
          valor_atual?: number
          valor_investido?: number
        }
        Update: {
          categoria?: string
          external_id?: string
          id?: string
          item_id?: string
          nome?: string
          rendimento?: number
          updated_at?: string
          user_id?: string
          valor_atual?: number
          valor_investido?: number
        }
        Relationships: []
      }
      snapshots: {
        Row: {
          created_at: string
          data: string
          id: string
          investido: number
          patrimonio: number
          por_classe: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          investido?: number
          patrimonio?: number
          por_classe?: Json | null
          user_id?: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          investido?: number
          patrimonio?: number
          por_classe?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_memory: {
        Row: {
          categoria: string
          conteudo: string
          created_at: string
          id: string
          origem: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string
          conteudo: string
          created_at?: string
          id?: string
          origem?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          categoria?: string
          conteudo?: string
          created_at?: string
          id?: string
          origem?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stocks: {
        Row: {
          created_at: string
          data_compra: string
          id: string
          preco_compra: number
          quantidade: number
          ticker: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_compra: string
          id?: string
          preco_compra: number
          quantidade: number
          ticker: string
          user_id?: string
        }
        Update: {
          created_at?: string
          data_compra?: string
          id?: string
          preco_compra?: number
          quantidade?: number
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          ticker: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ticker: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
