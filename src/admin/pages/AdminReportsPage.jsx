import { fetchAdminReports, updateAdminReport } from '../../api.js';
import { AdminInboxPage } from './AdminInboxPage.jsx';

function reportMeta(item) {
  if (!item.dealName && !item.store) return null;
  return (
    <p className="text-muted mt-1 text-xs">
      {item.dealName && <span className="text-heading font-semibold">{item.dealName}</span>}
      {item.store && <span> · {item.store}</span>}
      {item.reportedPrice != null && <span> · reported ${Number(item.reportedPrice).toFixed(2)}</span>}
      {item.postcode && <span> · {item.postcode}</span>}
    </p>
  );
}

export function AdminReportsPage() {
  return (
    <AdminInboxPage
      title="User reports"
      description="Wrong prices, missing deals, bugs, and account issues reported in the app."
      fetchItems={fetchAdminReports}
      updateItem={updateAdminReport}
      itemKey="reports"
      renderMeta={reportMeta}
    />
  );
}
