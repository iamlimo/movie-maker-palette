import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface RentalDurationSelectorProps {
  value: number; // in hours
  onChange: (hours: number) => void;
  label?: string;
  useDefault?: boolean;
  onUseDefaultChange?: (useDefault: boolean) => void;
  defaultValue?: number;
}

const RentalDurationSelector: React.FC<RentalDurationSelectorProps> = ({
  value,
  onChange,
  label = "Rental Duration",
  useDefault = false,
  onUseDefaultChange,
  defaultValue = 48
}) => {
  const [customValue, setCustomValue] = useState("");
  const [unit, setUnit] = useState<"hours" | "days">("hours");

  const presetValues = [
    { label: "24 hours", value: 24 },
    { label: "48 hours (Default)", value: 48 },
    { label: "72 hours", value: 72 },
    { label: "7 days", value: 168 },
    { label: "14 days", value: 336 },
    { label: "30 days", value: 720 },
    { label: "Custom", value: -1 }
  ];

  const handlePresetChange = (selectedValue: string) => {
    const numValue = parseInt(selectedValue);
    if (numValue === -1) {
      // Custom value selected
      setCustomValue("");
    } else {
      onChange(numValue);
    }
  };

  const handleCustomChange = () => {
    const customHours = unit === "days" 
      ? parseInt(customValue) * 24 
      : parseInt(customValue);
    
    if (!isNaN(customHours) && customHours > 0) {
      onChange(customHours);
    }
  };

  const formatDisplayValue = (hours: number) => {
    if (hours < 24) {
      return `${hours} hours`;
    } else if (hours % 24 === 0) {
      return `${hours / 24} days`;
    } else {
      return `${hours} hours`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {onUseDefaultChange && (
          <div className="flex items-center space-x-2">
            <Switch
              id="use-default"
              checked={useDefault}
              onCheckedChange={onUseDefaultChange}
            />
            <Label htmlFor="use-default" className="text-sm">
              Use default ({formatDisplayValue(defaultValue)})
            </Label>
          </div>
        )}
      </div>

      {!useDefault && (
        <div className="space-y-3">
          <Select 
            value={presetValues.find(p => p.value === value)?.value.toString() || "-1"} 
            onValueChange={handlePresetChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {presetValues.map((preset) => (
                <SelectItem key={preset.value} value={preset.value.toString()}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {value !== -1 && !presetValues.some(p => p.value === value) && (
            <div className="bg-secondary/20 p-3 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Current: </span>
                {formatDisplayValue(value)}
              </p>
            </div>
          )}

          {(!presetValues.some(p => p.value === value) || value === -1) && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Input
                  type="number"
                  min={1}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Enter duration"
                  onBlur={handleCustomChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleCustomChange()}
                />
              </div>
              <Select value={unit} onValueChange={(value: "hours" | "days") => setUnit(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {useDefault && (
        <div className="bg-secondary/20 p-3 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Using default rental duration: {formatDisplayValue(defaultValue)}
          </p>
        </div>
      )}
    </div>
  );
};

export default RentalDurationSelector;