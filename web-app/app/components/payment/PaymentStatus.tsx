type Tone = "neutral" | "success" | "error" | "warning";

type PaymentStatusProps = {
  title: string;
  description?: string;
  tone?: Tone;
};

const toneStyles: Record<Tone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export default function PaymentStatus({ title, description, tone = "neutral" }: PaymentStatusProps) {
  return (
    <div className={`rounded-3xl border p-5 text-sm shadow-sm ${toneStyles[tone]}`}>
      <p className="font-semibold md:text-base">{title}</p>
      {description && <p className="mt-1 text-xs leading-5 opacity-90 md:text-sm">{description}</p>}
    </div>
  );
}
