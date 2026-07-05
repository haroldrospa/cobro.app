import * as React from "react"

import { cn } from "@/lib/utils"

import { playTapSound } from "@/utils/audio"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onKeyDown, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // For number inputs: select all text so typing replaces the default 0
      if (type === 'number') {
        e.target.select();
      }
      // Call any onFocus the caller may have passed
      onFocus?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Play sound on typing except for Tab, Shift, etc.
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
        playTapSound();
      }
      onKeyDown?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
