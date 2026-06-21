import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Firebase Admin using Application Default Credentials (ADC)
// When running in Google Cloud Run, it automatically authenticates securely!
admin.initializeApp({
  projectId: process.env.VITE_FIREBASE_PROJECT_ID
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Secure Identity Gateway
app.get('/api/me', async (req, res) => {
  const iapEmailHeader = req.headers['x-goog-authenticated-user-email'];
  const iapNameHeader = req.headers['x-goog-authenticated-user-name'] || '';
  
  if (!iapEmailHeader) {
    return res.status(401).json({ error: "Unauthorized: No IAP headers detected." });
  }

  // Format: 'accounts.google.com:username@school.edu'
  const email = iapEmailHeader.includes(':') ? iapEmailHeader.split(':').pop() : iapEmailHeader;
  const name = iapNameHeader || email.split('@')[0];
  
  try {
    // Generate secure UID based on email (Must be <= 128 characters)
    const uid = 'iap_' + Buffer.from(email).toString('hex').slice(0, 100);
    
    // Mint Firebase Custom Token, baking the email in the JWT claims
    const customToken = await admin.auth().createCustomToken(uid, { email });
    
    res.json({ email, name, customToken });
  } catch (error) {
    console.error("Error creating custom Firebase token:", error);
    res.status(500).json({ error: "Failed to create authentication context." });
  }
});

// Serve static assets from the React compilation directory
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for React SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Teacher Hub Server running on port ${PORT}`);
});
