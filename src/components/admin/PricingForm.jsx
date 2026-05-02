import { useState, useEffect } from 'react';
import { UNIT_TYPES, UNIT_LABELS, calculateProductPrice, validatePricingData, formatPrice } from '../../utils/pricingUtils';
import { Save, RotateCcw } from 'lucide-react';

export default function PricingForm({ product, onSave, isLoading = false }) {
  const [formData, setFormData] = useState({
    unitType: product?.unitType || UNIT_TYPES.FIXED,
    pricePerUnit: product?.pricePerUnit || '',
    width: product?.dimensions?.width || '',
    height: product?.dimensions?.height || '',
    length: product?.dimensions?.length || '',
  });

  const [preview, setPreview] = useState({
    total: product?.price || 0,
    breakdown: {},
  });

  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  // Update preview when form changes
  useEffect(() => {
    if (formData.pricePerUnit) {
      const validation = validatePricingData(formData);
      if (validation.isValid) {
        const calculated = calculateProductPrice(
          formData.unitType,
          formData.pricePerUnit,
          {
            width: formData.width,
            height: formData.height,
            length: formData.length,
          },
          1
        );
        setPreview(calculated);
        setErrors({});
      } else {
        setErrors(validation.errors);
      }
    }
  }, [formData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setSaved(false);
  };

  const handleReset = () => {
    setFormData({
      unitType: product?.unitType || UNIT_TYPES.FIXED,
      pricePerUnit: product?.pricePerUnit || '',
      width: product?.dimensions?.width || '',
      height: product?.dimensions?.height || '',
      length: product?.dimensions?.length || '',
    });
    setErrors({});
    setSaved(false);
  };

  const handleSave = async () => {
    const validation = validatePricingData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const pricingData = {
      unitType: formData.unitType,
      pricePerUnit: parseFloat(formData.pricePerUnit),
      dimensions: {
        width: formData.width ? parseFloat(formData.width) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        length: formData.length ? parseFloat(formData.length) : null,
      },
      price: preview.total,
    };

    await onSave(pricingData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
      {/* Unit Type Selection */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Pricing Unit Type
        </label>
        <select
          name="unitType"
          value={formData.unitType}
          onChange={handleInputChange}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-50 text-sm"
        >
          {Object.entries(UNIT_TYPES).map(([key, value]) => (
            <option key={value} value={value}>
              {UNIT_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {/* Price Per Unit */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Price Per {UNIT_LABELS[formData.unitType]?.split('(')[0].trim() || 'Unit'}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">₱</span>
          <input
            type="number"
            name="pricePerUnit"
            value={formData.pricePerUnit}
            onChange={handleInputChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full pl-7 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-50 text-sm"
          />
        </div>
        {errors.pricePerUnit && <p className="text-red-400 text-xs mt-1">{errors.pricePerUnit}</p>}
      </div>

      {/* Dimensions - Conditional Rendering */}
      {formData.unitType === UNIT_TYPES.LINEAR_METER && (
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Length (Meters)
          </label>
          <input
            type="number"
            name="length"
            value={formData.length}
            onChange={handleInputChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-50 text-sm"
          />
          {errors.length && <p className="text-red-400 text-xs mt-1">{errors.length}</p>}
        </div>
      )}

      {(formData.unitType === UNIT_TYPES.SQ_FT || formData.unitType === UNIT_TYPES.SQ_INCH) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Width ({formData.unitType === UNIT_TYPES.SQ_FT ? 'Ft' : 'In'})
            </label>
            <input
              type="number"
              name="width"
              value={formData.width}
              onChange={handleInputChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-50 text-sm"
            />
            {errors.width && <p className="text-red-400 text-xs mt-1">{errors.width}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Height ({formData.unitType === UNIT_TYPES.SQ_FT ? 'Ft' : 'In'})
            </label>
            <input
              type="number"
              name="height"
              value={formData.height}
              onChange={handleInputChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-50 text-sm"
            />
            {errors.height && <p className="text-red-400 text-xs mt-1">{errors.height}</p>}
          </div>
        </div>
      )}

      {/* Price Preview */}
      {!Object.keys(errors).length && (
        <div className="bg-zinc-800 border border-zinc-700 rounded p-3 space-y-2">
          <p className="text-xs text-zinc-400">Price Preview (for 1 unit):</p>
          <p className="text-lg font-bold text-emerald-400">{formatPrice(preview.total)}</p>
          {preview.breakdown.unitQuantity !== undefined && (
            <p className="text-xs text-zinc-500">
              {Math.round(preview.breakdown.unitQuantity * 100) / 100} {preview.breakdown.unit} × {formatPrice(preview.breakdown.pricePerUnit)} = {formatPrice(preview.breakdown.subtotal)}
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={isLoading || Object.keys(errors).length > 0}
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-600 px-3 py-2 text-sm font-semibold text-zinc-50 rounded flex items-center justify-center gap-2"
        >
          <Save size={14} />
          Save Pricing
        </button>
        <button
          onClick={handleReset}
          className="flex-1 border border-zinc-600 hover:border-zinc-400 px-3 py-2 text-sm font-semibold text-zinc-300 rounded flex items-center justify-center gap-2"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="bg-emerald-900/30 border border-emerald-600 text-emerald-400 px-3 py-2 rounded text-sm">
          ✓ Pricing saved successfully!
        </div>
      )}
    </div>
  );
}
