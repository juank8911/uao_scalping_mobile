/**
 * validations.ts
 *
 * Utilidades de validación para niveles de orden (Entrada, Take Profit, Stop Loss).
 */

export interface OrderLevelValidationResult {
  valid: boolean;
  error?: string;
  code?: 'ENTRY_PRICE_TOO_FAR_FROM_CURRENT_PRICE' | 'INVALID_TP' | 'INVALID_SL' | string;
}

export interface OrderLevelParams {
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT' | string;
  entryPrice: number;
  currentPrice: number;
  tpPrice?: number | null;
  slPrice?: number | null;
  maxEntryDistancePct?: number; // Por defecto: 2.0%
}

/**
 * Valida un intento de orden según las reglas:
 * 1. Distancia de Entrada: Si entryPrice está a más de 2.0% del precio actual -> RECHAZAR (ENTRY_PRICE_TOO_FAR_FROM_CURRENT_PRICE)
 * 2. Niveles LONG:
 *    - TP > currentPrice y TP > entryPrice
 *    - SL < currentPrice y SL < entryPrice
 * 3. Niveles SHORT:
 *    - TP < currentPrice y TP < entryPrice
 *    - SL > currentPrice y SL > entryPrice
 */
export function validateOrderLevels({
  side,
  entryPrice,
  currentPrice,
  tpPrice,
  slPrice,
  maxEntryDistancePct = 2.0,
}: OrderLevelParams): OrderLevelValidationResult {
  if (!entryPrice || entryPrice <= 0 || !currentPrice || currentPrice <= 0) {
    return { valid: false, error: 'Los precios de entrada y mercado deben ser mayores a 0.' };
  }

  // 1. Distancia de Entrada
  const distancePct = (Math.abs(entryPrice - currentPrice) / currentPrice) * 100;
  if (distancePct > maxEntryDistancePct) {
    return {
      valid: false,
      code: 'ENTRY_PRICE_TOO_FAR_FROM_CURRENT_PRICE',
      error: `El precio de entrada (${entryPrice}) está a más del ${maxEntryDistancePct}% del precio actual de mercado (${currentPrice}).`,
    };
  }

  const normalizedSide = side.toUpperCase();
  const isLong = normalizedSide === 'BUY' || normalizedSide === 'LONG';

  if (isLong) {
    // Reglas LONG
    if (tpPrice != null && tpPrice > 0) {
      if (tpPrice <= currentPrice || tpPrice <= entryPrice) {
        return {
          valid: false,
          code: 'INVALID_TP',
          error: `Para un LONG, el Take Profit (${tpPrice}) debe ser estrictamente mayor que el precio actual (${currentPrice}) y el de entrada (${entryPrice}).`,
        };
      }
    }
    if (slPrice != null && slPrice > 0) {
      if (slPrice >= currentPrice || slPrice >= entryPrice) {
        return {
          valid: false,
          code: 'INVALID_SL',
          error: `Para un LONG, el Stop Loss (${slPrice}) debe ser estrictamente menor que el precio actual (${currentPrice}) y el de entrada (${entryPrice}).`,
        };
      }
    }
  } else {
    // Reglas SHORT
    if (tpPrice != null && tpPrice > 0) {
      if (tpPrice >= currentPrice || tpPrice >= entryPrice) {
        return {
          valid: false,
          code: 'INVALID_TP',
          error: `Para un SHORT, el Take Profit (${tpPrice}) debe ser estrictamente menor que el precio actual (${currentPrice}) y el de entrada (${entryPrice}).`,
        };
      }
    }
    if (slPrice != null && slPrice > 0) {
      if (slPrice <= currentPrice || slPrice <= entryPrice) {
        return {
          valid: false,
          code: 'INVALID_SL',
          error: `Para un SHORT, el Stop Loss (${slPrice}) debe ser estrictamente mayor que el precio actual (${currentPrice}) y el de entrada (${entryPrice}).`,
        };
      }
    }
  }

  return { valid: true };
}
