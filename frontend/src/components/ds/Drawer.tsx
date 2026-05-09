import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const DrawerRoot = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

interface DrawerContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  title?: string;
  description?: string;
  side?: "right" | "left";
  width?: string;
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, title, description, side = "right", width = "480px", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 top-0 h-full bg-background border-l border-border shadow-xl flex flex-col",
        "data-[state=open]:animate-in data-[state=closed]:animate-out duration-200",
        side === "right"
          ? "right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
          : "left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        className,
      )}
      style={{ width }}
      {...props}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          {title && (
            <DialogPrimitive.Title className="text-[15px] font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
          )}
          {description && (
            <DialogPrimitive.Description className="mt-0.5 text-[12px] text-foreground-muted">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        <DrawerClose className="ml-4 rounded-md p-1 opacity-60 hover:opacity-100 hover:bg-accent transition-colors">
          <X className="h-4 w-4" />
          <span className="sr-only">Fermer</span>
        </DrawerClose>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DrawerContent.displayName = "DrawerContent";

export { DrawerRoot, DrawerTrigger, DrawerClose, DrawerContent };
