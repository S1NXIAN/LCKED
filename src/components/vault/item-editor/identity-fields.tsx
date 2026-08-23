"use client";

/**
  * LCKED — identity field section: name, contact, company and address
  * bundles plus notes.
  */

import { Mail, User, Phone, Building2, MapPin, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type IdentityDetails, type NewItemInput } from "@/lib/types";
import {
  FieldCluster,
  FieldClusterWithLabel,
  FieldRowInput,
  flatInputCls,
  flatTextareaCls,
} from "../field-cluster";

export function IdentityFields({
  form,
  updateDetails,
}: {
  form: NewItemInput;
  updateDetails: (patch: Record<string, unknown>) => void;
}) {
  const details = form.details as IdentityDetails;
  return (
    <div className="space-y-4">
      {/* First name + Last name */}
      <FieldCluster>
        <div className="grid grid-cols-2 divide-x divide-border/50">
          <FieldRowInput label="First name" icon={User} first>
            <Input
              value={details.firstName}
              onChange={(e) => updateDetails({ firstName: e.target.value })}
              autoComplete="off"
              className={flatInputCls}
            />
          </FieldRowInput>
          <FieldRowInput label="Last name" icon={User} first>
            <Input
              value={details.lastName}
              onChange={(e) => updateDetails({ lastName: e.target.value })}
              autoComplete="off"
              className={flatInputCls}
            />
          </FieldRowInput>
        </div>
      </FieldCluster>

      {/* Email + Phone */}
      <FieldCluster>
        <div className="grid grid-cols-2 divide-x divide-border/50">
          <FieldRowInput label="Email" icon={Mail} first>
            <Input
              type="email"
              value={details.email}
              onChange={(e) => updateDetails({ email: e.target.value })}
              autoComplete="off"
              className={flatInputCls}
            />
          </FieldRowInput>
          <FieldRowInput label="Phone" icon={Phone} first>
            <Input
              value={details.phone}
              onChange={(e) => updateDetails({ phone: e.target.value })}
              autoComplete="off"
              className={flatInputCls}
            />
          </FieldRowInput>
        </div>
      </FieldCluster>

      {/* Company */}
      <FieldCluster>
        <FieldRowInput label="Company" icon={Building2} first>
          <Input
            value={details.company}
            onChange={(e) => updateDetails({ company: e.target.value })}
            autoComplete="off"
            className={flatInputCls}
          />
        </FieldRowInput>
      </FieldCluster>

      {/* Address fields */}
      <FieldCluster>
        <FieldRowInput label="Address line 1" icon={MapPin} first>
          <Input
            value={details.address1}
            onChange={(e) => updateDetails({ address1: e.target.value })}
            autoComplete="off"
            className={flatInputCls}
          />
        </FieldRowInput>
        <FieldRowInput label="Address line 2" icon={MapPin}>
          <Input
            value={details.address2}
            onChange={(e) => updateDetails({ address2: e.target.value })}
            autoComplete="off"
            className={flatInputCls}
          />
        </FieldRowInput>
        <div className="grid grid-cols-2 divide-x divide-border/50">
          <FieldRowInput label="City" icon={MapPin}>
            <Input
              value={details.city}
              onChange={(e) => updateDetails({ city: e.target.value })}
              autoComplete="off"
              className={flatInputCls}
            />
          </FieldRowInput>
          <FieldRowInput label="State / Province" icon={MapPin}>
            <Input
              value={details.state}
              onChange={(e) => updateDetails({ state: e.target.value })}
              autoComplete="off"
              className={flatInputCls}
            />
          </FieldRowInput>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/50">
          <FieldRowInput label="Postal / ZIP" icon={MapPin}>
            <Input
              value={details.zip}
              onChange={(e) => updateDetails({ zip: e.target.value })}
              autoComplete="off"
              className={flatInputCls}
            />
          </FieldRowInput>
          <FieldRowInput label="Country" icon={Globe}>
            <Input
              value={details.country}
              onChange={(e) => updateDetails({ country: e.target.value })}
              autoComplete="off"
              className={flatInputCls}
            />
          </FieldRowInput>
        </div>
      </FieldCluster>

      {/* Notes */}
      <FieldClusterWithLabel label="Notes">
        <FieldRowInput first>
          <Textarea
            value={details.notes}
            onChange={(e) => updateDetails({ notes: e.target.value })}
            rows={3}
            className={flatTextareaCls}
          />
        </FieldRowInput>
      </FieldClusterWithLabel>
    </div>
  );
}
