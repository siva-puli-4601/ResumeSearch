import fs from 'fs';
import pdf from 'pdf-parse';
import dotenv from 'dotenv';

dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (err) {
        console.error('Error extracting text from PDF:', err);
    }
}

export async function getEmbedding(text) {
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding;
    } catch (error) {
        console.error('Error generating embeddings:', error);
        throw error;
    }
}

function chunkText(text, wordLimit) {
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += wordLimit) {
        chunks.push(words.slice(i, i + wordLimit).join(' '));
    }
    return chunks;
}

export async function processResume(filePath, email, resumeNo) {

    try {
        const extractedText = await extractTextFromPDF(filePath);
        const chunks = chunkText(extractedText, 100); 
        const embeddings = [];

        for (const chunk of chunks) {
            const embedding = await getEmbedding(chunk);
            embeddings.push({ chunk, embedding });
        }

        return { email, resumeNo, chunks, embeddings };
    } 
    catch (error) {
        console.error('Error processing resume:', error);
    }
}
