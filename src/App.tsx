import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { HomeScreen } from './screens/HomeScreen';
import { NoteEditor } from './screens/NoteEditor';
import { AnimatePresence, motion } from 'motion/react';

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/note/:id" element={<NoteEditor />} />
        <Route path="/profile" element={<ProfileScreen />} />
      </Routes>
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ThemeProvider>
        <Router>
          <div className="min-h-screen bg-transparent relative overflow-x-hidden">
            {/* Global Background Decorations */}
            <div className="fixed -z-10 top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand/10 blur-[100px] rounded-full" />
            <div className="fixed -z-10 bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[100px] rounded-full" />
            
            <Suspense fallback={<LoadingScreen />}>
              <AnimatedRoutes />
            </Suspense>
          </div>
        </Router>
      </ThemeProvider>
    </AppProvider>
  );
}

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProfileScreen = () => {
  const { user, logout, tokenStatus } = useAppContext();
  const navigate = useNavigate();

  if (!user) return <div className="p-8 text-center">Please sign in</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-md mx-auto p-6 pt-20"
    >
      <button onClick={() => navigate('/')} className="mb-6 opacity-50 hover:opacity-100 flex items-center gap-2">
        &larr; Back
      </button>
      <div className="glass p-8 rounded-[32px] text-center space-y-4">
        <img src={user.photoURL} alt="pfp" className="w-24 h-24 rounded-full mx-auto border-4 border-white shadow-xl" />
        <h2 className="text-xl font-display font-bold">{user.displayName}</h2>
        <p className="text-sm text-neutral-500">{user.email}</p>
        
        <div className="py-4 px-6 bg-brand/5 rounded-2xl border border-brand/10 flex justify-between items-center text-left">
          <div>
            <p className="text-[10px] font-bold text-brand uppercase tracking-wider">AI Token Balance</p>
            <p className="text-2xl font-display font-black text-brand">{tokenStatus?.remaining}/10</p>
          </div>
          <div className="text-right">
             <p className="text-[10px] text-neutral-400">DAILY LIMIT</p>
             <p className="text-xs font-medium">Refreshes in {Math.ceil((tokenStatus?.nextReset?.getTime() || 0 - Date.now()) / 3600000)}h</p>
          </div>
        </div>

        <button 
          onClick={() => { logout(); navigate('/'); }}
          className="w-full py-4 rounded-2xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </motion.div>
  );
}
