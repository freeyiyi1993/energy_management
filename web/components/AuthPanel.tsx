import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../shared/firebase';
import { syncToCloud, sync, resetAllData } from '../storage';
import BaseAuthPanel from '../../shared/components/BaseAuthPanel';

interface Props {
  onSynced: () => void;
}

export default function AuthPanel({ onSynced }: Props) {
  const handleGoogleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleLogout = async () => {
    localStorage.removeItem('energy_app_data');
  };

  return (
    <BaseAuthPanel
      onSynced={onSynced}
      onGoogleLogin={handleGoogleLogin}
      onLogout={handleLogout}
      syncFn={sync}
      syncToCloudFn={syncToCloud}
      resetAllDataFn={resetAllData}
      alwaysNotifySynced
      containerClassName="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-2 z-10"
      containerStyle={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}
    />
  );
}
