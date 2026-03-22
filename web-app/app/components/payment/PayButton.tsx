type PayButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  label?: string;
};

export default function PayButton({
  disabled,
  loading,
  onClick,
  type = "button",
  label = "Pay with Stripe",
}: PayButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Processing..." : label}
    </button>
  );
}
