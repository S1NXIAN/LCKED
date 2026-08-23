"use client";

/**
 * LCKED — identity field section: name, contact, company and address
 * bundles plus notes.
 */

import { Building2, Globe, Mail, MapPin, Phone, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type IdentityDetails } from "@/lib/types";

import {
  FieldCluster,
  FieldClusterWithLabel,
  FieldRowInput,
  flatInputCls,
  flatTextareaCls,
} from "../field-cluster";

export function IdentityFields({
  details,
  updateDetails,
}: {
  details: IdentityDetails;
  updateDetails: (patch: Partial<IdentityDetails>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* First name + Last name */}
      <FieldCluster>
        <div className="divide-border/50 grid grid-cols-2 divide-x">
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
        <div className="divide-border/50 grid grid-cols-2 divide-x">
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
        <div className="divide-border/50 grid grid-cols-2 divide-x">
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
        <div className="divide-border/50 grid grid-cols-2 divide-x">
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
