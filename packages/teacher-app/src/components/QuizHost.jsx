import { useState, useEffect, useRef, useMemo } from 'react';
import { db, audioSynth, GameSync } from '@opengoo/core';
import { 
  ArrowLeft, 
  Play, 
  Users, 
  Volume2, 
  VolumeX, 
  ArrowRight,
  Award,
  Trophy,
  UserPlus
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function QuizHost({ quizId, onBack }) {
  const quiz = useMemo(() => db.getQuizById(quizId), [quizId]);
  const [pin] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [players, setPlayers] = useState([]);
  const [phase, setPhase] = useState('lobby'); // 'lobby' | 'get-ready' | 'question' | 'reveal' | 'leaderboard' | 'podium'
  const [questionIdx, setQuestionIndex] = useState(0);
  const [timer, setTimer] = useState(20);
  const [answers, setAnswers] = useState([]); // answers received for CURRENT question: { id, name, optionIdx, speed }
  const [mute, setMute] = useState(false);
  const [readyCountdown, setReadyCountdown] = useState(4); // "Get Ready" ticker

  // Keep refs of active states to avoid stale closures in events and intervals
  const playersRef = useRef(players);
  const phaseRef = useRef(phase);
  const muteRef = useRef(mute);
  const answersRef = useRef(answers);
  const questionIdxRef = useRef(questionIdx);
  const revealTimeoutRef = useRef(null);
  const getReadyIntervalRef = useRef(null);

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { muteRef.current = mute; }, [mute]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionIdxRef.current = questionIdx; }, [questionIdx]);

  const timerIntervalRef = useRef(null);
  const botsIntervalsRef = useRef([]);

  const currentQuestion = quiz?.questions[questionIdx];

  const clearGetReadyInterval = () => {
    if (getReadyIntervalRef.current) {
      clearInterval(getReadyIntervalRef.current);
      getReadyIntervalRef.current = null;
    }
  };

  const clearTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const clearBotTimers = () => {
    botsIntervalsRef.current.forEach(clearTimeout);
    botsIntervalsRef.current = [];
  };

  const revealCorrectAnswers = () => {
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    clearTimer();
    clearBotTimers();

    if (phaseRef.current !== 'question') return;

    setPhase('reveal');
    phaseRef.current = 'reveal';
    if (!muteRef.current) audioSynth.playPodium();

    const currentQuestionIdx = questionIdxRef.current;
    const q = quiz.questions[currentQuestionIdx];
    const currentAnswers = answersRef.current;

    // Calculate score updates for all players
    const updatedPlayers = playersRef.current.map(player => {
      const pAnswer = currentAnswers.find(a => a.playerId === player.id);
      
      if (!pAnswer) {
        // No answer submitted
        return { ...player, lastAnswerCorrect: false, streak: 0, pointsGained: 0 };
      }

      // Check if player's answer is correct
      const isCorrect = q.correctAnswers.includes(pAnswer.optionIdx);

      if (isCorrect) {
        // Points calculation formula:
        // Score = Speed Ratio * 500 + 500 base, then multiplied by Point Multiplier, plus streak bonus!
        const maxTimeMs = q.timeLimit * 1000;
        const speedRatio = Math.max(0, (maxTimeMs - pAnswer.speed) / maxTimeMs);
        const basePoints = 500 + Math.round(500 * speedRatio);
        const pointsGained = basePoints * q.pointsMultiplier + (player.streak * 50);
        
        return {
          ...player,
          score: player.score + pointsGained,
          streak: player.streak + 1,
          lastAnswerCorrect: true,
          pointsGained,
          lastSelection: pAnswer.optionIdx
        };
      } else {
        return {
          ...player,
          streak: 0,
          lastAnswerCorrect: false,
          pointsGained: 0,
          lastSelection: pAnswer.optionIdx
        };
      }
    });

    setPlayers(updatedPlayers);
    playersRef.current = updatedPlayers;

    // Sync Players to reveal view via GameSync
    GameSync.broadcastQuestionEnd(pin, q.correctAnswers, updatedPlayers);
  };

  const handlePlayerAnswer = (playerId, optionIdx, speed) => {
    if (phaseRef.current !== 'question') return;

    setAnswers(prev => {
      // Prevent double submissions
      if (prev.some(a => a.playerId === playerId)) return prev;
      
      const pInfo = playersRef.current.find(p => p.id === playerId);
      if (!pInfo) return prev;

      const updated = [...prev, { playerId, name: pInfo.name, optionIdx, speed }];
      answersRef.current = updated;
      
      // If all active human & bot players answered, skip countdown!
      if (updated.length === playersRef.current.length) {
        if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = setTimeout(revealCorrectAnswers, 300);
      }
      return updated;
    });
  };

  const handlePlayerJoin = (id, name) => {
    setPlayers(prev => {
      if (prev.some(p => p.id === id || p.name.toLowerCase() === name.toLowerCase())) {
        // Player already in or name taken
        return prev;
      }
      audioSynth.playClick();
      const updated = [...prev, { id, name, score: 0, streak: 0, lastAnswerCorrect: false }];
      playersRef.current = updated;
      return updated;
    });
  };

  const addBots = () => {
    audioSynth.playClick();
    const botNames = ['PixelWiz 👾', 'Brainiac 🧠', 'SpeedyBot ⚡', 'NerdOut 🤓'];
    const currentNames = playersRef.current.map(p => p.name);
    const availableBots = botNames.filter(name => !currentNames.includes(name));

    if (availableBots.length === 0) return;

    setPlayers(prev => {
      const newBots = availableBots.map(name => ({
        id: 'bot_' + Math.random().toString(36).substr(2, 9),
        name,
        score: 0,
        streak: 0,
        lastAnswerCorrect: false,
        isBot: true
      }));
      const updated = [...prev, ...newBots];
      playersRef.current = updated;
      
      // Sync the new players list (including bots) to Firestore so they are preserved
      GameSync.updateLobbyPlayers(pin, updated);
      
      return updated;
    });
  };

  const toggleMute = () => {
    audioSynth.playClick();
    if (muteRef.current) {
      audioSynth.startLobbyMusic();
      setMute(false);
      muteRef.current = false;
    } else {
      audioSynth.stopLobbyMusic();
      setMute(true);
      muteRef.current = true;
    }
  };

  const handlePlayerJoinRef = useRef(handlePlayerJoin);
  const handlePlayerAnswerRef = useRef(handlePlayerAnswer);
  const quizRef = useRef(quiz);

  useEffect(() => { handlePlayerJoinRef.current = handlePlayerJoin; });
  useEffect(() => { handlePlayerAnswerRef.current = handlePlayerAnswer; });
  useEffect(() => { quizRef.current = quiz; }, [quiz]);

  // Initialize GameSync - only on mount or pin change
  useEffect(() => {
    // 1. Start Lobby Sync (handles Firestore or local periodic broadcasts)
    const cleanupLobby = GameSync.startLobby(
      pin, 
      quizRef.current, 
      (newPlayers) => {
        // In cloud mode, players list comes directly from Firestore session document
        setPlayers(newPlayers);
        playersRef.current = newPlayers;
      },
      () => playersRef.current.map(p => ({ id: p.id, name: p.name }))
    );

    // 2. Listen for Joins (local mode only)
    const cleanupJoins = GameSync.listenForJoins(pin, (playerId, name) => {
      handlePlayerJoinRef.current(playerId, name);
    });

    // 3. Listen for Student Answers (both local and cloud mode)
    const cleanupAnswers = GameSync.listenForAnswers(pin, (playerId, optionIdx, speed) => {
      handlePlayerAnswerRef.current(playerId, optionIdx, speed);
    });

    return () => {
      cleanupLobby();
      cleanupJoins();
      cleanupAnswers();
      GameSync.stopLobby(pin);
      
      clearTimer();
      clearBotTimers();
      clearGetReadyInterval();
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, [pin]);

  // Handle lobby music separately
  useEffect(() => {
    if (phase === 'lobby' && !mute) {
      audioSynth.startLobbyMusic();
    } else {
      audioSynth.stopLobbyMusic();
    }
    return () => {
      audioSynth.stopLobbyMusic();
    };
  }, [phase, mute]);

  const launchQuestion = (qIdx) => {
    setPhase('question');
    phaseRef.current = 'question';
    setAnswers([]);
    answersRef.current = [];
    clearBotTimers();
    
    const q = quiz.questions[qIdx];
    setTimer(q.timeLimit);

    // Synchronize Student displays via GameSync
    GameSync.broadcastQuestion(pin, qIdx, quiz.questions.length, q, q.timeLimit);

    // Start countdown timer
    timerIntervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          setTimeout(() => {
            clearTimer();
            revealCorrectAnswers();
          }, 0);
          return 0;
        }
        if (prev <= 5 && !muteRef.current) {
          // Play urgent ticking
          audioSynth.playTimerBeep();
        }
        return prev - 1;
      });
    }, 1000);

    // Simulate AI Bot answers!
    playersRef.current.forEach(p => {
      if (p.isBot) {
        // Bots answer after a random delay
        const delay = 1000 + Math.random() * (q.timeLimit * 1000 * 0.75);
        const botTimer = setTimeout(() => {
          // Accuracy calculation: 75% correct
          const willAnswerCorrect = Math.random() < 0.75;
          let selectedOption;

          if (willAnswerCorrect) {
            // Pick one of the correct answers
            const cAns = q.correctAnswers;
            selectedOption = cAns[Math.floor(Math.random() * cAns.length)];
          } else {
            // Pick a wrong answer
            const wrongAns = q.options.map((_, i) => i).filter(i => !q.correctAnswers.includes(i));
            if (wrongAns.length > 0) {
              selectedOption = wrongAns[Math.floor(Math.random() * wrongAns.length)];
            } else {
              selectedOption = 0;
            }
          }

          // speed in milliseconds
          const speedVal = Math.round(delay);
          handlePlayerAnswer(p.id, selectedOption, speedVal);
        }, delay);

        botsIntervalsRef.current.push(botTimer);
      }
    });
  };

  const startGame = () => {
    if (playersRef.current.length === 0) {
      alert("Please wait for at least one student or add bots to join the game!");
      return;
    }
    audioSynth.playClick();
    audioSynth.stopLobbyMusic();
    clearGetReadyInterval();
    
    setPhase('get-ready');
    phaseRef.current = 'get-ready';
    setQuestionIndex(0);
    questionIdxRef.current = 0;
    setReadyCountdown(4);
    
    // Broadcast get-ready state to Firestore so student screens transition instantly
    GameSync.broadcastGetReady(pin, 0);
    
    getReadyIntervalRef.current = setInterval(() => {
      setReadyCountdown(prev => {
        if (prev <= 1) {
          setTimeout(() => {
            clearGetReadyInterval();
            launchQuestion(0);
          }, 0);
          return 4;
        }
        if (!muteRef.current) audioSynth.playTimerBeep();
        return prev - 1;
      });
    }, 1000);
  };

  const showLeaderboard = () => {
    audioSynth.playClick();
    setPhase('leaderboard');
    phaseRef.current = 'leaderboard';
  };

  const nextStep = () => {
    audioSynth.playClick();
    if (questionIdxRef.current + 1 < quiz.questions.length) {
      clearGetReadyInterval();

      const nextQIdx = questionIdxRef.current + 1;
      setQuestionIndex(nextQIdx);
      questionIdxRef.current = nextQIdx;
      setPhase('get-ready');
      phaseRef.current = 'get-ready';
      setReadyCountdown(4);

      // Broadcast get-ready state to Firestore so student screens transition instantly
      GameSync.broadcastGetReady(pin, nextQIdx);

      getReadyIntervalRef.current = setInterval(() => {
        setReadyCountdown(prev => {
          if (prev <= 1) {
            setTimeout(() => {
              clearGetReadyInterval();
              launchQuestion(nextQIdx);
            }, 0);
            return 4;
          }
          if (!muteRef.current) audioSynth.playTimerBeep();
          return prev - 1;
        });
      }, 1000);
    } else {
      // Show Grand Podium and throw confetti!
      setPhase('podium');
      phaseRef.current = 'podium';
      if (!muteRef.current) audioSynth.playPodium();
      triggerConfetti();

      // Broadcast game over to student screens via GameSync
      GameSync.broadcastGameOver(pin);
    }
  };

  const triggerConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const getOptionStats = () => {
    const stats = [0, 0, 0, 0];
    answers.forEach(ans => {
      if (ans.optionIdx >= 0 && ans.optionIdx < 4) {
        stats[ans.optionIdx]++;
      }
    });
    return stats;
  };

  return (
    <div className="anim-slide-up" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Host Top Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-secondary" onClick={onBack} style={{ padding: '0.6rem' }}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>Hosting Screen</span>
        </div>
        <button className="btn-secondary" onClick={toggleMute} style={{ padding: '0.6rem' }}>
          {mute ? <VolumeX size={18} /> : <Volume2 size={18} style={{ color: 'var(--accent-purple)' }} />}
        </button>
      </div>

      {/* PHASE 1: LOBBY */}
      {phase === 'lobby' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flexGrow: 1, justifyContent: 'center' }}>
          
          {/* Main PIN Panel */}
          <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(138,43,226,0.12) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid hsla(265, 85%, 65%, 0.2)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', letterSpacing: '0.05em', fontWeight: 700 }}>STUDENTS: JOIN AT ANOTHER TAB WITH PIN</p>
            <h1 style={{ fontSize: '5rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'white', letterSpacing: '0.1em', margin: '0.5rem 0 1rem 0', textShadow: '0 0 40px hsla(265, 85%, 65%, 0.6)' }}>
              {pin}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 500 }}>
              Game: <strong style={{ color: 'white' }}>{quiz.title}</strong>
            </p>
          </div>

          {/* Lobby Controls and Player List */}
          <div className="glass-panel" style={{ padding: '2rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={20} style={{ color: 'var(--accent-purple)' }} />
                <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>Waiting for Players ({players.length})</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" onClick={addBots} style={{ fontSize: '0.9rem', gap: '0.4rem', borderStyle: 'dashed' }}>
                  <UserPlus size={16} /> Add AI Bots
                </button>
                <button className="btn-primary" onClick={startGame} style={{ gap: '0.5rem' }}>
                  <Play size={18} fill="currentColor" /> Start Game
                </button>
              </div>
            </div>

            {/* Players Grid list */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
              {players.map(p => (
                <div 
                  key={p.id} 
                  className="anim-pop-in"
                  style={{ 
                    padding: '0.85rem 1rem', 
                    background: p.isBot ? 'rgba(138,43,226,0.1)' : 'rgba(255, 255, 255, 0.05)', 
                    border: p.isBot ? '1px solid hsla(265, 85%, 65%, 0.25)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)', 
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '1rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: p.isBot ? 'var(--accent-purple)' : 'white'
                  }}
                >
                  {p.name}
                </div>
              ))}

              {players.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '1.1rem', fontStyle: 'italic' }}>Open another browser window or tab and join the game to play!</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Or click "Add AI Bots" above to start testing instantly.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: GET READY */}
      {phase === 'get-ready' && (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
          <div className="anim-pop-in" style={{ fontSize: '4rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--accent-purple)', textShadow: '0 0 30px var(--accent-purple-glow)' }}>
            Get Ready!
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '500px' }}>
            Question {questionIdx + 1}: <strong style={{ color: 'white' }}>{currentQuestion.text}</strong>
          </div>
          <div style={{ 
            fontSize: '5rem', 
            fontWeight: 900, 
            fontFamily: 'var(--font-heading)', 
            width: '130px', 
            height: '130px', 
            borderRadius: '50%', 
            border: '4px dashed rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.02)',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
            color: 'white'
          }}>
            {readyCountdown > 1 ? readyCountdown - 1 : '🚀'}
          </div>
        </div>
      )}

      {/* PHASE 3: ACTIVE QUESTION DISPLAY */}
      {phase === 'question' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', flexGrow: 1, justifyContent: 'space-between' }}>
          
          {/* Question Text and Timer/Answering Stats */}
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="glass-panel" style={{ flexGrow: 1, flexBasis: '400px', padding: '2rem', minHeight: '120px', display: 'flex', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, textAlign: 'center', width: '100%', lineHeight: '1.4' }}>
                {currentQuestion.text}
              </h2>
            </div>

            {/* Donut Countdown Timer */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '130px', flexShrink: 0 }}>
              <div className="timer-donut">
                <svg className="timer-svg">
                  <circle className="timer-circle-bg" cx="45" cy="45" r="38"></circle>
                  <circle 
                    className={`timer-circle-fill ${timer <= 5 ? 'urgent' : ''}`} 
                    cx="45" 
                    cy="45" 
                    r="38"
                    strokeDasharray={2 * Math.PI * 38}
                    strokeDashoffset={2 * Math.PI * 38 * (1 - timer / currentQuestion.timeLimit)}
                  ></circle>
                </svg>
                <div className="timer-text" style={{ color: timer <= 5 ? 'var(--kahoot-red)' : 'white' }}>{timer}</div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SECONDS</span>
            </div>

            {/* Answered Tally */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '130px', flexShrink: 0 }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--accent-purple)' }}>
                {answers.length}
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'center' }}>ANSWERS</span>
            </div>
          </div>

          {/* Answer Options Grid (without correct checks) */}
          <div className="kahoot-answers-grid">
            {currentQuestion.options.map((option, idx) => {
              if (!option.trim()) return null;
              const colorKeys = ['red', 'blue', 'yellow', 'green'];
              const shapes = [
                <div className="shape-triangle" />,
                <div className="shape-diamond" />,
                <div className="shape-circle" />,
                <div className="shape-square" />
              ];
              return (
                <div key={idx} className={`kahoot-card ${colorKeys[idx]}`}>
                  <span className="shape-icon">{shapes[idx]}</span>
                  <span>{option}</span>
                </div>
              );
            })}
          </div>

          {/* Quick Manual Skip trigger */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button className="btn-secondary" onClick={revealCorrectAnswers} style={{ gap: '0.5rem' }}>
              Skip Countdown <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 4: QUESTION ANSWER REVEALED */}
      {phase === 'reveal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flexGrow: 1, justifyContent: 'space-between' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Question Results</h3>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{currentQuestion.text}</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Left side: Answer Distributions Chart */}
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem' }}>REPLIES BY CHOICE</h4>
              <div className="bar-chart-container">
                {getOptionStats().map((count, idx) => {
                  if (!currentQuestion.options[idx]?.trim()) return null;
                  const colors = ['red', 'blue', 'yellow', 'green'];
                  const total = answers.length || 1;
                  const heightPct = Math.max(10, (count / total) * 100);
                  const isCorrect = currentQuestion.correctAnswers.includes(idx);
                  
                  return (
                    <div key={idx} className="chart-column">
                      <div className={`chart-bar ${colors[idx]}`} style={{ height: `${heightPct}%` }}>
                        {count}
                      </div>
                      <div style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '4px',
                        background: isCorrect ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                        border: isCorrect ? '1px solid var(--kahoot-green)' : 'none',
                        color: isCorrect ? 'var(--kahoot-green)' : 'var(--text-muted)',
                        fontWeight: 800,
                        fontSize: '0.8rem'
                      }}>
                        {isCorrect ? '✓' : '✗'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right side: Real-time correct answer display */}
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>CORRECT ANSWER</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {currentQuestion.options.map((option, idx) => {
                  const isCorrect = currentQuestion.correctAnswers.includes(idx);
                  if (!isCorrect) return null;
                  
                  const colors = ['red', 'blue', 'yellow', 'green'];
                  return (
                    <div key={idx} className={`kahoot-card ${colors[idx]}`} style={{ width: '100%' }}>
                      <span className="shape-icon">✓</span>
                      <span>{option}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button className="btn-primary" onClick={showLeaderboard} style={{ gap: '0.5rem' }}>
              Show Leaderboard <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 5: LEADERBOARD */}
      {phase === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flexGrow: 1, justifyContent: 'center' }}>
          
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(138,43,226,0.1) 0%, rgba(0,0,0,0.3) 100%)' }}>
            <Award size={36} style={{ color: 'var(--kahoot-yellow)', marginBottom: '0.5rem' }} />
            <h2 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-heading)' }}>Leaderboard</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Question {questionIdx + 1} of {quiz.questions.length}</p>
          </div>

          {/* Leaderboard Table rows */}
          <div className="glass-panel" style={{ padding: '2rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="leaderboard-list">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .slice(0, 5) // top 5
                .map((p, rankIdx) => {
                  const isStreak = p.streak >= 3;
                  return (
                    <div 
                      key={p.id} 
                      className={`leaderboard-row ${rankIdx === 0 ? 'highlight' : ''}`}
                    >
                      <span className="leaderboard-rank">#{rankIdx + 1}</span>
                      <span className="leaderboard-name" style={{ color: rankIdx === 0 ? 'var(--kahoot-yellow)' : 'white' }}>
                        {p.name}
                        {p.isBot && <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '0.5rem' }}>(Bot)</span>}
                        {p.lastAnswerCorrect && rankIdx === 0 && <span style={{ marginLeft: '0.5rem' }}>🔥</span>}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="leaderboard-score">{p.score} pts</span>
                        {isStreak && (
                          <span className="leaderboard-streak" title={`Streak of ${p.streak}!`}>
                            ⚡ {p.streak}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Leaderboard next trigger */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button className="btn-primary" onClick={nextStep} style={{ gap: '0.5rem' }}>
              {questionIdx + 1 < quiz.questions.length ? 'Next Question' : 'Finish Game'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 6: GRAND FINAL PODIUM */}
      {phase === 'podium' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flexGrow: 1, justifyContent: 'center' }}>
          
          <div style={{ textAlign: 'center' }}>
            <Trophy size={48} style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem', filter: 'drop-shadow(0 0 10px hsla(43, 100%, 55%, 0.4))' }} />
            <h1 style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', background: 'linear-gradient(180deg, #fff, var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Final Podium
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Outstanding job players! Congratulations to the winners!</p>
          </div>

          {/* 3D-Look rising podium */}
          {(() => {
            const sorted = [...players].sort((a, b) => b.score - a.score);
            const p1 = sorted[0];
            const p2 = sorted[1];
            const p3 = sorted[2];

            return (
              <div className="podium-container">
                {/* 2nd place (left) */}
                <div className="podium-step second">
                  {p2 ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="podium-player-name">{p2.name}</div>
                      <div className="podium-score">{p2.score} pts</div>
                    </div>
                  ) : <div style={{ minHeight: '30px' }} />}
                  <div className="podium-pedestal">2</div>
                </div>

                {/* 1st place (center) */}
                <div className="podium-step first">
                  {p1 ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span className="podium-crown">👑</span>
                      <div className="podium-player-name" style={{ color: 'var(--accent-gold)' }}>{p1.name}</div>
                      <div className="podium-score" style={{ color: 'var(--text-primary)' }}>{p1.score} pts</div>
                    </div>
                  ) : <div style={{ minHeight: '50px' }} />}
                  <div className="podium-pedestal">1</div>
                </div>

                {/* 3rd place (right) */}
                <div className="podium-step third">
                  {p3 ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="podium-player-name">{p3.name}</div>
                      <div className="podium-score">{p3.score} pts</div>
                    </div>
                  ) : <div style={{ minHeight: '30px' }} />}
                  <div className="podium-pedestal">3</div>
                </div>
              </div>
            );
          })()}

          {/* Controls back */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', flexShrink: 0 }}>
            <button className="btn-primary" onClick={onBack} style={{ width: '200px' }}>
              Back to Home
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
