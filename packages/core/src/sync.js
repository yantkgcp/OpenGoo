import { isFirebaseConfigured, dbFirestore } from './firebase';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';

// -------------------------------------------------------------
// BROADCASTCHANNEL (LOCAL FALLBACK) UTILS
// -------------------------------------------------------------
const channels = {};

const getChannel = (pin) => {
  if (!channels[pin]) {
    channels[pin] = new BroadcastChannel(`opengoo_game_${pin}`);
  }
  return channels[pin];
};

const closeChannel = (pin) => {
  if (channels[pin]) {
    channels[pin].close();
    delete channels[pin];
  }
};

// Helper to batch-delete subcollection documents in Firestore
const deleteCollection = async (db, collectionRef) => {
  const snapshot = await getDocs(collectionRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

// -------------------------------------------------------------
// UNIFIED GAMESYNC API
// -------------------------------------------------------------
export const GameSync = {
  isCloudMode: () => isFirebaseConfigured,

  // Start Live Lobby (Host side)
  startLobby: (pin, quiz, onPlayersChange, getPlayers) => {
    if (isFirebaseConfigured) {
      const sessionRef = doc(dbFirestore, 'sessions', pin);
      
      // Initialize the live game session document
      setDoc(sessionRef, {
        pin,
        quizId: quiz.id,
        title: quiz.title,
        phase: 'lobby',
        players: [],
        created: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error("Firestore error in startLobby:", err);
        alert("Warning: Failed to initialize live game lobby on Firestore. " + 
              "Please check Firestore Security Rules or Firebase Project Config.\n\nError: " + err.message);
      });

      // Listen for player updates in the session doc
      const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.players) {
            onPlayersChange(data.players);
          }
        }
      }, (err) => {
        console.error("Firestore onSnapshot error in startLobby:", err);
        alert("Warning: Firestore sync disconnected. Check database permissions and active connection.\n\nError: " + err.message);
      });

      return () => {
        unsubscribe();
      };
    } else {
      // Local fallback: Periodic lobby state announcement
      const channel = getChannel(pin);
      const broadcastLobby = setInterval(() => {
        channel.postMessage({
          type: 'LOBBY_STATE',
          pin,
          title: quiz.title,
          players: getPlayers ? getPlayers() : []
        });
      }, 1000);

      return () => {
        clearInterval(broadcastLobby);
      };
    }
  },

  // Update players list (e.g. when adding bots or removing players)
  updateLobbyPlayers: async (pin, players) => {
    if (isFirebaseConfigured) {
      const sessionRef = doc(dbFirestore, 'sessions', pin);
      try {
        await setDoc(sessionRef, { players }, { merge: true });
      } catch (e) {
        console.error("Failed to update players in lobby:", e);
      }
    }
  },

  // Listen for joins (Host side, local mode only - in Firestore mode joins write to session doc)
  listenForJoins: (pin, onPlayerJoin) => {
    if (isFirebaseConfigured) {
      // Firestore mode handles joins via player adding themselves to player array
      return () => {};
    } else {
      const channel = getChannel(pin);
      const listener = (event) => {
        const msg = event.data;
        if (msg.type === 'JOIN_GAME') {
          onPlayerJoin(msg.playerId, msg.name);
        }
      };
      channel.addEventListener('message', listener);
      return () => {
        channel.removeEventListener('message', listener);
      };
    }
  },

  // Broadcast question countdown (Host side)
  broadcastQuestion: async (pin, qIdx, totalQuestions, q, timer) => {
    if (isFirebaseConfigured) {
      const sessionRef = doc(dbFirestore, 'sessions', pin);
      const answersColRef = collection(dbFirestore, 'sessions', pin, 'answers');
      
      // Clear answers subcollection from previous question
      try {
        await deleteCollection(dbFirestore, answersColRef);
      } catch (e) {
        console.error("Failed to delete answers subcollection:", e);
      }

      // Update session document to start question
      await setDoc(sessionRef, {
        phase: 'question',
        questionIdx: qIdx,
        totalQuestions,
        text: q.text,
        options: q.options,
        timeLimit: timer,
        pointsMultiplier: q.pointsMultiplier,
        multiSelect: q.correctAnswers.length > 1,
        correctAnswers: q.correctAnswers
      }, { merge: true });
    } else {
      const channel = getChannel(pin);
      channel.postMessage({
        type: 'QUESTION_START',
        questionIdx: qIdx,
        totalQuestions,
        text: q.text,
        options: q.options,
        timeLimit: timer,
        pointsMultiplier: q.pointsMultiplier,
        multiSelect: q.correctAnswers.length > 1
      });
    }
  },

  // Broadcast question end/feedback (Host side)
  broadcastQuestionEnd: async (pin, qCorrectAnswers, playersWithFeedback) => {
    if (isFirebaseConfigured) {
      const sessionRef = doc(dbFirestore, 'sessions', pin);
      await setDoc(sessionRef, {
        phase: 'reveal',
        correctAnswers: qCorrectAnswers,
        players: playersWithFeedback
      }, { merge: true });
    } else {
      const channel = getChannel(pin);
      // Sort players once to determine rank
      const sorted = [...playersWithFeedback].sort((a, b) => b.score - a.score);

      playersWithFeedback.forEach(p => {
        if (!p.isBot) {
          const rank = sorted.findIndex(player => player.id === p.id) + 1;
          channel.postMessage({
            type: 'QUESTION_END',
            playerId: p.id,
            correctAnswers: qCorrectAnswers,
            isCorrect: p.lastAnswerCorrect,
            pointsGained: p.pointsGained,
            score: p.score,
            streak: p.streak,
            rank: rank
          });
        }
      });
    }
  },

  // Broadcast game over (Host side)
  broadcastGameOver: async (pin) => {
    if (isFirebaseConfigured) {
      const sessionRef = doc(dbFirestore, 'sessions', pin);
      await setDoc(sessionRef, {
        phase: 'podium'
      }, { merge: true });
    } else {
      const channel = getChannel(pin);
      channel.postMessage({
        type: 'GAME_OVER'
      });
    }
  },

  // Listen for student answers (Host side)
  listenForAnswers: (pin, onAnswerReceived) => {
    if (isFirebaseConfigured) {
      const answersColRef = collection(dbFirestore, 'sessions', pin, 'answers');
      const unsubscribe = onSnapshot(answersColRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            onAnswerReceived(data.playerId, data.optionIdx, data.speed);
          }
        });
      });
      return unsubscribe;
    } else {
      const channel = getChannel(pin);
      const listener = (event) => {
        const msg = event.data;
        if (msg.type === 'SUBMIT_ANSWER') {
          onAnswerReceived(msg.playerId, msg.optionIdx, msg.speed);
        }
      };
      channel.addEventListener('message', listener);
      return () => {
        channel.removeEventListener('message', listener);
      };
    }
  },

  // Stop / delete active lobby (Host side)
  stopLobby: async (pin) => {
    if (isFirebaseConfigured) {
      const sessionRef = doc(dbFirestore, 'sessions', pin);
      const answersColRef = collection(dbFirestore, 'sessions', pin, 'answers');
      try {
        await deleteCollection(dbFirestore, answersColRef);
        await deleteDoc(sessionRef);
      } catch (e) {
        console.error("Failed to clean up Firestore session:", e);
      }
    } else {
      closeChannel(pin);
    }
  },

  // -----------------------------------------------------------
  // STUDENT / PLAYER CLIENT API
  // -----------------------------------------------------------
  joinGame: (pin, playerId, name, callbacks) => {
    const { onLobbyState, onQuestionStart, onQuestionEnd, onGameOver, onInvalidPin, onError } = callbacks;
    let localJoined = false;

    if (isFirebaseConfigured) {
      const sessionRef = doc(dbFirestore, 'sessions', pin);
      let joinedAdded = false;
      let lastPhase = null;
      let lastQuestionIdx = -1;

      let unsubscribe;
      unsubscribe = onSnapshot(sessionRef, async (snapshot) => {
        if (!snapshot.exists()) {
          console.warn("Lobby does not exist yet.");
          if (onInvalidPin) {
            onInvalidPin();
          }
          if (unsubscribe) unsubscribe();
          return;
        }

        const data = snapshot.data();
        const currentPhase = data.phase;

        // 1. Join verification / writing our player info to list
        if (!joinedAdded && currentPhase === 'lobby') {
          joinedAdded = true;
          const currentPlayers = data.players || [];
          if (!currentPlayers.some(p => p.id === playerId)) {
            const updatedPlayers = [...currentPlayers, { id: playerId, name, score: 0, streak: 0, lastAnswerCorrect: false }];
            try {
              await setDoc(sessionRef, { players: updatedPlayers }, { merge: true });
            } catch (err) {
              console.error("Failed to add player to session:", err);
              if (onError) {
                onError(err);
              }
              if (unsubscribe) unsubscribe();
            }
          }
        }

        // Dispatch phase triggers using phase/questionIdx state guards
        if (currentPhase === 'lobby') {
          onLobbyState(data.title, data.players || []);
          lastPhase = 'lobby';
        } else if (currentPhase === 'question') {
          if (lastPhase !== 'question' || data.questionIdx !== lastQuestionIdx) {
            onQuestionStart({
              questionIdx: data.questionIdx,
              totalQuestions: data.totalQuestions,
              text: data.text,
              options: data.options,
              timeLimit: data.timeLimit,
              pointsMultiplier: data.pointsMultiplier,
              multiSelect: data.multiSelect
            });
            lastPhase = 'question';
            lastQuestionIdx = data.questionIdx;
          }
        } else if (currentPhase === 'reveal') {
          if (lastPhase !== 'reveal') {
            // Find player score info in updated lobby list
            const pInfo = (data.players || []).find(p => p.id === playerId);
            if (pInfo) {
              onQuestionEnd({
                isCorrect: pInfo.lastAnswerCorrect,
                pointsGained: pInfo.pointsGained || 0,
                score: pInfo.score || 0,
                streak: pInfo.streak || 0,
                rank: (data.players || [])
                  .sort((a, b) => b.score - a.score)
                  .findIndex(p => p.id === playerId) + 1
              });
            }
            lastPhase = 'reveal';
          }
        } else if (currentPhase === 'podium') {
          if (lastPhase !== 'podium') {
            onGameOver();
            lastPhase = 'podium';
          }
        }
      }, (err) => {
        console.error("Snapshot error inside joinGame:", err);
        if (onError) {
          onError(err);
        }
        if (unsubscribe) unsubscribe();
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    } else {
      // Local fallback channel listeners
      const channel = getChannel(pin);
      
      const pinTimeout = setTimeout(() => {
        if (!localJoined && onInvalidPin) {
          onInvalidPin();
        }
      }, 3000);

      const listener = (event) => {
        const msg = event.data;
        if (msg.type === 'LOBBY_STATE') {
          clearTimeout(pinTimeout);
          onLobbyState(msg.title, msg.players || []);
          if (!localJoined) {
            localJoined = true;
            channel.postMessage({ type: 'JOIN_GAME', playerId, name });
          }
        } else if (msg.type === 'QUESTION_START') {
          onQuestionStart(msg);
        } else if (msg.type === 'QUESTION_END' && msg.playerId === playerId) {
          onQuestionEnd({
            isCorrect: msg.isCorrect,
            pointsGained: msg.pointsGained,
            score: msg.score,
            streak: msg.streak,
            rank: msg.rank || 1
          });
        } else if (msg.type === 'GAME_OVER') {
          onGameOver();
        }
      };

      channel.addEventListener('message', listener);
      
      // Send join message immediately in case host is listening
      channel.postMessage({ type: 'JOIN_GAME', playerId, name });

      return () => {
        clearTimeout(pinTimeout);
        channel.removeEventListener('message', listener);
        closeChannel(pin);
      };
    }
  },

  // Submit student answer (Player side)
  submitAnswer: async (pin, playerId, name, optionIdx, speed) => {
    if (isFirebaseConfigured) {
      const playerAnswerRef = doc(dbFirestore, 'sessions', pin, 'answers', playerId);
      await setDoc(playerAnswerRef, {
        playerId,
        name,
        optionIdx,
        speed
      });
    } else {
      const channel = getChannel(pin);
      channel.postMessage({
        type: 'SUBMIT_ANSWER',
        playerId,
        optionIdx,
        speed
      });
    }
  }
};
export default GameSync;
export { closeChannel };
