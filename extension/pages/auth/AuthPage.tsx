import { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged, type User } from 'firebase/auth';
import { auth, googleProvider } from '../../../shared/firebase';

export default function AuthPage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-3xl mb-2">&#9889;</div>
        <h1 className="text-lg font-bold text-gray-800 mb-4">精力管理 - 登录</h1>

        {user ? (
          <div>
            <div className="bg-emerald-50 text-emerald-700 rounded-lg p-4 mb-4">
              <div className="font-bold mb-1">登录成功</div>
              <div className="text-sm">{user.email}</div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              可以关闭此页面，回到扩展 popup 即可同步数据。
            </p>
            <button
              className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              onClick={() => window.close()}
            >
              关闭此页面
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              登录 Google 账号以开启跨设备云同步
            </p>
            <button
              className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors"
              onClick={handleLogin}
            >
              Google 登录
            </button>
            {error && (
              <div className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg p-2">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
