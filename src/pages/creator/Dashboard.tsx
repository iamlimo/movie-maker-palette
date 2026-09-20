import CreatorPanel from '@/pages/admin/dashboards/CreatorPanel';
import { useEffect } from 'react';

export default function CreatorDashboardPage() {
  useEffect(() => {
    document.title = 'Creator Dashboard • Signature TV';
  }, []);

  return <CreatorPanel />;
}
