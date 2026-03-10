import { clsx } from "clsx";

export const Button = ({ className, children, ...props }) => (
  <button
    className={clsx(
      "rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-900",
      className
    )}
    {...props}
  >
    {children}
  </button>
);
