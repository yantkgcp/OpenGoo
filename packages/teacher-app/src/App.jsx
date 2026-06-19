import { useState, useEffect } from 'react';
import QuizCreator from './components/QuizCreator';
import QuizHost from './components/QuizHost';
import { db, defaultQuizzes, audioSynth, isFirebaseConfigured, dbFirestore } from '@opengoo/core';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
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
  const [quizzes, setQuizzes] = useState(() => db.getQuizzes());

  useEffect(() => {
    if (!isFirebaseConfigured || !dbFirestore) return;

    const unsubscribe = onSnapshot(collection(dbFirestore, 'quizzes'), (snapshot) => {
      let firebaseQuizzes = [];
      snapshot.forEach((doc) => {
        firebaseQuizzes.push(doc.data());
      });

      if (firebaseQuizzes.length === 0) {
        // Only seed if we haven't seeded yet (to allow user to delete all quizzes)
        const alreadySeeded = localStorage.getItem('kahoot_quizzes_cloud_seeded') === 'true';
        if (!alreadySeeded) {
          const local = db.getQuizzes();
          if (local.length > 0) {
            local.forEach((quiz) => {
              const cleanQuiz = JSON.parse(JSON.stringify(quiz));
              setDoc(doc(dbFirestore, 'quizzes', quiz.id), cleanQuiz).catch((err) => {
                console.error("Failed to seed quiz to Firestore:", err);
              });
            });
            localStorage.setItem('kahoot_quizzes_cloud_seeded', 'true');
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
            const cleanQuiz = JSON.parse(JSON.stringify(defaultQuiz));
            setDoc(doc(dbFirestore, 'quizzes', defaultQuiz.id), cleanQuiz).catch((err) => {
              console.error(`Failed to seed missing default quiz ${defaultQuiz.id} to Firestore:`, err);
            });
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
                firebaseQuizzes.push(localQuiz);
              }
            }
          }
        });

        // Save the consolidated list to local storage and update app state
        db.saveQuizzes(firebaseQuizzes);
        localStorage.setItem('kahoot_quizzes_cloud_seeded', 'true');
        setQuizzes(firebaseQuizzes);
      }
    }, (error) => {
      console.error("Firestore quizzes synchronization error:", error);
    });

    return () => unsubscribe();
  }, []);

  const navigateTo = (newView, quizId = '') => {
    audioSynth.playClick();
    setSelectedQuizId(quizId);
    setView(newView);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Background Glows */}
      <div className="ambient-glows">
        <div className="glow-bubble glow-bubble-1"></div>
        <div className="glow-bubble glow-bubble-2"></div>
        <div className="glow-bubble glow-bubble-3"></div>
      </div>

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
          <QuizCreator quizzes={quizzes} setQuizzes={setQuizzes} onBack={() => navigateTo('home')} onHost={(quizId) => navigateTo('host', quizId)} />
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
