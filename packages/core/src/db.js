import { isFirebaseConfigured, dbFirestore } from './firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

const QUIZZES_KEY = 'kahoot_quizzes_v1';

export const defaultQuizzes = [
  {
    id: 'web-dev-trivia',
    title: '🌐 Web Development Trivia',
    description: 'Test your knowledge on modern CSS, JS, browser APIs, and core web performance metrics!',
    created: '2026-05-20T12:00:00Z',
    creator: 'system',
    isSystemDefault: true,
    questions: [
      {
        id: 'q1',
        text: 'Which CSS pseudo-class acts as a powerful relational "parent" selector, matching elements based on their descendants?',
        options: [
          ':parent',
          ':has()',
          ':contains()',
          ':is-ancestor'
        ],
        correctAnswers: [1], // :has() (0-indexed)
        timeLimit: 20, // seconds
        pointsMultiplier: 1 // Single points
      },
      {
        id: 'q2',
        text: 'Which browser API enables real-time, low-overhead communication between tabs/windows on the same origin without a server?',
        options: [
          'WebSockets',
          'Service Workers',
          'localStorage Events',
          'BroadcastChannel API'
        ],
        correctAnswers: [3], // BroadcastChannel API
        timeLimit: 20,
        pointsMultiplier: 2 // Double points!
      },
      {
        id: 'q3',
        text: 'What does LCP stand for in Google\'s Core Web Vitals, measuring primary loading speed?',
        options: [
          'Largest Contentful Paint',
          'Layout Consistency Parameter',
          'Load Content Priority',
          'Latency Control Protocol'
        ],
        correctAnswers: [0], // Largest Contentful Paint
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'q4',
        text: 'Which of the following is NOT a primitive data type in modern JavaScript?',
        options: [
          'Symbol',
          'BigInt',
          'Null',
          'Array'
        ],
        correctAnswers: [3], // Array is an Object
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'q5',
        text: 'What is the correct syntax to animate discrete properties (like display: none -> block) in modern CSS?',
        options: [
          'transition: display 0.3s allow-discrete;',
          'transition: display 0.3s force-render;',
          'animate-discrete: display 0.3s;',
          'display: transition(0.3s);'
        ],
        correctAnswers: [0], // transition: display 0.3s allow-discrete;
        timeLimit: 20,
        pointsMultiplier: 2 // Double points!
      }
    ]
  },
  {
    id: 'space-science',
    title: '🚀 Space & Science Explorer',
    description: 'An exciting journey through physics, chemistry, and astronomical wonders of the cosmos!',
    created: '2026-05-20T12:05:00Z',
    creator: 'system',
    isSystemDefault: true,
    questions: [
      {
        id: 's1',
        text: 'Approximately how long does it take for light from the Sun to travel the distance to Earth?',
        options: [
          '8 seconds',
          '8 minutes',
          '8 hours',
          '8 days'
        ],
        correctAnswers: [1], // 8 minutes
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 's2',
        text: 'What chemical element has the chemical symbol "Au" on the periodic table?',
        options: [
          'Silver',
          'Iron',
          'Gold',
          'Copper'
        ],
        correctAnswers: [2], // Gold
        timeLimit: 10,
        pointsMultiplier: 1
      },
      {
        id: 's3',
        text: 'Which of these astronomical bodies is classified as a gas giant, famous for its magnificent ring system?',
        options: [
          'Mars',
          'Saturn',
          'Neptune',
          'Mercury'
        ],
        correctAnswers: [1], // Saturn
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 's4',
        text: 'What is the term for the boundary surrounding a black hole from which nothing, not even light, can escape?',
        options: [
          'Event Horizon',
          'Singularity Threshold',
          'Schwarzschild Shell',
          'Accretion Ring'
        ],
        correctAnswers: [0], // Event Horizon
        timeLimit: 20,
        pointsMultiplier: 2 // Double points!
      }
    ]
  },
  {
    id: 'kids-stem-explorers',
    title: '🔬 Kids\' STEM Explorers! (Ages 7-10)',
    description: 'An exciting science, tech, engineering, and math adventure! Perfect for young innovators and curious minds.',
    created: '2026-06-19T12:00:00Z',
    creator: 'system',
    isSystemDefault: true,
    questions: [
      {
        id: 'stem1',
        text: 'Which planet in our solar system is known to support living things and has liquid water oceans?',
        options: [
          'Mars',
          'Venus',
          'Earth',
          'Jupiter'
        ],
        correctAnswers: [2],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'stem2',
        text: 'How many wheels does a tricycle have?',
        options: [
          'Two (2)',
          'Three (3)',
          'Four (4)',
          'Six (6)'
        ],
        correctAnswers: [1],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'stem3',
        text: 'When water gets extremely cold and freezes, it turns into what solid state?',
        options: [
          'Steam',
          'Ice',
          'Rain',
          'Lava'
        ],
        correctAnswers: [1],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'stem4',
        text: 'What does a computer use to process information, often called the "brain" of the computer?',
        options: [
          'The Mouse',
          'The Monitor',
          'The CPU (Processor)',
          'The Keyboard'
        ],
        correctAnswers: [2],
        timeLimit: 20,
        pointsMultiplier: 2
      },
      {
        id: 'stem5',
        text: 'If you have 3 apples and find 5 more, how many apples do you have in total?',
        options: [
          '6 apples',
          '7 apples',
          '8 apples',
          '9 apples'
        ],
        correctAnswers: [2],
        timeLimit: 15,
        pointsMultiplier: 1
      }
    ]
  },
  {
    id: 'grade3-4-math-champions',
    title: '🧮 Grade 3-4 Math Champions!',
    description: 'A 20-question challenge with addition, subtraction, multiplication, division, and brackets! Perfect for quick thinkers!',
    created: '2026-06-19T13:00:00Z',
    creator: 'system',
    isSystemDefault: true,
    questions: [
      {
        id: 'math1',
        text: 'What is (3 + 5) * 2?',
        options: ['10', '13', '16', '11'],
        correctAnswers: [2],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math2',
        text: 'What is 20 - (4 * 3)?',
        options: ['48', '8', '16', '12'],
        correctAnswers: [1],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math3',
        text: 'What is (15 - 5) / 5?',
        options: ['2', '14', '1', '3'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math4',
        text: 'What is 6 * (8 - 3)?',
        options: ['45', '30', '24', '14'],
        correctAnswers: [1],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math5',
        text: 'What is (12 + 8) / (2 * 2)?',
        options: ['10', '5', '4', '8'],
        correctAnswers: [1],
        timeLimit: 20,
        pointsMultiplier: 1
      },
      {
        id: 'math6',
        text: 'What is 40 / (10 - 5)?',
        options: ['8', '4', '15', '6'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math7',
        text: 'What is (25 + 5) - (3 * 4)?',
        options: ['18', '20', '15', '22'],
        correctAnswers: [0],
        timeLimit: 20,
        pointsMultiplier: 1
      },
      {
        id: 'math8',
        text: 'What is (9 * 3) + 7?',
        options: ['34', '30', '20', '36'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math9',
        text: 'What is 32 / (2 * 4)?',
        options: ['16', '4', '8', '2'],
        correctAnswers: [1],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math10',
        text: 'What is (18 - 6) * (10 / 5)?',
        options: ['24', '12', '18', '6'],
        correctAnswers: [0],
        timeLimit: 20,
        pointsMultiplier: 2
      },
      {
        id: 'math11',
        text: 'What is (5 * 5) - (15 / 3)?',
        options: ['20', '15', '25', '10'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math12',
        text: 'What is (45 / 5) * 2?',
        options: ['18', '14', '20', '10'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math13',
        text: 'What is 14 + (21 / 7)?',
        options: ['17', '5', '21', '19'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math14',
        text: 'What is (30 - 10) * 3?',
        options: ['60', '40', '50', '90'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math15',
        text: 'What is (8 + 8) / 4?',
        options: ['4', '2', '8', '10'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math16',
        text: 'What is (12 - 4) * (2 + 3)?',
        options: ['40', '20', '35', '15'],
        correctAnswers: [0],
        timeLimit: 20,
        pointsMultiplier: 1
      },
      {
        id: 'math17',
        text: 'What is 50 - (6 * 6)?',
        options: ['14', '20', '44', '16'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math18',
        text: 'What is (7 + 3) * (9 - 4)?',
        options: ['50', '45', '100', '25'],
        correctAnswers: [0],
        timeLimit: 15,
        pointsMultiplier: 1
      },
      {
        id: 'math19',
        text: 'What is (36 / 6) + (24 / 4)?',
        options: ['12', '10', '8', '16'],
        correctAnswers: [0],
        timeLimit: 20,
        pointsMultiplier: 1
      },
      {
        id: 'math20',
        text: 'What is (10 * 10) - (80 / 2)?',
        options: ['60', '50', '80', '20'],
        correctAnswers: [0],
        timeLimit: 20,
        pointsMultiplier: 2
      }
    ]
  }
];

export const db = {
  // Load all quizzes, seeding default ones if empty
  getQuizzes: () => {
    try {
      const stored = localStorage.getItem(QUIZZES_KEY);
      if (!stored) {
        db.saveQuizzes(defaultQuizzes);
        return defaultQuizzes;
      }
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load quizzes, using defaults:", e);
      return defaultQuizzes;
    }
  },

  // Save full quiz array
  saveQuizzes: (quizzes) => {
    try {
      localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
      return true;
    } catch (e) {
      console.error("Failed to save quizzes to localStorage:", e);
      return false;
    }
  },

  // Get a single quiz by ID
  getQuizById: (id) => {
    const quizzes = db.getQuizzes();
    return quizzes.find(q => q.id === id) || null;
  },

  // Save or update a single quiz
  saveQuiz: (quiz) => {
    const quizzes = db.getQuizzes();
    let savedQuiz = { ...quiz };
    
    if (!savedQuiz.id) {
      savedQuiz.id = 'quiz_' + Math.random().toString(36).substr(2, 9);
    }
    
    const idx = quizzes.findIndex(q => q.id === savedQuiz.id);
    
    if (idx >= 0) {
      savedQuiz.updated = new Date().toISOString();
      quizzes[idx] = savedQuiz;
    } else {
      savedQuiz.created = new Date().toISOString();
      quizzes.push(savedQuiz);
    }
    
    const success = db.saveQuizzes(quizzes);
    
    // Cloud sync in the background
    if (isFirebaseConfigured && dbFirestore) {
      const docRef = doc(dbFirestore, 'quizzes', savedQuiz.id);
      // Clean undefined fields for Firestore compatibility
      const cleanQuiz = JSON.parse(JSON.stringify(savedQuiz));
      setDoc(docRef, cleanQuiz).catch(err => {
        console.error("Firestore sync error during saveQuiz:", err);
      });
    }
    
    return success;
  },

  // Delete a quiz
  deleteQuiz: (id) => {
    const quizzes = db.getQuizzes();
    const filtered = quizzes.filter(q => q.id !== id);
    const success = db.saveQuizzes(filtered);
    
    // Cloud sync in the background
    if (isFirebaseConfigured && dbFirestore) {
      const docRef = doc(dbFirestore, 'quizzes', id);
      deleteDoc(docRef).catch(err => {
        console.error("Firestore sync error during deleteQuiz:", err);
      });
    }
    
    return success;
  }
};
