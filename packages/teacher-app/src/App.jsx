import { useState, useEffect } from 'react';
import QuizCreator from './components/QuizCreator';
import QuizHost from './components/QuizHost';
import { db, defaultQuizzes, audioSynth, isFirebaseConfigured, dbFirestore } from '@opengoo/core';
import { collection, onSnapshot, doc, setDoc, query, where, or } from 'firebase/firestore';
import { getActiveUser, setLocalUser } from './services/authService';
import { 
  Sparkles, 
  GraduationCap, 
  Plus, 
  Play, 
  Layers
} from 'lucide-react';


export default function App() {
  const [view, setView] = useState('home'); // 'home' | 'creator' | 'host'
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    getActiveUser().then(user => {
      setCurrentUser(user);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    if (!isFirebaseConfigured || !dbFirestore) {
      // Offline/Local Storage Fallback
      const allLocal = db.getQuizzes();
      const filteredLocal = allLocal.filter(quiz => 
        quiz.isSystemDefault || 
        quiz.creator === currentUser.email || 
        (quiz.creator === 'teacher@opengoo.local' && currentUser.email === 'teacher@opengoo.local') || // Treat unassigned quizzes as teacher@opengoo.local
        quiz.sharedWith?.includes(currentUser.email)
      );
      setQuizzes(filteredLocal);
      return;
    }

    // Secure custom subscription for multi-user isolation on Firestore
    const quizzesCollection = collection(dbFirestore, 'quizzes');
    const q = query(
      quizzesCollection,
      or(
        where('creator', '==', currentUser.email),
        where('sharedWith', 'array-contains', currentUser.email),
        where('isSystemDefault', '==', true)
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let firebaseQuizzes = [];
      snapshot.forEach((doc) => {
        firebaseQuizzes.push(doc.data());
      });

      if (firebaseQuizzes.length === 0) {
        // Only seed if we haven't seeded yet (to allow user to delete all quizzes)
        const alreadySeeded = localStorage.getItem('opengooapp_quizzes_cloud_seeded') === 'true';
        if (!alreadySeeded) {
          const local = db.getQuizzes();
          if (local.length > 0) {
            local.forEach((quiz) => {
              const cleanQuiz = JSON.parse(JSON.stringify(quiz));
              // Ensure we stamp the creator on any seeded quiz if missing
              if (!cleanQuiz.creator) {
                cleanQuiz.creator = currentUser.email;
              }
              setDoc(doc(dbFirestore, 'quizzes', quiz.id), cleanQuiz).catch((err) => {
                console.error("Failed to seed quiz to Firestore:", err);
              });
            });
            localStorage.setItem('opengooapp_quizzes_cloud_seeded', 'true');
            setQuizzes(local);
          }
        } else {
          db.saveQuizzes([]);
          setQuizzes([]);
        }
      } else {
        // Sort by created date
        firebaseQuizzes.sort((a, b) => new Date(a.created || 0) - new Date(b.created || 0));

        // Auto-seed any missing default quizzes to Firestore first
        defaultQuizzes.forEach((defaultQuiz) => {
          const exists = firebaseQuizzes.some((q) => q.id === defaultQuiz.id);
          if (!exists) {
            firebaseQuizzes.push(defaultQuiz);
          }
        });

        // To prevent race conditions from overwriting newly created custom quizzes that are still syncing to Firestore,
        // we preserve any custom quizzes in local storage that were created in the last 20 seconds.
        const currentLocal = db.getQuizzes();
        const now = new Date().getTime();
        currentLocal.forEach((localQuiz) => {
          const exists = firebaseQuizzes.some((q) => q.id === localQuiz.id);
          if (!exists) {
            const isDefault = defaultQuizzes.some((dq) => dq.id === localQuiz.id);
            if (!isDefault) {
              const createdTime = new Date(localQuiz.created || 0).getTime();
              if (now - createdTime < 20000) {
                if (localQuiz.creator === currentUser.email) {
                  firebaseQuizzes.push(localQuiz);
                }
              }
            }
          }
        });

        // Save the consolidated list to local storage and update app state
        db.saveQuizzes(firebaseQuizzes);
        localStorage.setItem('opengooapp_quizzes_cloud_seeded', 'true');
        setQuizzes(firebaseQuizzes);
      }
    }, (error) => {
      console.error("Firestore quizzes synchronization error:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSetQuizzes = (allQuizzes) => {
    if (!currentUser) return;
    if (!isFirebaseConfigured || !dbFirestore) {
      const filtered = allQuizzes.filter(quiz => 
        quiz.isSystemDefault || 
        quiz.creator === currentUser.email || 
        (quiz.creator === 'teacher@opengoo.local' && currentUser.email === 'teacher@opengoo.local') ||
        quiz.sharedWith?.includes(currentUser.email)
      );
      setQuizzes(filtered);
    } else {
      setQuizzes(allQuizzes);
    }
  };

  const handleSwitchProfile = (email) => {
    audioSynth.playClick();
    const name = email.split('@')[0];
    const updatedUser = { email, name, isIAP: false };
    setLocalUser(updatedUser);
    setCurrentUser(updatedUser);
  };

  const navigateTo = (newView, quizId = '') => {
    audioSynth.playClick();
    setSelectedQuizId(quizId);
    setView(newView);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Background Glows */}
      <div className="ambient-glows">
        <div className="glow-bubble glow-bubble-1"></div>
        <div className="glow-bubble glow-bubble-2"></div>
        <div className="glow-bubble glow-bubble-3"></div>
      </div>

      {/* User Indicator / Profile Switcher */}
      {currentUser && view !== 'host' && (
        <div style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0.5rem 1rem',
          borderRadius: '16px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>
              {currentUser.name}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {currentUser.email}
            </span>
          </div>
          
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }}></div>

          {!currentUser.isIAP ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-purple)', background: 'rgba(138,43,226,0.15)', padding: '0.15rem 0.4rem', borderRadius: '4px', letterSpacing: '0.05em' }}>DEV</span>
              <select 
                value={currentUser.email} 
                onChange={(e) => handleSwitchProfile(e.target.value)}
                style={{ 
                  background: 'rgba(0, 0, 0, 0.4)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  color: 'white', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  padding: '0.2rem 0.5rem', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="teacher@opengoo.local" style={{ background: 'var(--bg-dark)' }}>Teacher Account</option>
                <option value="colleague@opengoo.local" style={{ background: 'var(--bg-dark)' }}>Colleague Account</option>
              </select>
            </div>
          ) : (
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-purple)', background: 'rgba(138,43,226,0.15)', padding: '0.15rem 0.4rem', borderRadius: '4px', letterSpacing: '0.05em' }}>IAP SECURED</span>
          )}
        </div>
      )}

      {/* Main Hub Router */}
      {view === 'home' && (
        <div className="anim-slide-up" style={{ width: '100%', maxWidth: '1000px', margin: 'auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
          {/* Header branding */}
          <header style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(138,43,226,0.12)', border: '1px solid hsla(265, 85%, 65%, 0.3)', padding: '0.5rem 1.25rem', borderRadius: '20px', color: 'var(--accent-purple)', fontSize: '0.85rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '0.05em' }}>
              <Sparkles size={14} /> TEACHER PANEL
            </div>
            <h1 style={{ fontSize: '4rem', fontFamily: 'var(--font-heading)', fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(180deg, #ffffff 0%, #be9bf7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              OpenGoo! Teacher Hub
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem', maxWidth: '600px', margin: '0.5rem auto 0 auto' }}>
              Create premium interactive quizzes, organize multi-choice trivia, and host live games for your students.
            </p>
          </header>

          {/* Core Content */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', maxWidth: '650px', margin: '0 auto', width: '100%' }}>
            
            {/* Teacher Panel Portal */}
            <div className="glass-panel glass-panel-hover" style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid rgba(138,43,226,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(138,43,226,0.15)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: 'white' }}>Quiz Board Manager</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Host Live Gameplay Lobby</p>
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Build complex multiple choice questions with customized points, time limits, and bracket constraints. Retrieve individual Game PINs to host public lobbies.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button className="btn-primary" onClick={() => navigateTo('creator')} style={{ height: '48px' }}>
                  <Plus size={18} /> Manage & Create Quizzes
                </button>
                
                {quizzes.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>CHOOSE QUIZ TO HOST</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                      {quizzes.map((quiz) => (
                        <button 
                          key={quiz.id} 
                          className="btn-secondary" 
                          onClick={() => navigateTo('host', quiz.id)} 
                          style={{ height: '38px', fontSize: '0.85rem', justifyContent: 'flex-start', padding: '0 0.75rem', gap: '0.4rem' }}
                        >
                          <Play size={12} fill="currentColor" /> Host: {quiz.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Quick instructions block */}
          <footer style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
            <span>💡 <strong>Deployment Info:</strong> This portal is private and secured via Google Cloud Identity-Aware Proxy (IAP).</span>
            <span>•</span>
            <span>🎹 Retro Synthesizer sounds are active on lobbies and question boards.</span>
          </footer>

        </div>
      )}

      {/* VIEW: CREATOR PANEL */}
      {view === 'creator' && (
        <div style={{ padding: '2rem 1.5rem', width: '100%' }}>
          <QuizCreator quizzes={quizzes} setQuizzes={handleSetQuizzes} onBack={() => navigateTo('home')} onHost={(quizId) => navigateTo('host', quizId)} currentUser={currentUser} />
        </div>
      )}

      {/* VIEW: HOST BOARD */}
      {view === 'host' && (
        <div style={{ padding: '2rem 1.5rem', width: '100%' }}>
          <QuizHost quizId={selectedQuizId} onBack={() => navigateTo('home')} />
        </div>
      )}

    </div>
  );
}

