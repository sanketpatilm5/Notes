import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { getCurrentUser } from '@/lib/auth';

export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setLocation('/notes');
    } else {
      setLocation('/login');
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
