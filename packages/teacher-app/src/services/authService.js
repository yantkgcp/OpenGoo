import { getAuth, signInWithCustomToken } from 'firebase/auth';

export const getActiveUser = async () => {
  const auth = getAuth();
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      if (data.email && data.customToken) {
        const email = data.email.includes(':') ? data.email.split(':').pop() : data.email;
        const name = data.name || email.split('@')[0];
        
        // Authenticate client-side with Firestore using the Custom JWT Token!
        await signInWithCustomToken(auth, data.customToken);
        
        return { email, name, isIAP: true };
      }
    }
  } catch (e) {
    console.log("No IAP auth gateway found. Running in Local Offline/Dev Mode.");
  }

  // Graceful offline fallback
  const stored = localStorage.getItem('opengoo_local_teacher');
  if (stored) {
    return JSON.parse(stored);
  }

  const devProfile = { email: 'teacher@opengoo.local', name: 'Local Dev Teacher', isIAP: false };
  localStorage.setItem('opengoo_local_teacher', JSON.stringify(devProfile));
  return devProfile;
};

export const setLocalUser = (user) => {
  localStorage.setItem('opengoo_local_teacher', JSON.stringify(user));
};

