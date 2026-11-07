import { Field, Input, Select, Textarea } from "@/components/ui";

export type PropertyRecord = {
  id?: string; name?: string; address_line?: string; city?: string; state?: string; zip?: string;
  category?: string; description?: string | null; internal_notes?: string | null;
};

export function PropertyFields({ p = {} }: { p?: PropertyRecord }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <Field label="Property name" hint="Your display name. Renaming does not change the legal address.">
        <Input name="name" defaultValue={p.name} placeholder="e.g. Fuel Plaza" required />
      </Field>
      <Field label="Category">
        <Select name="category" defaultValue={p.category ?? "commercial"}>
          <option value="residential">Residential</option>
          <option value="business_park">Business park</option>
          <option value="gas_station_adjacent">Gas station adjacent</option>
          <option value="commercial">Other commercial</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Legal street address">
          <Input name="address_line" defaultValue={p.address_line} required />
        </Field>
      </div>
      <Field label="City"><Input name="city" defaultValue={p.city} required /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="State"><Input name="state" defaultValue={p.state ?? "TX"} maxLength={2} required /></Field>
        <Field label="ZIP"><Input name="zip" defaultValue={p.zip} inputMode="numeric" required /></Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description (optional)"><Textarea name="description" defaultValue={p.description ?? ""} /></Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Internal notes (optional)" hint="Visible only to your organization."><Textarea name="internal_notes" defaultValue={p.internal_notes ?? ""} /></Field>
      </div>
    </div>
  );
}
