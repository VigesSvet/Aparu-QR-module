type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function PhoneInput({ value, onChange, placeholder }: PhoneInputProps) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputMode="tel"
      placeholder={placeholder ?? '+7 (777) 123-45-67'}
      className="w-full rounded-card border border-aparu-border bg-aparu-surface-elevated px-4 py-4 text-base text-aparu-text outline-none transition focus:border-aparu-accent"
    />
  );
}
