import { fetchAdminFeedback, updateAdminFeedback } from '../../api.js';
import { AdminInboxPage } from './AdminInboxPage.jsx';

export function AdminFeedbackPage() {
  return (
    <AdminInboxPage
      title="User feedback"
      description="Ideas, bugs, and general messages from Settings."
      fetchItems={fetchAdminFeedback}
      updateItem={updateAdminFeedback}
      itemKey="feedback"
      renderMeta={(item) =>
        item.appVersion ? (
          <p className="text-muted mt-1 text-xs">App version: {item.appVersion}</p>
        ) : null
      }
    />
  );
}
