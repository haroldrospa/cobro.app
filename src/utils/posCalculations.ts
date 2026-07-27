
import { CartItem, GlobalDiscount } from '@/types/pos';

export const getItemUnitPriceWithExtras = (item: CartItem): number => {
  const extrasSum = (item.selectedExtras || []).reduce((s, e) => s + (e.price * (e.quantity || 1)), 0);
  return item.price + extrasSum;
};

export const calculateItemTotal = (item: CartItem): number => {
  const unitPriceWithExtras = getItemUnitPriceWithExtras(item);
  let itemTotalGross = unitPriceWithExtras * item.quantity;
  if (item.discount && item.discount.value > 0) {
    if (item.discount.type === 'percentage') {
      itemTotalGross = Math.max(0, itemTotalGross - (itemTotalGross * (item.discount.value / 100)));
    } else {
      itemTotalGross = Math.max(0, itemTotalGross - item.discount.value);
    }
  }
  if (item.cost_includes_tax) {
    return itemTotalGross;
  }
  const taxRate = item.tax || 0.18;
  return itemTotalGross * (1 + taxRate);
};

export const calculateTotals = (cart: CartItem[], globalDiscount?: GlobalDiscount) => {
  // 1. Calcular Subtotal Bruto (Suma de precios de lista con adicionales * cantidad)
  const grossSubtotal = cart.reduce((sum, item) => {
    return sum + (getItemUnitPriceWithExtras(item) * item.quantity);
  }, 0);

  // Calcular el total de descuentos individuales aplicados en los items
  const individualDiscountTotal = cart.reduce((sum, item) => {
    const itemUnitPrice = getItemUnitPriceWithExtras(item);
    if (item.discount && item.discount.value > 0) {
      if (item.discount.type === 'percentage') {
        return sum + ((itemUnitPrice * item.quantity) * (item.discount.value / 100));
      } else {
        return sum + item.discount.value;
      }
    }
    return sum;
  }, 0);

  // Subtotal después de aplicar descuentos individuales
  const subtotalAfterIndividualDiscounts = Math.max(0, grossSubtotal - individualDiscountTotal);

  // 2. Calcular Descuento Global
  let globalDiscountAmount = 0;
  if (globalDiscount && globalDiscount.value > 0) {
    if (globalDiscount.type === 'percentage') {
      globalDiscountAmount = subtotalAfterIndividualDiscounts * (globalDiscount.value / 100);
    } else {
      globalDiscountAmount = globalDiscount.value;
    }
  }

  // Descuento total = Descuentos individuales + Descuento global
  const discountTotal = individualDiscountTotal + globalDiscountAmount;

  // 3. Calcular ITBIS y Total Final distribuyendo los descuentos
  let taxTotal = 0;
  let finalTotal = 0;

  cart.forEach((item) => {
    const taxRate = item.tax || 0.18;
    const itemTotalGross = getItemUnitPriceWithExtras(item) * item.quantity;

    // Descuento individual de este item
    let itemIndividualDiscount = 0;
    if (item.discount && item.discount.value > 0) {
      if (item.discount.type === 'percentage') {
        itemIndividualDiscount = itemTotalGross * (item.discount.value / 100);
      } else {
        itemIndividualDiscount = item.discount.value;
      }
    }

    // Parte proporcional del descuento global que le corresponde a este item
    const itemRemainingGross = Math.max(0, itemTotalGross - itemIndividualDiscount);
    const itemProportion = subtotalAfterIndividualDiscounts > 0 ? (itemRemainingGross / subtotalAfterIndividualDiscounts) : 0;
    const itemGlobalDiscount = globalDiscountAmount * itemProportion;

    // Descuento total asignado a este item
    const itemDiscountTotal = itemIndividualDiscount + itemGlobalDiscount;

    if (item.cost_includes_tax) {
      // ===== PRODUCTO CON IMPUESTO INCLUIDO =====
      const itemTotalAfterDiscount = Math.max(0, itemTotalGross - itemDiscountTotal);
      const itemBaseNet = itemTotalAfterDiscount / (1 + taxRate);
      const itemTax = itemTotalAfterDiscount - itemBaseNet;

      taxTotal += itemTax;
      finalTotal += itemTotalAfterDiscount;
    } else {
      // ===== PRODUCTO SIN IMPUESTO INCLUIDO =====
      const itemBaseNet = itemTotalGross;
      const itemBaseAfterDiscount = Math.max(0, itemBaseNet - itemDiscountTotal);
      const itemTax = itemBaseAfterDiscount * taxRate;

      taxTotal += itemTax;
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
