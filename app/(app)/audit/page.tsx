import { AuditChecklist } from '@/components/audit/AuditChecklist'
import { getOrCreateChecklist } from '@/lib/actions/checklist'

export default async function AuditPage() {
  const { checklist, items } = await getOrCreateChecklist()

  return <AuditChecklist checklist={checklist} initialItems={items} />
}
