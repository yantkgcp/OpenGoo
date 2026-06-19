import { useState } from 'react';
import { db, audioSynth } from '@opengoo/core';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Clock, 
  Award, 
  Check,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export default function QuizCreator({ quizzes = [], setQuizzes, onBack, onHost }) {
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [validationError, setValidationError] = useState('');

  // Save the full quiz to db
  const handleSaveQuiz = () => {
    audioSynth.playClick();
    if (!editingQuiz.title.trim()) {
      setValidationError('Quiz Title cannot be empty!');
      return;
    }

    if (editingQuiz.questions.length === 0) {
      setValidationError('Please add at least one question to the quiz!');
      return;
    }

    // Question validation
    for (let i = 0; i < editingQuiz.questions.length; i++) {
      const q = editingQuiz.questions[i];
      if (!q.text.trim()) {
        setActiveQuestionIdx(i);
        setValidationError(`Question ${i + 1} text is empty!`);
        return;
      }
      
      const filledOptions = q.options.filter(opt => opt.trim());
      if (filledOptions.length < 2) {
        setActiveQuestionIdx(i);
        setValidationError(`Question ${i + 1} must have at least 2 filled choices!`);
        return;
      }

      if (q.correctAnswers.length === 0) {
        setActiveQuestionIdx(i);
        setValidationError(`Please check at least one correct answer for Question ${i + 1}!`);
        return;
      }
    }

    // Save
    db.saveQuiz(editingQuiz);
    if (setQuizzes) {
      setQuizzes(db.getQuizzes());
    }
    setEditingQuiz(null);
    setValidationError('');
  };

  // Start creating a new quiz
  const handleCreateNewQuiz = () => {
    audioSynth.playClick();
    const newQuiz = {
      id: 'quiz_' + Math.random().toString(36).substr(2, 9),
      title: 'New Fun Trivia Quiz',
      description: 'Test your friends with this awesome trivia!',
      questions: [
        {
          id: 'q_' + Math.random().toString(36).substr(2, 9),
          text: 'What is the capital of the planet Earth?',
          options: ['Paris', 'Tokyo', 'None (No single capital)', 'New York'],
          correctAnswers: [2],
          timeLimit: 20,
          pointsMultiplier: 1
        }
      ]
    };
    setEditingQuiz(newQuiz);
    setActiveQuestionIdx(0);
    setValidationError('');
  };

  // Delete a quiz
  const handleDeleteQuiz = (id, e) => {
    e.stopPropagation();
    audioSynth.playIncorrect();
    if (window.confirm('Are you sure you want to delete this quiz?')) {
      db.deleteQuiz(id);
      if (setQuizzes) {
        setQuizzes(db.getQuizzes());
      }
    }
  };

  // Add a new question to the editing quiz
  const handleAddQuestion = () => {
    audioSynth.playClick();
    const newQ = {
      id: 'q_' + Math.random().toString(36).substr(2, 9),
      text: '',
      options: ['', '', '', ''],
      correctAnswers: [],
      timeLimit: 20,
      pointsMultiplier: 1
    };
    const updatedQs = [...editingQuiz.questions, newQ];
    setEditingQuiz({ ...editingQuiz, questions: updatedQs });
    setActiveQuestionIdx(updatedQs.length - 1);
  };

  // Delete a question from the editing quiz
  const handleDeleteQuestion = (idx, e) => {
    e.stopPropagation();
    audioSynth.playClick();
    if (editingQuiz.questions.length <= 1) {
      alert('A quiz must have at least one question!');
      return;
    }
    const updatedQs = editingQuiz.questions.filter((_, i) => i !== idx);
    setEditingQuiz({ ...editingQuiz, questions: updatedQs });
    setActiveQuestionIdx(Math.max(0, idx - 1));
  };

  // Update specific question field
  const handleUpdateQuestionField = (field, value) => {
    const updatedQs = editingQuiz.questions.map((q, idx) => {
      if (idx !== activeQuestionIdx) return q;
      return { ...q, [field]: value };
    });
    setEditingQuiz({ ...editingQuiz, questions: updatedQs });
  };

  // Toggle correct answer index
  const handleToggleCorrectAnswer = (optIdx) => {
    audioSynth.playClick();
    const q = editingQuiz.questions[activeQuestionIdx];
    let updatedCorrects;
    if (q.correctAnswers.includes(optIdx)) {
      updatedCorrects = q.correctAnswers.filter(idx => idx !== optIdx);
    } else {
      updatedCorrects = [...q.correctAnswers, optIdx];
    }
    handleUpdateQuestionField('correctAnswers', updatedCorrects);
  };

  // Update choice text
  const handleUpdateChoiceText = (optIdx, text) => {
    const q = editingQuiz.questions[activeQuestionIdx];
    const updatedOptions = q.options.map((opt, idx) => idx === optIdx ? text : opt);
    handleUpdateQuestionField('options', updatedOptions);
  };

  if (editingQuiz) {
    const currentQ = editingQuiz.questions[activeQuestionIdx];

    return (
      <div className="anim-slide-up" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
        {/* Editor Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn-secondary" onClick={() => { audioSynth.playClick(); setEditingQuiz(null); }} style={{ padding: '0.6rem' }}>
              <ArrowLeft size={18} />
            </button>
            <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)' }}>Quiz Creator</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-secondary" onClick={() => { audioSynth.playClick(); setEditingQuiz(null); }}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSaveQuiz}>
              <Save size={18} /> Save Quiz
            </button>
          </div>
        </div>

        {/* Validation Alert */}
        {validationError && (
          <div className="glass-panel" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--kahoot-red)' }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight: 600 }}>{validationError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Panel: Sidebar of questions */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto' }}>
            {/* Quiz Info Settings */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>QUIZ TITLE</label>
              <input 
                type="text" 
                className="form-input" 
                value={editingQuiz.title} 
                onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })} 
                placeholder="e.g. Science Fun Class"
                style={{ fontWeight: 700 }}
              />
              <textarea 
                className="form-input" 
                value={editingQuiz.description || ''} 
                onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })} 
                placeholder="Describe your quiz..."
                style={{ fontSize: '0.85rem', marginTop: '0.5rem', resize: 'vertical', minHeight: '60px' }}
              />
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Questions ({editingQuiz.questions.length})</span>
                <button className="btn-primary" onClick={handleAddQuestion} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                  <Plus size={14} /> Add
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {editingQuiz.questions.map((q, idx) => (
                  <div 
                    key={q.id}
                    onClick={() => { audioSynth.playClick(); setActiveQuestionIdx(idx); }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: idx === activeQuestionIdx ? 'rgba(138, 43, 226, 0.15)' : 'rgba(255,255,255,0.02)',
                      border: idx === activeQuestionIdx ? '1px solid var(--accent-purple)' : '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem', fontSize: '0.85rem' }}>
                      <strong style={{ color: idx === activeQuestionIdx ? 'var(--accent-purple)' : 'var(--text-secondary)' }}>{idx + 1}.</strong> {q.text || <em style={{ color: 'var(--text-muted)' }}>Empty question...</em>}
                    </div>
                    <button 
                      onClick={(e) => handleDeleteQuestion(idx, e)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--kahoot-red)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Active Question Editor */}
          {currentQ && (
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  QUESTION {activeQuestionIdx + 1}
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={currentQ.text} 
                  onChange={(e) => handleUpdateQuestionField('text', e.target.value)} 
                  placeholder="Start typing your question here..."
                  style={{ fontSize: '1.2rem', padding: '1rem', fontWeight: 600, textAlign: 'center' }}
                />
              </div>

              {/* Question Settings (Time and points) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Clock size={18} style={{ color: 'var(--accent-purple)' }} />
                  <div style={{ flexGrow: 1 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>Time Limit</label>
                    <select 
                      value={currentQ.timeLimit} 
                      onChange={(e) => handleUpdateQuestionField('timeLimit', parseInt(e.target.value))}
                      style={{ background: 'none', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', outline: 'none', width: '100%' }}
                    >
                      <option value="5" style={{ background: 'var(--bg-dark)' }}>5 seconds</option>
                      <option value="10" style={{ background: 'var(--bg-dark)' }}>10 seconds</option>
                      <option value="15" style={{ background: 'var(--bg-dark)' }}>15 seconds</option>
                      <option value="20" style={{ background: 'var(--bg-dark)' }}>20 seconds</option>
                      <option value="30" style={{ background: 'var(--bg-dark)' }}>30 seconds</option>
                      <option value="60" style={{ background: 'var(--bg-dark)' }}>60 seconds</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Award size={18} style={{ color: 'var(--kahoot-yellow)' }} />
                  <div style={{ flexGrow: 1 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>Points Multiplier</label>
                    <select 
                      value={currentQ.pointsMultiplier} 
                      onChange={(e) => handleUpdateQuestionField('pointsMultiplier', parseInt(e.target.value))}
                      style={{ background: 'none', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', outline: 'none', width: '100%' }}
                    >
                      <option value="1" style={{ background: 'var(--bg-dark)' }}>Single Points (1x)</option>
                      <option value="2" style={{ background: 'var(--bg-dark)' }}>Double Points (2x)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Answers Input Area */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>
                  ANSWER CHOICES (Select circle to mark as correct answer — supports multi-correct!)
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { color: 'var(--kahoot-red)', shape: <div className="shape-triangle" style={{ borderBottomWidth: '22px', borderLeftWidth: '13px', borderRightWidth: '13px' }} />, label: 'Choice A (Red)' },
                    { color: 'var(--kahoot-blue)', shape: <div className="shape-diamond" style={{ width: '18px', height: '18px' }} />, label: 'Choice B (Blue)' },
                    { color: 'var(--kahoot-yellow)', shape: <div className="shape-circle" style={{ width: '20px', height: '20px' }} />, label: 'Choice C (Yellow)' },
                    { color: 'var(--kahoot-green)', shape: <div className="shape-square" style={{ width: '18px', height: '18px' }} />, label: 'Choice D (Green)' }
                  ].map((spec, optIdx) => {
                    const isCorrect = currentQ.correctAnswers.includes(optIdx);
                    return (
                      <div 
                        key={optIdx} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '1rem',
                          background: 'rgba(0,0,0,0.2)',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: isCorrect ? `1px solid ${spec.color}` : '1px solid rgba(255,255,255,0.05)',
                          transition: 'border-color 0.2s ease'
                        }}
                      >
                        {/* Correct Checkbox Trigger */}
                        <div 
                          onClick={() => handleToggleCorrectAnswer(optIdx)}
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            border: `2px solid ${isCorrect ? spec.color : 'rgba(255,255,255,0.2)'}`,
                            background: isCorrect ? spec.color : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isCorrect ? 'white' : 'transparent',
                            transition: 'all 0.15s ease',
                            flexShrink: 0
                          }}
                        >
                          <Check size={16} strokeWidth={3} />
                        </div>

                        {/* Shape icon */}
                        <div style={{ color: spec.color, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', flexShrink: 0 }}>
                          {spec.shape}
                        </div>

                        {/* Text Input */}
                        <input 
                          type="text" 
                          className="form-input" 
                          value={currentQ.options[optIdx] || ''} 
                          onChange={(e) => handleUpdateChoiceText(optIdx, e.target.value)} 
                          placeholder={`Enter ${spec.label}...`}
                          style={{ 
                            border: 'none', 
                            background: 'none', 
                            padding: '0.2rem 0',
                            fontSize: '1rem',
                            fontWeight: 600,
                            borderBottom: '1px solid rgba(255,255,255,0.1)'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-slide-up" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-secondary" onClick={onBack} style={{ padding: '0.6rem' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', background: 'linear-gradient(90deg, #fff, var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>My Saved Quizzes</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Create, host, and manage multiple choice games for your students.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={handleCreateNewQuiz}>
          <Plus size={18} /> New Quiz
        </button>
      </div>

      {/* Quizzes List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {quizzes.map((quiz) => (
          <div 
            key={quiz.id} 
            className="glass-panel glass-panel-hover" 
            style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
            onClick={() => { audioSynth.playClick(); setEditingQuiz(quiz); }}
          >
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)', color: 'white' }}>{quiz.title}</h3>
                <span style={{ background: 'rgba(138,43,226,0.15)', color: 'var(--accent-purple)', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '10px', fontWeight: 700 }}>
                  {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}>
                {quiz.description}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              {onHost && (
                <button 
                  className="btn-primary" 
                  onClick={(e) => { e.stopPropagation(); audioSynth.playClick(); onHost(quiz.id); }}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', boxShadow: 'none' }}
                >
                  Host
                </button>
              )}
              <button 
                className="btn-secondary" 
                onClick={(e) => { e.stopPropagation(); audioSynth.playClick(); setEditingQuiz(quiz); }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Edit
              </button>
              <button 
                className="btn-secondary" 
                onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                style={{ padding: '0.5rem', color: 'var(--kahoot-red)', borderColor: 'rgba(239, 68, 68, 0.15)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {quizzes.length === 0 && (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <HelpCircle size={48} style={{ color: 'var(--text-muted)' }} />
            <div>
              <h3 style={{ fontSize: '1.2rem', color: 'white' }}>No quizzes yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Get started by creating your very first trivia game!</p>
            </div>
            <button className="btn-primary" onClick={handleCreateNewQuiz} style={{ marginTop: '0.5rem' }}>
              Create Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
