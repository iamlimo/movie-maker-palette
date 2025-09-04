import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NairaInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

const NairaInput: React.FC<NairaInputProps> = ({
  value,
  onChange,
  label,
  placeholder = "0.00",
  required = false,
  disabled = false
}) => {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    // Format the value for display
    if (value === 0) {
      setDisplayValue("");
    } else {
      setDisplayValue(value.toFixed(2));
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
    
    // Remove the ₦ symbol for processing
    const cleanValue = inputValue.replace('₦', '').trim();
    const formatted = formatCurrency(cleanValue);
    
    setDisplayValue(formatted);
    
    // Convert to number and call onChange
    const numericValue = parseFloat(formatted) || 0;
    onChange(numericValue);
  };

  const handleBlur = () => {
    // Format the display value on blur
    if (displayValue && !isNaN(parseFloat(displayValue))) {
      const formatted = parseFloat(displayValue).toFixed(2);
      setDisplayValue(formatted);
    }
  };

  const displayWithSymbol = displayValue ? `₦${displayValue}` : "";

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
          value={displayWithSymbol}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={`₦${placeholder}`}
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