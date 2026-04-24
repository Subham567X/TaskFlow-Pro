import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { google } from 'googleapis';
import stream from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Multer for memory storage of file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for Drive Sync
  });

  // API Middleware
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Google Drive Authentication Setup
  const getDriveClient = () => {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      console.warn('DRIVE SYNC: GOOGLE_SERVICE_ACCOUNT_JSON not found in environment.');
      return { client: null, error: 'Environment variable GOOGLE_SERVICE_ACCOUNT_JSON is missing.' };
    }
    
    try {
      const credentials = JSON.parse(serviceAccountJson);
      
      // Validation: Check if it's just a string or a partial object
      if (typeof credentials !== 'object' || credentials === null) {
        throw new Error('Parsed credentials is not an object.');
      }
      
      if (!credentials.private_key || !credentials.client_email) {
        let missing = [];
        if (!credentials.private_key) missing.push('private_key');
        if (!credentials.client_email) missing.push('client_email');
        throw new Error(`Invalid JSON format. Missing required fields: ${missing.join(', ')}. Please paste the FULL content of the JSON key file from Google Cloud console.`);
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      return { client: google.drive({ version: 'v3', auth }), error: null };
    } catch (e: any) {
      console.error('DRIVE SYNC CONFIG ERROR:', e.message);
      return { client: null, error: `JSON Parse Error: ${e.message}. Ensure you are pasting the entire bracketed { ... } content.` };
    }
  };

  // Secure Pipeline Endpoint for Google Drive Sync
  app.post('/api/sync-to-drive', upload.single('file'), async (req: express.Request, res: express.Response) => {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: 'No payload detected' });

      const { client: drive, error: configError } = getDriveClient();
      const folderId = process.env.DRIVE_FOLDER_ID || '13OX-pcFkNPNfPDrPiiKqR_islXqGbYkM';

      if (!drive) {
        console.log('SYNC BYPASS:', configError);
        return res.json({ 
          success: true, 
          msg: `Pipeline Bypass: ${configError}`,
          simulated: true 
        });
      }

      const bufferStream = new stream.PassThrough();
      bufferStream.end(file.buffer);

      const response = await drive.files.create({
        requestBody: {
          name: `[PRODUCTION_LOG]_${Date.now()}_${file.originalname}`,
          parents: [folderId],
          description: `Master Sync via Secure Pipeline`
        },
        media: {
          mimeType: file.mimetype,
          body: bufferStream,
        },
        fields: 'id, webViewLink',
      });

      console.log('DRIVE SYNC SUCCESS:', response.data.id);
      res.json({ 
        success: true, 
        id: response.data.id, 
        link: response.data.webViewLink 
      });
    } catch (error: any) {
      console.error('DRIVE SYNC CRITICAL FAILURE:', error);
      res.status(500).json({ error: 'Internal Pipeline Synchronization Failure', details: error.message });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'active', platform: 'Taskflow Centralized Bridge' });
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SECURE BRIDGE ACTIVE ON PORT ${PORT}`);
  });
}

startServer();
