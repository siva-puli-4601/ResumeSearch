import { QdrantClient } from "@qdrant/js-client-rest";
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { processResume, getEmbedding } from './embeddings.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const client = new QdrantClient({ host: "172.17.10.125", port: 6333 });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function createOrSkipCollection(collectionName) {
  try {
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(col => col.name === collectionName);

    if (!collectionExists) {
      await client.createCollection(collectionName, {
        vectors: { size: 768, distance: "Cosine" },
      });
      console.log(`Collection '${collectionName}' created successfully.`);
    } else {
      console.log(`Collection '${collectionName}' already exists.`);
    }
  } catch (error) {
    console.error('Error creating collection:', error);
  }
}

export async function upsertResume(filePath, studentName, resumeNo,emp_id) {
  try {
    await createOrSkipCollection("resumes");

    const { chunks, embeddings } = await processResume(filePath, studentName, resumeNo);

    const data = embeddings.map((embeddingObj, index) => {
      const id = uuidv4();
      
      return {
      id: id,
      vector: embeddingObj.embedding.values,
      payload: { chunk: chunks[index], studentName, resumeNo }
    }});

    const operationInfo = await client.upsert("resumes", {
      wait: true,
      points: data,
    });

    console.log('Upsert result:', operationInfo);
  } catch (error) {
    console.error('Error upserting resume:', error);
  }
}
async function GenResponse(skillQuery,customString)
{
  try {
    
    const prompt = `QdrantDB text:${customString}\n\ncompany request: ${skillQuery} based on the both choose the best students among the given data 
    output should be  in json like {Result:{{studentname:Name, percentage:score},{studentname:Name, percentage:score}}}`;
    
    const result = await model.generateContent(prompt);
    console.log(result.response.text());

    
    } catch (error) {
    console.error('Error generating response with Gemini LLM:', error);
  }
} 
export async function searchResumes(skillQuery) {
  try {
    const embed = await getEmbedding(skillQuery);

    const searchResult = await client.search("resumes", {
      vector: embed.values,
      limit: 5,  
      score_threshold: 0.4,
    });

    const uniqueResults = [];
    const seenStudentNames = new Set();
    
    searchResult.forEach(result => {
        const { studentName, resumeNo, chunk } = result.payload;
        const {score}=result;
        
        if (!seenStudentNames.has(studentName)) {
            uniqueResults.push({ studentName, resumeNo, chunk,score});
            seenStudentNames.add(studentName); // Add the studentName to the set to track uniqueness
        }
    });
    const customString = uniqueResults.map(obj => `studentName: ${obj.studentName}, resumeNo: ${obj.resumeNo}, chunk:${obj.chunk}`).join('; ');
    const llmres= await GenResponse(skillQuery,customString);
    // console.log(llmres);
    return uniqueResults;
  } catch (error) {
    console.error('Error searching resumes:', error);
  }
}
