export function Card({ children, className = "", glassmorphism = false }) {
  return (
    <div
      className={`
        ${glassmorphism ? "glass" : "bg-white dark:bg-slate-800"}
        border ${glassmorphism ? "" : "border-slate-200 dark:border-slate-700"}
        rounded-xl shadow-lg
        ${className}
      `}
    >
      {children}
    </div>
  );
}
