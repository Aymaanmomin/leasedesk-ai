import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { saveProperty } from "../../actions";
import { PropertyFields } from "../property-fields";

export default function NewPropertyPage() {
  return (
    <>
      <PageHeader title="Add Property" />
      <Card className="max-w-3xl">
        <ActionForm action={saveProperty} submitLabel="Create property">
          <PropertyFields />
        </ActionForm>
      </Card>
    </>
  );
}
