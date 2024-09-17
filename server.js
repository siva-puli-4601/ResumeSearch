import express from 'express';
import multer from 'multer';
import path from 'path';
import { upsertResume, searchResumes } from './qdrant.db.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

import cors from 'cors';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());

app.use(express.json());
const port = 3000;

// Multer setup for handling PDF file uploads
const uploadDir = path.join(__dirname, './uploads');

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Create the uploads directory if it doesn't exist
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});


const upload = multer({ storage });

// Upload resume API
app.post('/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    const email = req.body.email;
    const resumeNo = req.body.resumeNo;
    const filePath = req.file.path;
    const emp_id=parseInt(req.body.emp_id);

    
    await upsertResume(filePath, email, resumeNo);

    return res.status(200).json({ message: 'Resume uploaded and processed successfully' });
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({ message: 'Error uploading and processing resume' });
  }
});

// Search resumes API
app.post('/search-resumes', async (req, res) => {
  try {
    const {skills} = req.body; 
    console.log(skills);
    const results = await searchResumes(skills);

    return res.status(200).json({ message: 'Search completed', "results": results});
  } catch (error) {
    console.error('Error searching resumes:', error);
    return res.status(500).json({ message: 'Error searching resumes' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
