import { useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth, googleProvider } from '../../shared/firebase';
import { syncToCloud, pullAndMerge } from '../storage';
import { Cloud, LogIn, LogOut, RefreshCw } from 'lucide-react';

interface Props {
  onSynced: () => void;
}

export default function AuthPanel({ onSynced }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setMessage(`登录失败: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handlePull = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await pullAndMerge(user.uid);
      setMessage('已从云端拉取最新数据');
      onSynced();
    } catch (err: any) {
      setMessage(`同步失败: ${err.message}`);
    }
    setSyncing(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const handlePush = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await syncToCloud(user.uid);
      setMessage('已同步到云端');
    } catch (err: any) {
      setMessage(`同步失败: ${err.message}`);
    }
    setSyncing(false);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="border-t border-gray-200 bg-white p-3">
      {message && (
        <div className="text-[10px] text-center text-emerald-600 mb-2 animate-[fadeIn_0.2s_ease]">
          {message}
        </div>
      )}

      {!user ? (
        <button
          className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors"
          onClick={handleLogin}
        >
          <LogIn size={14} /> Google 登录 (开启云同步)
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <Cloud size={14} className="text-emerald-500 shrink-0" />
          <span className="text-[10px] text-gray-500 truncate flex-1">{user.email}</span>
          <button
            className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors flex items-center gap-1"
            onClick={handlePull}
            disabled={syncing}
          >
            <RefreshCw size={10} className={syncing ? 'animate-spin' : ''} /> 拉取
          </button>
          <button
            className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
            onClick={handlePush}
            disabled={syncing}
          >
            推送
          </button>
          <button
            className="text-gray-400 hover:text-red-500 transition-colors"
            onClick={handleLogout}
            title="退出登录"
          >
            <LogOut size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
