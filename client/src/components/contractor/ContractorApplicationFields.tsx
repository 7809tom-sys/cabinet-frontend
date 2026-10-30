import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  /** Defaults to the self-service ids (`apply-business`, `apply-phone`, `apply-license`). */
  idPrefix?: string;
  businessName: string;
  phone: string;
  licenseNumber: string;
  onBusinessNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onLicenseNumberChange: (value: string) => void;
};

/**
 * Business name, phone, and optional license. Shared by the customer
 * self-service application and the affiliate "Add a contractor" form.
 * The default ids and markup match the original /contractor fields.
 */
export function ContractorApplicationFields({
  idPrefix = "apply",
  businessName,
  phone,
  licenseNumber,
  onBusinessNameChange,
  onPhoneChange,
  onLicenseNumberChange,
}: Props) {
  return (
    <>
      <div className="space-y-1"><Label htmlFor={`${idPrefix}-business`}>Business name</Label><Input id={`${idPrefix}-business`} value={businessName} onChange={(event) => onBusinessNameChange(event.target.value)} required /></div>
      <div className="space-y-1"><Label htmlFor={`${idPrefix}-phone`}>Phone</Label><Input id={`${idPrefix}-phone`} value={phone} onChange={(event) => onPhoneChange(event.target.value)} required /></div>
      <div className="space-y-1"><Label htmlFor={`${idPrefix}-license`}>License (optional)</Label><Input id={`${idPrefix}-license`} value={licenseNumber} onChange={(event) => onLicenseNumberChange(event.target.value)} /></div>
    </>
  );
}
