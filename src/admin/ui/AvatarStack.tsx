import React from "react";

export interface AvatarItem {
  id: string;
  name?: string;
  src?: string;
  initials?: string;
}

export interface AvatarStackProps {
  items: AvatarItem[];
  max?: number;
  inverse?: boolean;
  className?: string;
}

export const AvatarStack: React.FC<AvatarStackProps> = ({
  items,
  max = 5,
  inverse = false,
  className = "",
}) => {
  const visible = items.slice(0, max);
  const remaining = items.length - max;
  const ringColor = inverse ? "ring-[#F4EFE6]" : "ring-[#11131A]";

  return (
    <div className={`flex items-center -space-x-2 overflow-hidden ${className}`}>
      {visible.map((item, idx) => (
        <div
          key={item.id || idx}
          title={item.name}
          className={`w-[2rem] h-[2rem] rounded-full overflow-hidden ring-2 ${ringColor} bg-[var(--a-surface-2)] flex items-center justify-center shrink-0 text-white text-[10px] font-mono font-bold shadow-sm`}
        >
          {item.src ? (
            <img
              src={item.src}
              alt={item.name || ""}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span>
              {item.initials ||
                (item.name
                  ? item.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "CS")}
            </span>
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={`w-[2rem] h-[2rem] rounded-full ring-2 ${ringColor} bg-[var(--a-surface-3)] text-[var(--a-text-2)] text-[10px] font-mono font-bold flex items-center justify-center shrink-0 shadow-sm`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
};
