interface BrandMarkProps {
  compact?: boolean;
  tone?: "dark" | "light";
}

export function BrandMark({ compact = false, tone = "dark" }: BrandMarkProps) {
  return (
    <a className={`brand-mark brand-mark--${tone}`} href="/">
      <span className="brand-mark__sigil">R1</span>
      {!compact && (
        <span className="brand-mark__text">
          <strong>ReformOne</strong>
          <small>Well,Edu! / TalIA</small>
        </span>
      )}
    </a>
  );
}
