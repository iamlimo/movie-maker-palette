import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nairaToKobo, koboToNaira } from "@/lib/priceUtils";

interface NairaInputProps {
  value: number; // Value in kobo
  onChange: (value: number) => void; // Returns value in kobo
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  defaultPriceHint?: string;
  className?: string;
}

const NairaInput: React.FC<NairaInputProps> = ({
  value,
  onChange,
  label,
  placeholder = "0.00",
  required = false,
  disabled = false,
  defaultPriceHint,
  className,
}) => {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    const nairaValue = koboToNaira(value);
    if (value === 0) {
      setDisplayValue("");
      return;
    }

    setDisplayValue(nairaValue.toFixed(2));
  }, [value]);

  const sanitizeAmount = (raw: string) => {
    const numericValue = raw.replace(/[^\d.]/g, "");
    const parts = numericValue.split(".");

    if (parts.length > 2) {
      return `${parts[0]}.${parts.slice(1).join("")}`;
    }

    if (parts[1] && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].slice(0, 2)}`;
    }

    return numericValue;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = sanitizeAmount(e.target.value);
    setDisplayValue(formatted);

    const nairaValue = Number.parseFloat(formatted || "0") || 0;
    const koboValue = nairaToKobo(nairaValue);
    onChange(koboValue);
  };

  const handleBlur = () => {
    if (!displayValue) {
      setDisplayValue("");
      return;
    }

    const numeric = Number.parseFloat(displayValue);
    if (Number.isFinite(numeric)) {
      setDisplayValue(numeric.toFixed(2));
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium text-muted-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {defaultPriceHint && (
        <p className="text-xs text-muted-foreground">{defaultPriceHint}</p>
      )}

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-foreground">
          ₦
        </span>
        <Input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`h-16 rounded-2xl border-border bg-muted/20 pl-10 text-2xl font-semibold tracking-tight shadow-inner ${className ?? ""}`}
        />
      </div>
    </div>
  );
};

export default NairaInput;