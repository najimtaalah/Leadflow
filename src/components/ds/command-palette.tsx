"use client";

import * as React from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { LucideIcon } from "lucide-react";

export interface CommandAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  group?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CommandAction[];
  placeholder?: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  placeholder = "Rechercher une action...",
}: CommandPaletteProps) {
  const groups = React.useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    for (const action of actions) {
      const group = action.group ?? "Actions";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(action);
    }
    return map;
  }, [actions]);

  function handleSelect(action: CommandAction) {
    onOpenChange(false);
    action.onSelect();
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
        {Array.from(groups.entries()).map(([group, items], i) => (
          <React.Fragment key={group}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.id}
                    onSelect={() => handleSelect(action)}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5 text-foreground-muted" />}
                    {action.label}
                    {action.shortcut && (
                      <CommandShortcut>{action.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}
