/**
 * Pricing Utilities - Calculation Engine for Dynamic Pricing
 * Handles all price calculations based on unit types and dimensions
 */

// Unit type definitions
export const UNIT_TYPES = {
  SQ_FT: 'sq_ft',
  LINEAR_METER: 'linear_meter',
  SQ_INCH: 'sq_inch',
  FIXED: 'fixed',
};

export const UNIT_LABELS = {
  sq_ft: 'Square Feet (Sq. Ft)',
  linear_meter: 'Linear Meters',
  sq_inch: 'Square Inches (Sq. In)',
  fixed: 'Fixed Price',
};

/**
 * Calculate price based on dimensions and unit type
 * @param {string} unitType - Type of unit (sq_ft, linear_meter, sq_inch, fixed)
 * @param {number} pricePerUnit - Price per unit
 * @param {object} dimensions - {width, height, length}
 * @param {number} quantity - Quantity ordered
 * @returns {object} {total, breakdown}
 */
export const calculateProductPrice = (unitType, pricePerUnit, dimensions, quantity = 1) => {
  let unitQuantity = 1;
  let unit = 'unit';

  // Guard against invalid inputs
  if (!pricePerUnit || pricePerUnit <= 0) {
    return { 
      total: 0, 
      breakdown: { 
        unitQuantity: 0, 
        pricePerUnit: 0, 
        quantity: 1, 
        total: 0, 
        unit: 'unit' 
      } 
    };
  }

  switch (unitType) {
    case UNIT_TYPES.SQ_FT:
      if (dimensions?.width && dimensions?.height) {
        unitQuantity = parseFloat(dimensions.width) * parseFloat(dimensions.height);
      }
      unit = 'sq. ft';
      break;

    case UNIT_TYPES.SQ_INCH:
      if (dimensions?.width && dimensions?.height) {
        unitQuantity = parseFloat(dimensions.width) * parseFloat(dimensions.height);
      }
      unit = 'sq. in';
      break;

    case UNIT_TYPES.LINEAR_METER:
      if (dimensions?.length) {
        unitQuantity = parseFloat(dimensions.length);
      }
      unit = 'm';
      break;

    case UNIT_TYPES.FIXED:
    default:
      unitQuantity = 1;
      unit = 'unit';
      break;
  }

  const pricePerUnitNum = parseFloat(pricePerUnit);
  const quantityNum = parseFloat(quantity) || 1;
  const subtotal = Math.round((unitQuantity * pricePerUnitNum) * 100) / 100;
  const total = Math.round((subtotal * quantityNum) * 100) / 100;

  return {
    total,
    breakdown: {
      unitQuantity: Math.round(unitQuantity * 100) / 100,
      unit,
      pricePerUnit: pricePerUnitNum,
      quantity: quantityNum,
      subtotal,
      total,
    },
  };
};

/**
 * Validate pricing data
 * @param {object} data - Product pricing data
 * @returns {object} {isValid, errors}
 */
export const validatePricingData = (data) => {
  const errors = {};

  if (!data?.unitType || !Object.values(UNIT_TYPES).includes(data.unitType)) {
    errors.unitType = 'Valid unit type is required';
  }

  if (!data?.pricePerUnit || parseFloat(data.pricePerUnit) <= 0) {
    errors.pricePerUnit = 'Price per unit must be greater than 0';
  }

  if (data?.unitType && data.unitType !== UNIT_TYPES.FIXED) {
    if (data.unitType === UNIT_TYPES.LINEAR_METER) {
      if (!data?.length || parseFloat(data.length) <= 0) {
        errors.length = 'Length is required for linear meter pricing';
      }
    } else {
      if (!data?.width || parseFloat(data.width) <= 0) {
        errors.width = 'Width is required';
      }
      if (!data?.height || parseFloat(data.height) <= 0) {
        errors.height = 'Height is required';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Format price for display
 * @param {number} price - Price to format
 * @returns {string} Formatted price with peso sign
 */
export const formatPrice = (price) => {
  return `₱${(parseFloat(price) || 0).toFixed(2)}`;
};
