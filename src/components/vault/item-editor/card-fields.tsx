"use client";

/**
  * LCKED — card field section: cardholder, number (with brand detection),
  * CVV, expiry (auto-formatted MM/YY), PIN, notes.
  */

import { User, CreditCard, Lock, Calendar, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PasswordField } from "../password-field";
import { detectCardBrand } from "@/lib/import";
import { type CardDetails, type NewItemInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  FieldCluster,
  FieldClusterWithLabel,
  FieldRowInput,
  flatInputCls,
  flatPasswordInputCls,
  flatTextareaCls,
} from "../field-cluster";

export function CardFields({
  form,
  updateDetails,
}: {
  form: NewItemInput;
  updateDetails: (patch: Record<string, unknown>) => void;
}) {
  const details = form.details as CardDetails;
  return (
    <div className="space-y-4">
      {/* Cardholder + Card number + CVV + Expiry + PIN */}
      <FieldCluster>
        <FieldRowInput label="Cardholder name" icon={User} first>
          <Input
            value={details.cardholder}
            onChange={(e) => updateDetails({ cardholder: e.target.value })}
            placeholder="Name on card"
            autoComplete="off"
            className={flatInputCls}
          />
        </FieldRowInput>
        <FieldRowInput label="Card number" icon={CreditCard}>
          <PasswordField
            value={details.number}
            onChange={(v) => {
              const brand = detectCardBrand(v);
              updateDetails({ number: v, brand: brand || details.brand });
            }}
            placeholder="0000 0000 0000 0000"
            showGenerate={false}
            inputClassName={flatPasswordInputCls}
          />
          {details.brand && (
            <p className="mt-1 text-xs text-muted-foreground">Detected: {details.brand}</p>
          )}
        </FieldRowInput>
        <div className="grid grid-cols-2 divide-x divide-border/50">
          <FieldRowInput label="CVV" icon={Lock} first>
            <PasswordField
              value={details.cvv}
              onChange={(v) => updateDetails({ cvv: v })}
              placeholder="123"
              showGenerate={false}
              inputClassName={flatPasswordInputCls}
            />
          </FieldRowInput>
          <FieldRowInput label="Expiry (MM/YY)" icon={Calendar} first>
            <Input
              value={details.expiry}
              onChange={(e) => {
                // Auto-format as MM/YY: strip non-digits, max 4 digits,
                // insert slash after the 2nd digit.
                let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                updateDetails({ expiry: v });
              }}
              placeholder="08/27"
              className={cn(flatInputCls, "font-secret")}
              autoComplete="off"
              inputMode="numeric"
              maxLength={5}
            />
          </FieldRowInput>
        </div>
        <FieldRowInput label="PIN" icon={KeyRound}>
          <PasswordField
            value={details.pin}
            onChange={(v) => updateDetails({ pin: v })}
            placeholder="••••"
            showGenerate={false}
            inputClassName={flatPasswordInputCls}
          />
        </FieldRowInput>
      </FieldCluster>

      {/* Notes */}
      <FieldClusterWithLabel label="Notes">
        <FieldRowInput first>
          <Textarea
            value={details.notes}
            onChange={(e) => updateDetails({ notes: e.target.value })}
            placeholder="Optional notes…"
            rows={3}
            className={flatTextareaCls}
          />
        </FieldRowInput>
      </FieldClusterWithLabel>
    </div>
  );
}
