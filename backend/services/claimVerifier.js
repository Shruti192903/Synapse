import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { webSearchTool } from './webSearchTool.js';

dotenv.config();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

export const claimVerifier = async (documentText, userQuery, onToken) => {
    
    onToken('thought', 'Analyzing document to extract verifiable claims...');
    const extractionPrompt = `Analyze the following document text and the user's query. Identify 3-5 specific, factual claims or data points that need external verification via a web search. Output a JSON array of strings. DOCUMENT TEXT: ${documentText}`;

    let claims;
    try {
        const extractionResponse = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
            generationConfig: { // FIX: Use generationConfig
                responseMimeType: "application/json",
            },
        });
        claims = JSON.parse(extractionResponse.text);
        if (!Array.isArray(claims) || claims.length === 0) {
            throw new Error('No verifiable claims could be extracted.');
        }
        
    } catch (e) {
        onToken('text', `\n\n**Error:** Failed to extract claims from the document. Reason: ${e.message}`);
        throw new Error('Claim extraction failed.');
    }

    onToken('thought', `\nExtracted ${claims.length} claims. Now searching the web for verification...`);
    
    const verificationResults = [];
    for (const claim of claims) {
        onToken('thought', `\n- Searching for: "${claim}"`);
        const searchResult = await webSearchTool(claim, 1); 

        verificationResults.push({
            claim,
            externalResult: searchResult.snippet || 'No relevant external data found.',
            sourceUrl: searchResult.url || '',
        });
    }

    onToken('thought', '\nComparing external data with original document claims and scoring confidence...');

    const comparisonPrompt = `You are a Claim Verification Engine. You are provided with claims and external data. For each item, compare the 'claim' with the 'externalResult'. 1. Determine Confidence Score (0-100). 2. Generate a Concise Summary. DATA TO ANALYZE (JSON array): ${JSON.stringify(verificationResults)}`;
    
    let finalTableData;
    try {
        const comparisonResponse = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: comparisonPrompt }] }],
            generationConfig: { // FIX: Use generationConfig
                responseMimeType: "application/json",
            },
        });
        finalTableData = JSON.parse(comparisonResponse.text);

    } catch (e) {
        onToken('text', `\n\n**Error:** Failed to perform final comparison and scoring. Reason: ${e.message}`);
        throw new Error('Comparison and scoring failed.');
    }
    
    onToken('thought', '\nVerification process complete. Preparing final table...');

    return finalTableData;
};