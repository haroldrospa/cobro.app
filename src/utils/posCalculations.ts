
import { CartItem, GlobalDiscount } from '@/types/pos';

export const calculateItemTotal = (item: CartItem): number => {
  const itemTotalGross = item.price * item.quantity;
  if (item.cost_includes_tax) {
    return itemTotalGross;
  }
  const taxRate = item.tax || 0.18;
  return itemTotalGross * (1 + taxRate);
};

export const calculateTotals = (cart: CartItem[], globalDiscount?: GlobalDiscount) => {
  // 1. Calcular Subtotal Bruto (Suma de precios de lista)
  const grossSubtotal = cart.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);

  // 2. Calcular Descuento Global
  let discountTotal = 0;
  if (globalDiscount && globalDiscount.value > 0) {
    if (globalDiscount.type === 'percentage') {
      discountTotal = grossSubtotal * (globalDiscount.value / 100);
    } else {
      discountTotal = globalDiscount.value;
    }
  }

  // 3. Calcular ITBIS y Total Final
  let taxTotal = 0;
  let finalTotal = 0;

  cart.forEach((item) => {
    const taxRate = item.tax || 0.18;
    const itemTotalGross = item.price * item.quantity;

    // Proporción de este item en el total bruto para distribuir el descuento
    const itemProportion = grossSubtotal > 0 ? (itemTotalGross / grossSubtotal) : 0;
    const itemDiscountGross = discountTotal * itemProportion;

    if (item.cost_includes_tax) {
      // ===== PRODUCTO CON IMPUESTO INCLUIDO =====
      // El precio YA incluye el impuesto, no debemos sumarlo de nuevo

      // Aplicamos el descuento directo al precio con impuesto incluido
      const itemTotalAfterDiscount = Math.max(0, itemTotalGross - itemDiscountGross);

      // Calculamos cuánto del precio es impuesto (solo para mostrarlo, NO para sumarlo)
      const itemBaseNet = itemTotalAfterDiscount / (1 + taxRate);
      const itemTax = itemTotalAfterDiscount - itemBaseNet;

      taxTotal += itemTax;
      // El total final ES el precio con impuesto incluido (después del descuento)
      finalTotal += itemTotalAfterDiscount;

    } else {
      // ===== PRODUCTO SIN IMPUESTO INCLUIDO =====
      // El precio NO incluye impuesto, debemos calcularlo y sumarlo

      // Base imponible es el precio sin impuesto
      const itemBaseNet = itemTotalGross;

      // Aplicar descuento a la base
      const itemBaseAfterDiscount = Math.max(0, itemBaseNet - itemDiscountGross);

      // Calcular impuesto sobre la base después del descuento
      const itemTax = itemBaseAfterDiscount * taxRate;

      taxTotal += itemTax;
      // Total = Base + Impuesto
      finalTotal += (itemBaseAfterDiscount + itemTax);
    }
  });

  return {
    subtotal: grossSubtotal.toFixed(2),
    discount: discountTotal.toFixed(2),
    tax: taxTotal.toFixed(2),
    total: finalTotal.toFixed(2)
  };
};
