import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Helper functions for Naira <-> Kobo conversion
export const nairaToKobo = (naira: number): number => Math.round(naira * 100);
export const koboToNaira = (kobo: number): number => kobo / 100;

interface NairaInputProps {
  value: number; // Value in kobo
  onChange: (value: number) => void; // Returns value in kobo
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

const NairaInput: React.FC<NairaInputProps> = ({
  value, // value in kobo
  onChange, // onChange expects kobo
  label,
  placeholder = "0.00",
  required = false,
  disabled = false
}) => {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    // Convert kobo to naira for display
    const nairaValue = koboToNaira(value);
    if (value === 0) {
      setDisplayValue("");
    } else {
      setDisplayValue(nairaValue.toFixed(2));
    }
  }, [value]);

  const formatCurrency = (amount: string) => {
    // Remove non-numeric characters except decimal point
    const numericValue = amount.replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
      parts[1] = parts[1].substring(0, 2);
      return parts.join('.');
    }
    
    return numericValue;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Remove formatting and keep only numbers and decimal
    const cleanValue = inputValue.replace(/[^\d.]/g, '');
    const formatted = formatCurrency(cleanValue);
    
    setDisplayValue(formatted);
    
    // Convert Naira to Kobo and call onChange
    const nairaValue = parseFloat(formatted) || 0;
    const koboValue = nairaToKobo(nairaValue);
    onChange(koboValue);
  };

  const handleBlur = () => {
    // Format the display value on blur
    if (displayValue && !isNaN(parseFloat(displayValue))) {
      const formatted = parseFloat(displayValue).toFixed(2);
      setDisplayValue(formatted);
    }
  };

  const formatDisplayValue = (value: string) => {
    if (!value) return "";
    const num = parseFloat(value);
    if (isNaN(num)) return "";
    return num.toLocaleString('en-NG', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <Input
          type="text"
          value={formatDisplayValue(displayValue)}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="pl-8"
        />
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
          ₦
        </span>
      </div>
    </div>
  );
};

export default NairaInput;