import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, signOut, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, type User } from 'firebase/auth';
import { auth } from '../../shared/firebase';
import { syncToCloud, pullAndMerge, forcePull } from '../storage';
import { Cloud, LogIn, LogOut, RefreshCw, Download, Mail, ArrowLeft } from 'lucide-react';

interface Props {
  onSynced: () => void;
}

export default function SyncPanel({ onSynced }: Props) {
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
    setTimeout(() => setMessage(''), 5000);
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

  const handleGoogleLogin = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      showMessage('未配置 VITE_GOOGLE_CLIENT_ID');
      return;
    }

    setLoggingIn(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GOOGLE_LOGIN', clientId });
      if (response?.error) throw new Error(response.error);
      if (!response?.accessToken) throw new Error('未获取到 access_token');

      const credential = GoogleAuthProvider.credential(null, response.accessToken);
      await signInWithCredential(auth, credential);
    } catch (err: any) {
      const msg = err.message ?? String(err);
      if (msg.includes('redirect_uri_mismatch') || msg.includes('400')) {
        const ru = chrome.identity.getRedirectURL();
        showMessage(`OAuth 重定向 URI 未配置，请在 Google Cloud Console 添加: ${ru}`);
        console.error('[Energy] redirect_uri_mismatch. Add redirect URI:', ru);
      } else if (msg !== 'The user did not approve access.') {
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
    } catch (err: any) {
      const code = err.code as string;
      if (code === 'auth/user-not-found') showMessage('账号不存在，请先注册');
      else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') showMessage('密码错误');
      else if (code === 'auth/email-already-in-use') showMessage('邮箱已注册，请直接登录');
      else if (code === 'auth/weak-password') showMessage('密码至少 6 位');
      else if (code === 'auth/invalid-email') showMessage('邮箱格式不正确');
      else showMessage(`登录失败: ${err.message}`);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (user) await handlePush(user.uid, true);
    await signOut(auth);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-2 z-10">
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
              onClick={handleGoogleLogin}
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
            onClick={() => handlePull(user.uid)}
            disabled={syncing}
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
