import { useState, useEffect, useRef, useCallback } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth, googleProvider } from '../../shared/firebase';
import { syncToCloud, pullAndMerge, forcePull } from '../storage';
import { Cloud, LogIn, LogOut, RefreshCw, Download } from 'lucide-react';

interface Props {
  onSynced: () => void;
}

export default function AuthPanel({ onSynced }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const pushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialPullDone = useRef(false);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handlePull = useCallback(async (uid: string, silent = false) => {
    setSyncing(true);
    try {
      const result = await pullAndMerge(uid);
      if (!silent) {
        if (result === 'cloud') showMessage('已从云端拉取最新数据（日志已合并）');
        else if (result === 'merged') showMessage('已合并云端日志');
        else if (result === 'local') showMessage('本地数据更新，无需拉取');
        else showMessage('云端无数据');
      }
      if (result === 'cloud' || result === 'merged') onSynced();
    } catch (err: any) {
      if (!silent) showMessage(`同步失败: ${err.message}`);
    }
    setSyncing(false);
  }, [onSynced]);

  const handleForcePull = useCallback(async (uid: string) => {
    setSyncing(true);
    try {
      await forcePull(uid);
      showMessage('已强制覆盖为云端数据');
      onSynced();
    } catch (err: any) {
      showMessage(`同步失败: ${err.message}`);
    }
    setSyncing(false);
  }, [onSynced]);

  const handlePush = useCallback(async (uid: string, silent = false) => {
    try {
      await syncToCloud(uid);
      if (!silent) showMessage('已同步到云端');
    } catch (err: any) {
      if (!silent) showMessage(`同步失败: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && !initialPullDone.current) {
        initialPullDone.current = true;
        await handlePull(u.uid, true);
      }
      if (!u) {
        initialPullDone.current = false;
      }
    });
    return unsub;
  }, [handlePull]);

  // 自动推送：每 60 秒
  useEffect(() => {
    if (pushTimerRef.current) clearInterval(pushTimerRef.current);
    if (user) {
      pushTimerRef.current = setInterval(() => {
        handlePush(user.uid, true);
      }, 60_000);
    }
    return () => {
      if (pushTimerRef.current) clearInterval(pushTimerRef.current);
    };
  }, [user, handlePush]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      showMessage(`登录失败: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    if (user) await handlePush(user.uid, true);
    await signOut(auth);
  };

  return (
    <div className="border-t border-gray-200 bg-white/80 p-2">
      {message && (
        <div className="text-[10px] text-center text-emerald-600 mb-1 animate-[fadeIn_0.2s_ease]">
          {message}
        </div>
      )}

      {!user ? (
        <button
          className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors"
          onClick={handleLogin}
        >
          <LogIn size={14} /> Google 登录 (开启云同步)
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <Cloud size={12} className="text-emerald-500 shrink-0" />
          <span className="text-[10px] text-gray-500 truncate flex-1">{user.email}</span>
          <span className="text-[9px] text-gray-400">自动同步</span>
          <button
            className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors flex items-center gap-1"
            onClick={() => handlePull(user.uid)}
            disabled={syncing}
            title="智能拉取：取更新的数据"
          >
            <RefreshCw size={10} className={syncing ? 'animate-spin' : ''} /> 拉取
          </button>
          <button
            className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors flex items-center gap-1"
            onClick={() => handleForcePull(user.uid)}
            disabled={syncing}
            title="强制拉取：云端直接覆盖本地"
          >
            <Download size={10} /> 强制
          </button>
          <button
            className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
            onClick={() => handlePush(user.uid)}
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
