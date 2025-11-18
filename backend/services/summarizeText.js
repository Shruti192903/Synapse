import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

export const summarizeText = async (text, onToken) => {
    const prompt = `You are a helpful knowledge agent. Condense the following document text into a concise, professional summary highlighting all key facts and insights. If the text contains any tables, list the main data points from them. Stream the output.

    DOCUMENT TEXT:
    ---
    ${text}
    ---
    
    SUMMARY:`;

    let fullSummary = '';

    try {
        const responseStream = await model.generateContentStream({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        for await (const chunk of responseStream) {
            const token = chunk.text;
            if (token) {
                fullSummary += token;
                onToken('text', token);
            }
        }
        return fullSummary;
    } catch (error) {
        console.error('Gemini summarization failed:', error);
        throw new Error('Summarization service failed.');
    }
};