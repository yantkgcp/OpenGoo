import QuizPlayer from './components/QuizPlayer';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Background Glows */}
      <div className="ambient-glows">
        <div className="glow-bubble glow-bubble-1"></div>
        <div className="glow-bubble glow-bubble-2"></div>
        <div className="glow-bubble glow-bubble-3"></div>
      </div>

      {/* Main Student Player Viewport */}
      <div style={{ padding: '1.5rem', width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <QuizPlayer />
      </div>

    </div>
  );
}
