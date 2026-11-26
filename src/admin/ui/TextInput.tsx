import React from "react";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ icon, clearable, onClear, className = "", ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--a-text-3)] pointer-events-none shrink-0">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full h-[3.25rem] rounded-full bg-[var(--a-surface-2)] border border-[var(--a-line)] px-5 text-admin-body text-[var(--a-text)] placeholder:text-[var(--a-text-3)] transition-all duration-150 focus:border-[var(--a-blue)] focus:outline-none focus:shadow-[0_0_0_2px_var(--a-blue)] hover:border-[var(--a-line-strong)] ${
            icon ? "!pl-12" : ""
          } ${clearable ? "!pr-12" : ""} ${className}`}
          {...props}
        />
        {clearable && props.value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--a-surface-2)] hover:bg-[var(--a-surface-3)] text-[var(--a-text-2)] flex items-center justify-center text-xs cursor-pointer transition-all"
          >
            ×
          </button>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full min-h-[7.5rem] rounded-[1.25rem] bg-[var(--a-surface-2)] border border-[var(--a-line)] p-5 text-admin-body text-[var(--a-text)] placeholder:text-[var(--a-text-3)] transition-all duration-150 focus:border-[var(--a-blue)] focus:outline-none focus:shadow-[0_0_0_2px_var(--a-blue)] hover:border-[var(--a-line-strong)] resize-y leading-relaxed ${className}`}
        {...props}
      />
    );
  }
);

TextArea.displayName = "TextArea";
