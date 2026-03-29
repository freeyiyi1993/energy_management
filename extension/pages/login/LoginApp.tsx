import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../../shared/firebase';
import { LogIn } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginApp() {
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [success, setSuccess] = useState(false);

  // If user is already logged in, show success and close
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setSuccess(true);
        setTimeout(() => window.close(), 1500);
      }
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('未配置 VITE_GOOGLE_CLIENT_ID，请联系开发者');
      return;
    }

    setError('');
    setLoggingIn(true);

    try {
      const redirectUrl = chrome.identity.getRedirectURL();
      console.log('[Energy Extension] OAuth redirect URL (add this to Google Cloud Console):', redirectUrl);
      const scopes = encodeURIComponent('openid email profile');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${scopes}`;

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });

      if (!responseUrl) throw new Error('授权被取消');

      const hashParams = new URLSearchParams(responseUrl.split('#')[1]);
      const accessToken = hashParams.get('access_token');
      if (!accessToken) throw new Error('未获取到 access_token');

      const credential = GoogleAuthProvider.credential(null, accessToken);
      await signInWithCredential(auth, credential);

      setSuccess(true);
      setTimeout(() => window.close(), 1500);
    } catch (err: any) {
      if (err.message !== 'The user did not approve access.') {
        const msg = err.message ?? String(err);
        if (msg.includes('redirect_uri_mismatch') || msg.includes('400')) {
          const ru = chrome.identity.getRedirectURL();
          setError(`OAuth 重定向 URI 未配置。请在 Google Cloud Console → APIs & Services → Credentials → 对应的 OAuth 2.0 客户端 → 已获授权的重定向 URI 中添加：${ru}`);
          console.error('[Energy Extension] redirect_uri_mismatch. Add this redirect URI to Google Cloud Console:', ru);
        } else {
          setError(`登录失败: ${msg}`);
        }
      }
    } finally {
      setLoggingIn(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center font-sans">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border-t-4 border-emerald-500">
          <h2 className="text-2xl font-bold text-emerald-600 mb-4">登录成功</h2>
          <p className="text-gray-600 mb-2">云同步已开启，页面即将自动关闭...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center font-sans">
      <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-[90%] text-center">
        <div className="text-5xl mb-4">⚡</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">精力管理</h1>
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          登录 Google 账号以开启跨设备云同步功能，<br />
          你的精力数据将安全存储在云端。
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-left break-all">
            {error}
          </div>
        )}

        <button
          className="w-full flex items-center justify-center gap-3 bg-blue-500 text-white py-3 px-6 rounded-xl text-base font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleLogin}
          disabled={loggingIn}
        >
          <LogIn size={20} />
          {loggingIn ? '登录中...' : 'Google 登录'}
        </button>

        <button
          className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          onClick={() => window.close()}
        >
          暂不登录，关闭页面
        </button>
      </div>
    </div>
  );
}
