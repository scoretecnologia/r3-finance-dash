import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export type MultiSelectOption = { value: string; label: string };

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Rótulo exibido quando nada está selecionado (ex: "Meses"). */
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * Seletor múltiplo com campo de busca (Popover + Command).
 * Lista vazia em `selected` significa "todos".
 */
export function MultiSelectFilter({
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum resultado.",
  icon,
  className,
  disabled,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  const selectedLabels = options.filter((o) => selectedSet.has(o.value)).map((o) => o.label);

  const triggerLabel =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${placeholder} (${selectedLabels.length})`;

  const toggle = (value: string) => {
    onChange(selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          title={selectedLabels.join(", ") || undefined}
          className={cn(
            "h-8 justify-between text-xs rounded-lg border-border bg-background font-normal px-3 gap-1",
            className,
          )}
        >
          <span className="flex items-center gap-1 min-w-0">
            {icon}
            <span
              className={cn("truncate", selectedLabels.length === 0 && "text-muted-foreground")}
            >
              {triggerLabel}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selectedSet.has(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => toggle(opt.value)}
                    className="text-xs gap-2 cursor-pointer"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-sm border border-primary shrink-0",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__limpar__"
                    onSelect={() => onChange([])}
                    className="justify-center text-xs text-muted-foreground cursor-pointer gap-1"
                  >
                    <X className="h-3 w-3" /> Limpar seleção
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
