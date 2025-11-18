import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Node.js fetch

dotenv.config();

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

/**
 * Non-streaming summarization from Ollama.
 * Simulates streaming tokens for frontend if needed.
 */
export const summarizeText = async (text, onToken = () => {}, systemPrompt = "You are a helpful knowledge agent. Provide a concise professional summary.") => {
    try {
        const response = await fetch(OLLAMA_ENDPOINT, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: `SYSTEM: ${systemPrompt}\nUSER: ${text}`,
                stream: false // critical: non-streaming
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const fullText = data.response || "";

        // Optional: simulate streaming
        for (let i = 0; i < fullText.length; i++) {
            onToken('text', fullText[i]);
            await new Promise(resolve => setTimeout(resolve, 5));
        }

        return fullText;

    } catch (error) {
        console.error("Ollama communication failed:", error);
        throw new Error(`Ollama Communication Failed: ${error.message}`);
    }
};
