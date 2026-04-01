import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { Cloud, LogIn, LogOut, RefreshCw, Mail, ArrowLeft, Trash2 } from 'lucide-react';

interface BaseAuthPanelProps {
  onSynced: () => void;
  onGoogleLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  syncFn: (uid: string) => Promise<'synced' | 'no_change' | 'empty'>;
  syncToCloudFn: (uid: string) => Promise<void>;
  resetAllDataFn: (uid?: string) => Promise<void>;
  messageTimeout?: number;
  containerClassName?: string;
  alwaysNotifySynced?: boolean;
}

export default function BaseAuthPanel({
  onSynced,
  onGoogleLogin,
  onLogout,
  syncFn,
  syncToCloudFn,
  resetAllDataFn,
  messageTimeout = 3000,
  containerClassName = 'fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-2 z-10',
  alwaysNotifySynced = false,
}: BaseAuthPanelProps) {
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [message, setMessage] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const pushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialPullDone = useRef(false);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), messageTimeout);
  };

  const handleSync = useCallback(async (uid: string, silent = false) => {
    setSyncing(true);
    try {
      const result = await syncFn(uid);
      if (!silent) {
        if (result === 'synced') showMessage('已同步');
        else if (result === 'no_change') showMessage('数据已是最新');
        else if (result === 'empty') showMessage('首次同步，已上传本地数据');
      }
      if (alwaysNotifySynced || result === 'synced') onSynced();
    } catch (err: unknown) {
      if (!silent) showMessage(`同步失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    setSyncing(false);
  }, [onSynced, syncFn, alwaysNotifySynced]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && !initialPullDone.current) {
        initialPullDone.current = true;
        await handleSync(u.uid, true);
      }
      if (!u) {
        initialPullDone.current = false;
      }
    });
    return unsub;
  }, [handleSync]);

  // 自动同步：每 60 秒
  useEffect(() => {
    if (pushTimerRef.current) clearInterval(pushTimerRef.current);
    if (user) {
      pushTimerRef.current = setInterval(() => {
        syncFn(user.uid).catch(() => {});
      }, 60_000);
    }
    return () => {
      if (pushTimerRef.current) clearInterval(pushTimerRef.current);
    };
  }, [user, syncFn]);

  const handleGoogleLoginClick = async () => {
    setLoggingIn(true);
    try {
      await onGoogleLogin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'The user did not approve access.') {
        showMessage(`登录失败: ${msg}`);
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      showMessage('请输入邮箱和密码');
      return;
    }
    setLoggingIn(true);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowEmailForm(false);
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/user-not-found') showMessage('账号不存在，请先注册');
      else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') showMessage('密码错误');
      else if (code === 'auth/email-already-in-use') showMessage('邮箱已注册，请直接登录');
      else if (code === 'auth/weak-password') showMessage('密码至少 6 位');
      else if (code === 'auth/invalid-email') showMessage('邮箱格式不正确');
      else showMessage(`登录失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleResetData = async () => {
    if (!confirm('确认删除所有数据？此操作会清除所有端的历史记录，不可撤销。')) return;
    try {
      await resetAllDataFn(user?.uid);
      showMessage('数据已清除');
      onSynced();
    } catch (err: unknown) {
      showMessage(`清除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleLogoutClick = async () => {
    if (user) await syncToCloudFn(user.uid);
    await onLogout();
    await signOut(auth);
  };

  return (
    <div className={containerClassName}>
      {message && (
        <div className="text-[10px] text-center text-emerald-600 mb-1 animate-[fadeIn_0.2s_ease]">
          {message}
        </div>
      )}

      {!user ? (
        showEmailForm ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 mb-1">
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => { setShowEmailForm(false); setMessage(''); }}
              >
                <ArrowLeft size={14} />
              </button>
              <span className="text-xs font-bold text-gray-700">{isRegister ? '注册' : '邮箱登录'}</span>
            </div>
            <input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-emerald-400"
            />
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-emerald-400"
            />
            <button
              className="w-full bg-emerald-500 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              onClick={handleEmailLogin}
              disabled={loggingIn}
            >
              {loggingIn ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>
            <button
              className="w-full text-[10px] text-gray-500 hover:text-emerald-500 transition-colors"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              onClick={handleGoogleLoginClick}
              disabled={loggingIn}
            >
              <LogIn size={14} /> {loggingIn ? '登录中...' : 'Google'}
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
              onClick={() => setShowEmailForm(true)}
            >
              <Mail size={14} /> 邮箱
            </button>
          </div>
        )
      ) : (
        <div className="flex items-center gap-1.5">
          <Cloud size={12} className="text-emerald-500 shrink-0" />
          <span className="text-[10px] text-gray-500 truncate flex-1">{user.email}</span>
          <button
            className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors flex items-center gap-1"
            onClick={() => handleSync(user.uid)}
            disabled={syncing}
          >
            <RefreshCw size={10} className={syncing ? 'animate-spin' : ''} /> 同步
          </button>
          <button
            className="text-gray-400 hover:text-red-500 transition-colors"
            onClick={handleResetData}
            title="删除所有数据"
          >
            <Trash2 size={12} />
          </button>
          <button
            className="text-gray-400 hover:text-red-500 transition-colors"
            onClick={handleLogoutClick}
            title="退出登录"
          >
            <LogOut size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
