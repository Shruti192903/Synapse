import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

const TOOL_NAMES = [
    'extract_pdf_text',
    'extract_csv_data',
    'run_ocr',
    'analyze_data',
    'generate_offer_letter',
    'verify_claims',
    'web_search',
    'send_email',
    'general_query',
];

const INTENT_SYSTEM_PROMPT = `
You are an intelligent Intent Detection and Tool Routing Agent. Your task is to analyze the user's message and the available file to determine the single, best next step (tool) and any required arguments.

Available Tools:
- **extract_pdf_text**: When the user provides a PDF file and needs its content extracted, summarized, or processed.
- **extract_csv_data**: When the user provides a CSV file, usually for analysis or charting.
- **run_ocr**: When the user provides an image file or an image-based PDF.
- **analyze_data**: When the user's intent is to perform calculations, trend analysis, or generate a chart on already extracted data.
- **generate_offer_letter**: When the user explicitly asks to create an offer letter.
- **verify_claims**: When the user asks to fact-check, verify information, or compare internal data with external data.
- **web_search**: When the user needs current, external, or general knowledge.
- **send_email**: Direct action only, should not be the initial tool.
- **general_query**: For simple conversational questions.

Output must be a JSON object with 'tool' and 'argument'.

JSON FORMAT:
{
  "tool": "selected_tool_name",
  "argument": "The main query/instruction for the selected tool"
}
`;

export const intentDetector = async (message, fileType) => {
    let context = fileType ? `The user has provided a file of type: ${fileType}.` : `No file has been provided by the user.`;
    
    const fullPrompt = `${INTENT_SYSTEM_PROMPT}

    CONTEXT: ${context}
    
    USER MESSAGE: "${message}"`;

    try {
        const response = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig: { // FIX: Use generationConfig for structured output
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        tool: { type: "string", enum: TOOL_NAMES },
                        argument: { type: "string" },
                    },
                    required: ["tool", "argument"],
                },
            },
        });

        const result = JSON.parse(response.text);
        
        if (!TOOL_NAMES.includes(result.tool)) {
             console.warn(`Model returned invalid tool: ${result.tool}. Falling back to general_query.`);
             return { tool: 'general_query', argument: message };
        }
        
        return result;

    } catch (error) {
        console.error('Intent detection failed:', error);
        // Re-throw the error so agentOrchestrator can handle the crash gracefully
        throw error; 
    }
};