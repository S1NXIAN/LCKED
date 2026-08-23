"use client";

/** LCKED — secure-note field section: a single free-form content textarea. */

import { StickyNote } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { type NoteDetails, type NewItemInput } from "@/lib/types";
import { FieldCluster, FieldRowInput, flatTextareaCls } from "../field-cluster";

export function NoteFields({
  form,
  updateDetails,
}: {
  form: NewItemInput;
  updateDetails: (patch: Record<string, unknown>) => void;
}) {
  const details = form.details as NoteDetails;
  return (
    <FieldCluster>
      <FieldRowInput label="Content" icon={StickyNote} first>
        <Textarea
          value={details.content}
          onChange={(e) => updateDetails({ content: e.target.value })}
          placeholder="Write your secure note here…"
          rows={10}
          className={flatTextareaCls}
        />
      </FieldRowInput>
    </FieldCluster>
  );
}
