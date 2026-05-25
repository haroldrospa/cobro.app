import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  price: z.number().min(0, 'El precio debe ser mayor a 0'),
  cost: z.number().min(0, 'El costo debe ser mayor o igual a 0').optional(),
  cost_includes_tax: z.boolean().default(false),
  tax_percentage: z.number().min(0, 'El impuesto debe ser mayor o igual a 0').max(100, 'El impuesto no puede ser mayor a 100').default(18),
  internal_code: z.string().optional(),
  barcode: z.string().optional(),
  category_id: z.string().optional(),
  stock: z.number().min(0, 'El stock debe ser mayor o igual a 0'),
  min_stock: z.number().min(0, 'El stock mínimo debe ser mayor o igual a 0'),
  status: z.enum(['active', 'inactive']),
  image_url: z.string().optional(),
  discount_percentage: z.number().min(0).max(100).default(0),
  discount_start_date: z.string().optional(),
  discount_end_date: z.string().optional(),
  is_featured: z.boolean().default(false),
  is_variable_price: z.boolean().default(false),
  is_variable_quantity: z.boolean().default(false),
  is_visible_in_store: z.boolean().default(true),
  track_inventory: z.boolean().default(true),
});

export type ProductFormData = z.infer<typeof productSchema>;
