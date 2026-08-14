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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      expenses: {
        Row: {
          id: string
          store_id: string | null
          date: string
          description: string
          amount: number
          category: string
          supplier_id: string | null
          invoice_number: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id?: string | null
          date: string
          description: string
          amount: number
          category: string
          supplier_id?: string | null
          invoice_number?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string | null
          date?: string
          description?: string
          amount?: number
          category?: string
          supplier_id?: string | null
          invoice_number?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      },
      suppliers: {
        Row: {
          id: string
          store_id: string | null
          name: string
          rnc: string | null
          contact: string | null
          phone: string | null
          payment_method: string | null
          bank_name: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id?: string | null
          name: string
          rnc?: string | null
          contact?: string | null
          phone?: string | null
          payment_method?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string | null
          name?: string
          rnc?: string | null
          contact?: string | null
          phone?: string | null
          payment_method?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      },
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      },
      payrolls: {
        Row: {
          id: string
          store_id: string | null
          period_start: string
          period_end: string
          total_amount: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id?: string | null
          period_start: string
          period_end: string
          total_amount?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string | null
          period_start?: string
          period_end?: string
          total_amount?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payrolls_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      },
      payroll_items: {
        Row: {
          id: string
          payroll_id: string
          profile_id: string | null
          employee_name: string | null
          base_salary: number
          bonuses: number
          deductions: number
          net_salary: number
          payment_date: string | null
          status: string
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payroll_id: string
          profile_id?: string | null
          employee_name?: string | null
          base_salary?: number
          bonuses?: number
          deductions?: number
          net_salary?: number
          payment_date?: string | null
          status?: string
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          payroll_id?: string
          profile_id?: string | null
          employee_name?: string | null
          base_salary?: number
          bonuses?: number
          deductions?: number
          net_salary?: number
          payment_date?: string | null
          status?: string
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payrolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          created_at: string
          email: string | null
          id: string
          logo_cart_size: number
          logo_invoice_size: number
          logo_summary_size: number
          logo_url: string | null
          meta_description: string | null
          phone: string | null
          rnc: string | null
          slogan: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_twitter: string | null
          store_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_cart_size?: number
          logo_invoice_size?: number
          logo_summary_size?: number
          logo_url?: string | null
          meta_description?: string | null
          phone?: string | null
          rnc?: string | null
          slogan?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_twitter?: string | null
          store_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_cart_size?: number
          logo_invoice_size?: number
          logo_summary_size?: number
          logo_url?: string | null
          meta_description?: string | null
          phone?: string | null
          rnc?: string | null
          slogan?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_twitter?: string | null
          store_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          company_id: string | null
          created_at: string
          end_date: string | null
          id: string
          plan_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          plan_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          plan_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          credit_due_date: string | null
          credit_limit: number | null
          credit_used: number | null
          customer_type: string | null
          email: string | null
          id: string
          last_purchase_date: string | null
          name: string
          phone: string | null
          rnc: string | null
          store_id: string | null
          total_purchases: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          credit_due_date?: string | null
          credit_limit?: number | null
          credit_used?: number | null
          customer_type?: string | null
          email?: string | null
          id?: string
          last_purchase_date?: string | null
          name: string
          phone?: string | null
          rnc?: string | null
          store_id?: string | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          credit_due_date?: string | null
          credit_limit?: number | null
          credit_used?: number | null
          customer_type?: string | null
          email?: string | null
          id?: string
          last_purchase_date?: string | null
          name?: string
          phone?: string | null
          rnc?: string | null
          store_id?: string | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          created_at: string
          current_number: number
          id: string
          invoice_type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_number?: number
          id?: string
          invoice_type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_number?: number
          id?: string
          invoice_type_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_types: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          id: string
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      open_order_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          subtotal: number
          tax_amount: number
          tax_percentage: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          subtotal: number
          tax_amount?: number
          tax_percentage?: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          subtotal?: number
          tax_amount?: number
          tax_percentage?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "open_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "open_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      open_orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          discount_total: number
          id: string
          notes: string | null
          order_number: string
          order_status: string
          payment_method: string
          payment_status: string
          profile_id: string | null
          source: string
          store_id: string | null
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          order_number: string
          order_status?: string
          payment_method: string
          payment_status?: string
          profile_id?: string | null
          source?: string
          store_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          order_number?: string
          order_status?: string
          payment_method?: string
          payment_status?: string
          profile_id?: string | null
          source?: string
          store_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods_config: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          instructions: string | null
          is_active: boolean
          is_online: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_online?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_online?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost: number | null
          cost_includes_tax: boolean | null
          created_at: string | null
          discount_end_date: string | null
          discount_percentage: number | null
          discount_start_date: string | null
          id: string
          image_url: string | null
          internal_code: string | null
          is_featured: boolean | null
          is_visible_in_store: boolean | null
          is_variable_price: boolean | null
          min_stock: number | null
          name: string
          price: number
          status: string | null
          stock: number | null
          store_id: string | null
          tax_percentage: number | null
          track_inventory: boolean | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost?: number | null
          cost_includes_tax?: boolean | null
          created_at?: string | null
          discount_end_date?: string | null
          discount_percentage?: number | null
          discount_start_date?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_featured?: boolean | null
          is_visible_in_store?: boolean | null
          is_variable_price?: boolean | null
          min_stock?: number | null
          name: string
          price: number
          status?: string | null
          stock?: number | null
          store_id?: string | null
          tax_percentage?: number | null
          track_inventory?: boolean | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost?: number | null
          cost_includes_tax?: boolean | null
          created_at?: string | null
          discount_end_date?: string | null
          discount_percentage?: number | null
          discount_start_date?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_featured?: boolean | null
          is_visible_in_store?: boolean | null
          is_variable_price?: boolean | null
          min_stock?: number | null
          name?: string
          price?: number
          status?: string | null
          stock?: number | null
          store_id?: string | null
          tax_percentage?: number | null
          track_inventory?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
          store_id: string | null
          updated_at: string
          user_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
          store_id?: string | null
          updated_at?: string
          user_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          store_id?: string | null
          updated_at?: string
          user_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      promotional_banners: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          sort_order: number | null
          store_id: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          store_id?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          store_id?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotional_banners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          product_id: string | null
          quantity: number
          sale_id: string | null
          subtotal: number
          tax_amount: number
          tax_percentage: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          product_id?: string | null
          quantity: number
          sale_id?: string | null
          subtotal: number
          tax_amount: number
          tax_percentage: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_percentage?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number | null
          amount_received: number | null
          change_amount: number | null
          created_at: string | null
          customer_id: string | null
          discount_total: number | null
          due_date: string | null
          id: string
          invoice_number: string
          invoice_type_id: string | null
          payment_method: string
          payment_status: string | null
          split_cash: number | null
          split_method: string | null
          status: string | null
          store_id: string | null
          subtotal: number
          tax_total: number
          total: number
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          amount_received?: number | null
          change_amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_total?: number | null
          due_date?: string | null
          id?: string
          invoice_number: string
          invoice_type_id?: string | null
          payment_method: string
          payment_status?: string | null
          split_cash?: number | null
          split_method?: string | null
          status?: string | null
          store_id?: string | null
          subtotal: number
          tax_total: number
          total: number
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          amount_received?: number | null
          change_amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_total?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          invoice_type_id?: string | null
          payment_method?: string
          payment_status?: string | null
          split_cash?: number | null
          split_method?: string | null
          status?: string | null
          store_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_type_id_fkey"
            columns: ["invoice_type_id"]
            isOneToOne: false
            referencedRelation: "invoice_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_carts: {
        Row: {
          cart_data: Json
          created_at: string
          id: string
          profile_id: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          cart_data?: Json
          created_at?: string
          id?: string
          profile_id?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          cart_data?: Json
          created_at?: string
          id?: string
          profile_id?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_carts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          ai_api_key: string | null
          auto_backup: boolean | null
          auto_increment: boolean | null
          backup_frequency: string | null
          created_at: string
          currency: string | null
          default_tax_rate: number | null
          email_reports_enabled: boolean | null
          email_reports_frequency: string | null
          email_reports_last_sent: string | null
          email_reports_recipient: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_enabled: boolean | null
          evolution_instance_name: string | null
          id: string
          invoice_footer_text: string | null
          invoice_prefix: string | null
          language: string | null
          log_retention_days: number | null
          low_stock_alert: boolean | null
          low_stock_threshold: number | null
          notifications_enabled: boolean | null
          paper_size: string | null
          payment_methods: Json | null
          payment_terms: number | null
          pos_layout_grid_cols: number | null
          show_tax: boolean | null
          store_id: string | null
          theme: string | null
          thermal_printer_name: string | null
          timezone: string | null
          updated_at: string
          use_thermal_printer: boolean | null
          web_order_sound_enabled: boolean | null
          web_order_sound_type: string | null
          web_order_sound_volume: number | null
        }
        Insert: {
          ai_api_key?: string | null
          auto_backup?: boolean | null
          auto_increment?: boolean | null
          backup_frequency?: string | null
          created_at?: string
          currency?: string | null
          default_tax_rate?: number | null
          email_reports_enabled?: boolean | null
          email_reports_frequency?: string | null
          email_reports_last_sent?: string | null
          email_reports_recipient?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_enabled?: boolean | null
          evolution_instance_name?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_prefix?: string | null
          language?: string | null
          log_retention_days?: number | null
          low_stock_alert?: boolean | null
          low_stock_threshold?: number | null
          notifications_enabled?: boolean | null
          paper_size?: string | null
          payment_methods?: Json | null
          payment_terms?: number | null
          pos_layout_grid_cols?: number | null
          show_tax?: boolean | null
          store_id?: string | null
          theme?: string | null
          thermal_printer_name?: string | null
          timezone?: string | null
          updated_at?: string
          use_thermal_printer?: boolean | null
          web_order_sound_enabled?: boolean | null
          web_order_sound_type?: string | null
          web_order_sound_volume?: number | null
        }
        Update: {
          ai_api_key?: string | null
          auto_backup?: boolean | null
          auto_increment?: boolean | null
          backup_frequency?: string | null
          created_at?: string
          currency?: string | null
          default_tax_rate?: number | null
          email_reports_enabled?: boolean | null
          email_reports_frequency?: string | null
          email_reports_last_sent?: string | null
          email_reports_recipient?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_enabled?: boolean | null
          evolution_instance_name?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_prefix?: string | null
          language?: string | null
          log_retention_days?: number | null
          low_stock_alert?: boolean | null
          low_stock_threshold?: number | null
          notifications_enabled?: boolean | null
          paper_size?: string | null
          payment_methods?: Json | null
          payment_terms?: number | null
          pos_layout_grid_cols?: number | null
          show_tax?: boolean | null
          store_id?: string | null
          theme?: string | null
          thermal_printer_name?: string | null
          timezone?: string | null
          updated_at?: string
          use_thermal_printer?: boolean | null
          web_order_sound_enabled?: boolean | null
          web_order_sound_type?: string | null
          web_order_sound_volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          owner_id: string
          slug: string
          store_code: string
          store_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          owner_id: string
          slug: string
          store_code: string
          store_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          owner_id?: string
          slug?: string
          store_code?: string
          store_name?: string
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      create_store_for_user: {
        Args: { company_name: string; user_id: string }
        Returns: string
      }
      generate_order_number: {
        Args: { order_source?: string }
        Returns: string
      }
      generate_store_code: { Args: never; Returns: string }
      generate_store_slug: {
        Args: { company_name: string; store_code: string }
        Returns: string
      }
      generate_user_number: { Args: never; Returns: string }
      get_next_invoice_number: {
        Args: { invoice_type_code: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_order_in_owned_store: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      is_public_web_order: { Args: { _order_id: string }; Returns: boolean }
      is_staff_or_admin: { Args: { _user_id: string }; Returns: boolean }
      owns_store: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      submit_payment_and_activate: {
        Args: {
          p_amount: number
          p_bank_name: string
          p_company_id: string
          p_currency: string
          p_proof_url: string
          p_target_plan_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
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
      app_role: ["admin", "staff", "customer"],
    },
  },
} as const
