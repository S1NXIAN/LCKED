"use client";

/**
 * LCKED — custom-field rows (IE-2): stable per-row keys keep focus on the
 * right input when a middle row is removed. Rows are name + type pill on
 * top, value (masked for "hidden") + remove button below.
 */

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CustomField } from "@/lib/types";
import { cn } from "@/lib/utils";

import { FieldClusterWithLabel, flatInputCls } from "../field-cluster";

export function CustomFields({
  fields,
  fieldKeys,
  addCustomField,
  updateCustomField,
  removeCustomField,
}: {
  fields: CustomField[];
  /** Stable keys in lockstep with `fields` (IE-2). */
  fieldKeys: string[];
  addCustomField: () => void;
  updateCustomField: (idx: number, patch: Partial<CustomField>) => void;
  removeCustomField: (idx: number) => void;
}) {
  return (
    <div className="mt-4">
      {fields.length === 0 ? (
        <FieldClusterWithLabel
          label="Custom fields"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addCustomField}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          }
        >
          <div className="text-muted-foreground px-3.5 py-3 text-xs">
            Add extra fields like security questions or recovery codes.
          </div>
        </FieldClusterWithLabel>
      ) : (
        <FieldClusterWithLabel
          label="Custom fields"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addCustomField}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          }
        >
          {fields.map((cf, idx) => (
            <div
              key={fieldKeys[idx] ?? idx}
              className={cn(
                "px-3.5 py-2.5",
                idx !== 0 && "border-border/50 border-t",
              )}
            >
              {/* Top row — small name input + type badge (small, pill-shaped) */}
              <div className="flex items-center gap-2">
                <Input
                  value={cf.name}
                  onChange={(e) =>
                    updateCustomField(idx, { name: e.target.value })
                  }
                  placeholder="Field name"
                  className={cn(flatInputCls, "text-xs")}
                  aria-label={`Custom field ${idx + 1} name`}
                />
                <Select
                  value={cf.type}
                  onValueChange={(v) =>
                    updateCustomField(idx, { type: v as "text" | "hidden" })
                  }
                >
                  <SelectTrigger className="border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary/70 data-[placeholder]:text-muted-foreground h-6 w-fit shrink-0 gap-1 rounded-full px-2.5 text-[10px] font-medium tracking-wider uppercase focus-visible:ring-0 focus-visible:outline-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Bottom row — larger value input + subtle ghost remove */}
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  value={cf.value}
                  onChange={(e) =>
                    updateCustomField(idx, { value: e.target.value })
                  }
                  placeholder="Value"
                  className={cn(
                    flatInputCls,
                    cf.type === "hidden" && "font-secret",
                  )}
                  type={cf.type === "hidden" ? "password" : "text"}
                  aria-label={`Custom field ${idx + 1} value`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground/60 h-7 w-7 shrink-0 hover:text-red-400"
                  onClick={() => removeCustomField(idx)}
                  aria-label={`Remove custom field ${idx + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </FieldClusterWithLabel>
      )}
    </div>
  );
}
