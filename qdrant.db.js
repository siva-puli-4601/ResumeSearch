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

export async function upsertResume(filePath, email, resumeNo) {
  try {
    await createOrSkipCollection("resumes");

    const { chunks, embeddings } = await processResume(filePath, email, resumeNo);

    const data = embeddings.map((embeddingObj, index) => {
      const id = uuidv4();
      
      return {
      id: id,
      vector: embeddingObj.embedding.values,
      payload: { chunk: chunks[index], email, resumeNo }
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
    output should be  in json like {Result:{{email:email, percentage:score},{email:email, percentage:score},....}}`;
    
    const result = await model.generateContent(prompt);
    //console.log(result.response.text());

    
    } catch (error) {
    console.error('Error generating response with Gemini LLM:', error);
  }
} 
export async function searchResumes(skillQuery) {
  try {
    const {skills,limit}=skillQuery;
    const embed = await getEmbedding(skills);

    const size=parseInt(limit);
    // console.log(size);
    const groupby=await client.queryGroups("resumes", {
      query: embed.values,
      group_by: "email",
      limit: size,
      group_size: 1,
      score_threshold: 0.4
  });
   
  console.log(JSON.stringify(groupby, null, 2));
  var res=[];
   if(groupby.groups.length>0){
   groupby.groups.forEach((group, groupIndex) => {
    // console.log(group);
    group.hits.forEach((hit, hitIndex) => {
      // console.log(hit);
      let x={"email":group.id, "score":hit.score};
      res.push(x);
      // console.log(group.id+" "+hit.score);
    })    
    
   })
  }
  else
  {
    console.log("No matching resumes found.");
  }

    const searchResult = await client.search("resumes", {
      vector: embed.values,
      limit: 5,  
      score_threshold: 0.4
    });

    const uniqueResults = [];
    const seenemails = new Set();
    
    searchResult.forEach(result => {
        const { email, resumeNo, chunk } = result.payload;
        const {score}=result;
        
        if (!seenemails.has(email)) {
            uniqueResults.push({ email, resumeNo, chunk,score});
            seenemails.add(email);
        }
    });
    const customString = uniqueResults.map(obj => `email: ${obj.email}, resumeNo: ${obj.resumeNo}, chunk:${obj.chunk}`).join('; ');
    const llmres= await GenResponse(skillQuery,customString);
    // console.log(llmres);
    return res;
  } catch (error) {
    console.error('Error searching resumes:', error);
  }
}
