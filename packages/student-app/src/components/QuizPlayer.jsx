/* eslint-disable react-hooks/purity */
import { useState, useEffect, useRef } from 'react';
import { audioSynth, GameSync } from '@opengoo/core';
import { 
  ArrowLeft, 
  Smile, 
  Hash, 
  Users, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  Award
} from 'lucide-react';

export default function QuizPlayer({ onBack }) {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [playerId] = useState(() => 'player_' + Math.random().toString(36).substr(2, 9));
  
  const handleBack = () => {
    audioSynth.playClick();
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (onBack) {
      onBack();
    } else {
      setPin('');
      setName('');
      setGameState('join');
      setLobbyTitle('');
      setCurrentQuestion(null);
      setSelectedOptions([]);
      setFeedback({
        isCorrect: false,
        pointsGained: 0,
        score: 0,
        streak: 0,
        rank: 1
      });
    }
  };
  
  // Player game states
  const [gameState, setGameState] = useState('join'); // 'join' | 'lobby' | 'get-ready' | 'answering' | 'answered' | 'feedback' | 'game-over'
  const [lobbyTitle, setLobbyTitle] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionStartNow, setQuestionStartNow] = useState(0);
  
  // Answer status states
  const [selectedOptions, setSelectedOptions] = useState([]); // indices selected
  const [feedback, setFeedback] = useState({
    isCorrect: false,
    pointsGained: 0,
    score: 0,
    streak: 0,
    rank: 1
  });

  const unsubscribeRef = useRef(null);

  // Join Game handler
  const handleJoinGame = (e) => {
    e.preventDefault();
    audioSynth.playClick();
    
    if (!pin.trim() || pin.length < 5) {
      alert("Please enter a valid 6-digit Game PIN!");
      return;
    }

    if (!name.trim()) {
      alert("Please enter a nickname!");
      return;
    }

    setGameState('lobby');

    // Connect to the host using unified GameSync API
    unsubscribeRef.current = GameSync.joinGame(pin.trim(), playerId, name.trim(), {
      onLobbyState: (title) => {
        setLobbyTitle(title);
      },
      onQuestionStart: (msg) => {
        setSelectedOptions([]);
        setCurrentQuestion(msg);
        setGameState('answering');
        setQuestionStartNow(Date.now());
      },
      onQuestionEnd: (msg) => {
        setFeedback({
          isCorrect: msg.isCorrect,
          pointsGained: msg.pointsGained,
          score: msg.score,
          streak: msg.streak,
          rank: msg.rank
        });
        setGameState('feedback');
        
        if (msg.isCorrect) {
          audioSynth.playCorrect();
        } else {
          audioSynth.playIncorrect();
        }
      },
      onGameOver: () => {
        setGameState('game-over');
      },
      onInvalidPin: () => {
        alert("Game PIN not found! Please check the code and try again.");
        setGameState('join');
      },
      onError: (err) => {
        alert("Connection error: " + err.message + ". Check database config or rules.");
        setGameState('join');
      }
    });
  };

  // Leave active channel on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Submit Answer
  const handleSelectOption = (idx) => {
    if (gameState !== 'answering') return;
    audioSynth.playClick();

    if (currentQuestion.multiSelect) {
      // Toggle choice
      setSelectedOptions(prev => {
        if (prev.includes(idx)) {
          return prev.filter(i => i !== idx);
        } else {
          return [...prev, idx];
        }
      });
    } else {
      // Single selection mode -> instantly submit answer
      const speed = Date.now() - questionStartNow;
      GameSync.submitAnswer(pin.trim(), playerId, name.trim(), idx, speed);
      setGameState('answered');
    }
  };

  // Multi-choice submit button
  const handleMultiSubmit = () => {
    if (selectedOptions.length === 0) return;
    audioSynth.playClick();
    const speed = Date.now() - questionStartNow;
    
    // We send primary selection (Kahoot simple structure supports primary index, or we can send the list)
    // For simplicity of host tally, we send the first selected option.
    GameSync.submitAnswer(pin.trim(), playerId, name.trim(), selectedOptions[0], speed);
    setGameState('answered');
  };

  return (
    <div className="anim-slide-up" style={{ width: '100%', maxWidth: '500px', margin: '0 auto', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1rem' }}>
      
      {/* 1. JOIN VIEW */}
      {gameState === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '4rem', fontFamily: 'var(--font-heading)', fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(180deg, #ffffff 0%, #be9bf7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              OpenGoo!
            </h1>
            <h2 style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', fontWeight: 800, background: 'linear-gradient(135deg, #fff, var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>
              Join Game
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>Enter the PIN from the Host board to play!</p>
          </div>

          <form onSubmit={handleJoinGame} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* PIN Code */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                GAME PIN
              </label>
              <div style={{ position: 'relative' }}>
                <Hash size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input pin-input" 
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // numbers only
                  placeholder="000000"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            {/* Nickname */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                NICKNAME
              </label>
              <div style={{ position: 'relative' }}>
                <Smile size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  maxLength={15}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Einstein"
                  style={{ paddingLeft: '2.5rem', fontWeight: 700, height: '54px' }}
                />
              </div>
            </div>

            {/* Action Submit */}
            <button type="submit" className="btn-primary" style={{ height: '54px', fontSize: '1.1rem' }}>
              OK, Go!
            </button>
          </form>

          {/* Back trigger */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={handleBack} style={{ gap: '0.5rem' }}>
              <ArrowLeft size={16} /> Exit Game
            </button>
          </div>
        </div>
      )}

      {/* 2. LOBBY WAITING SCREEN */}
      {gameState === 'lobby' && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '3rem', background: 'linear-gradient(135deg, rgba(138,43,226,0.1) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid hsla(265, 85%, 65%, 0.15)' }}>
            <div style={{ 
              fontSize: '3.5rem', 
              animation: 'float-crown 2.5s infinite ease-in-out',
              marginBottom: '1rem'
            }}>
              🎮
            </div>
            
            <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', color: 'white' }}>You're in!</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 1.5rem 0' }}>
              See your nickname <strong style={{ color: 'var(--accent-purple)' }}>{name}</strong> on the teacher's screen?
            </p>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
              Quiz: <strong style={{ color: 'white' }}>{lobbyTitle || 'Checking...'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
            <Users size={16} />
            <span style={{ fontSize: '0.85rem' }}>Waiting for teacher to launch the game...</span>
          </div>
        </div>
      )}

      {/* 3. ANSWERING PAD SCREEN */}
      {gameState === 'answering' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flexGrow: 1, justifyContent: 'center', height: '100%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              QUESTION {currentQuestion.questionIdx + 1} OF {currentQuestion.totalQuestions}
            </span>
            {currentQuestion.pointsMultiplier > 1 && (
              <span style={{ background: 'var(--kahoot-yellow)', color: 'black', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '10px', fontWeight: 800 }}>
                🔥 2X POINTS
              </span>
            )}
          </div>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
            Look at the host screen!
          </h3>

          {/* Touch Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', flexGrow: 1, minHeight: '260px' }}>
            {[
              { color: 'red', shape: <div className="shape-triangle" /> },
              { color: 'blue', shape: <div className="shape-diamond" /> },
              { color: 'yellow', shape: <div className="shape-circle" /> },
              { color: 'green', shape: <div className="shape-square" /> }
            ].map((spec, idx) => {
              const isSelected = selectedOptions.includes(idx);
              return (
                <button 
                  key={idx} 
                  className={`student-button ${spec.color} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectOption(idx)}
                >
                  <span className="shape-icon" style={{ transform: 'scale(1.2)' }}>{spec.shape}</span>
                </button>
              );
            })}
          </div>

          {/* Multi-select controls */}
          {currentQuestion.multiSelect && (
            <button 
              className="btn-primary" 
              onClick={handleMultiSubmit}
              disabled={selectedOptions.length === 0}
              style={{ height: '54px', width: '100%', fontSize: '1.1rem', background: selectedOptions.length === 0 ? 'rgba(255,255,255,0.05)' : undefined, color: selectedOptions.length === 0 ? 'var(--text-muted)' : undefined, border: selectedOptions.length === 0 ? '1px solid rgba(255,255,255,0.05)' : undefined }}
            >
              Submit Choices
            </button>
          )}
        </div>
      )}

      {/* 4. ANSWER SUBMITTED WAITING VIEW */}
      {gameState === 'answered' && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '3rem', background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)' }}>
            <div style={{ 
              fontSize: '3rem', 
              animation: 'pulse-light 1.8s infinite ease-in-out',
              marginBottom: '1rem'
            }}>
              ⌛
            </div>
            
            <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', color: 'white' }}>Submitted!</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Waiting for other students to lock in their answers...
            </p>
          </div>
        </div>
      )}

      {/* 5. QUESTION FEEDBACK REVEAL */}
      {gameState === 'feedback' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {feedback.isCorrect ? (
            /* CORRECT CARD */
            <div className="glass-panel anim-pop-in" style={{ padding: '3rem 2rem', border: '2px solid var(--kahoot-green)', background: 'linear-gradient(180deg, hsla(145, 63%, 49%, 0.1) 0%, rgba(0,0,0,0.3) 100%)', textAlign: 'center' }}>
              <CheckCircle2 size={54} style={{ color: 'var(--kahoot-green)', margin: '0 auto 1.5rem auto', filter: 'drop-shadow(0 0 10px var(--kahoot-green-glow))' }} />
              <h2 style={{ fontSize: '2.5rem', fontFamily: 'var(--font-heading)', color: 'var(--kahoot-green)', fontWeight: 900 }}>
                CORRECT!
              </h2>
              
              <div style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'var(--font-heading)', margin: '1rem 0', color: 'white' }}>
                +{feedback.pointsGained}
              </div>

              {feedback.streak >= 3 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--kahoot-yellow)', fontWeight: 800, fontSize: '1rem', background: 'rgba(0,0,0,0.25)', padding: '0.4rem 1rem', borderRadius: '15px' }}>
                  🔥 Streak: {feedback.streak} answered in a row!
                </div>
              )}
            </div>
          ) : (
            /* INCORRECT CARD */
            <div className="glass-panel anim-pop-in" style={{ padding: '3rem 2rem', border: '2px solid var(--kahoot-red)', background: 'linear-gradient(180deg, hsla(354, 85%, 58%, 0.1) 0%, rgba(0,0,0,0.3) 100%)', textAlign: 'center' }}>
              <XCircle size={54} style={{ color: 'var(--kahoot-red)', margin: '0 auto 1.5rem auto', filter: 'drop-shadow(0 0 10px var(--kahoot-red-glow))' }} />
              <h2 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-heading)', color: 'var(--kahoot-red)', fontWeight: 900 }}>
                INCORRECT
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>No points earned this round.</p>
              {feedback.streak > 0 && (
                <div style={{ display: 'inline-block', color: 'var(--kahoot-red)', fontWeight: 700, fontSize: '0.9rem', marginTop: '1rem' }}>
                  Streak lost! ❄️
                </div>
              )}
            </div>
          )}

          {/* Scoring Summary */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total Score:</span>
              <strong style={{ fontSize: '1.2rem', color: 'white' }}>{feedback.score} pts</strong>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingUp size={16} style={{ color: 'var(--accent-purple)' }} /> Current Rank:
              </span>
              <strong style={{ fontSize: '1.1rem', color: 'white' }}>#{feedback.rank}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 6. GAME OVER VIEW */}
      {gameState === 'game-over' && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '3.5rem 2rem', background: 'linear-gradient(135deg, rgba(138,43,226,0.12) 0%, rgba(255,255,255,0.02) 100%)' }}>
            <Award size={48} style={{ color: 'var(--accent-gold)', margin: '0 auto 1rem auto' }} />
            <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', color: 'white' }}>Game Finished!</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
              Check out the teacher's podium screen to see if you won!
            </p>

            <div style={{ margin: '2rem 0 1rem 0', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Your Final Score</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'white', marginTop: '0.25rem' }}>
                {feedback.score}
              </div>
            </div>
          </div>

          <button className="btn-primary" onClick={handleBack} style={{ height: '50px' }}>
            Join Another Game
          </button>
        </div>
      )}

    </div>
  );
}
