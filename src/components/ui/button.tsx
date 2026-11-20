import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-leaf-800 text-white hover:bg-leaf-900 active:bg-leaf-950 shadow-sm",
  secondary: "bg-leaf-100 text-leaf-900 hover:bg-leaf-200",
  outline: "border border-line bg-white text-ink hover:bg-sand",
  ghost: "text-ink hover:bg-sand",
  danger: "bg-clay-600 text-white hover:bg-clay-700",
  link: "text-leaf-700 underline-offset-4 hover:underline px-0 h-auto",
} as const;
const sizes = { sm: "h-9 px-3 text-sm gap-1.5", md: "h-11 px-4 text-[15px] gap-2", lg: "h-12 px-5 text-base gap-2", icon: "h-10 w-10" } as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export const buttonClass = (variant: keyof typeof variants = "primary", size: keyof typeof sizes = "md", className?: string) =>
  cn("inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none", variants[variant], sizes[size], className);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({ href, variant = "primary", size = "md", className, children, ...rest }: { href: string; variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string; children: React.ReactNode; prefetch?: boolean }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
