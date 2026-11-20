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
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F4EFE6]/45 pointer-events-none shrink-0">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full h-[3.25rem] rounded-full bg-[#181B24] border border-white/[0.08] px-5 text-admin-body text-[#F4EFE6] placeholder:text-[#F4EFE6]/40 transition-all duration-150 focus:border-[#FF6A1F] focus:outline-none focus:shadow-[0_0_0_3px_rgba(255,106,31,0.45)] hover:border-white/[0.18] ${
            icon ? "!pl-12" : ""
          } ${clearable ? "!pr-12" : ""} ${className}`}
          {...props}
        />
        {clearable && props.value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs cursor-pointer transition-all"
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
        className={`w-full min-h-[7.5rem] rounded-[1.25rem] bg-[#181B24] border border-white/[0.08] p-5 text-admin-body text-[#F4EFE6] placeholder:text-[#F4EFE6]/40 transition-all duration-150 focus:border-[#FF6A1F] focus:outline-none focus:shadow-[0_0_0_3px_rgba(255,106,31,0.45)] hover:border-white/[0.18] resize-y leading-relaxed ${className}`}
        {...props}
      />
    );
  }
);

TextArea.displayName = "TextArea";
