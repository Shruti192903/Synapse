import * as pdfParse from 'pdf-parse';
import { ocrExtractor } from './ocrExtractor.js';
import { summarizeText } from './summarizeText.js';

/**
 * Extract text from PDF (pdf-parse first, fallback to OCR), then summarize
 */
export const pdfTextExtractor = async (base64Content, onToken) => {
    const pdfBuffer = Buffer.from(base64Content, 'base64');

    let fullText = '';
    try {
        const data = await pdfParse.default(pdfBuffer);
        fullText = data.text;

        if (fullText.trim().length < 50) {
            console.log("PDF text too short, falling back to OCR...");
            throw new Error("PDF text extraction too short");
        }
    } catch (e) {
        console.warn("pdf-parse failed, using OCR:", e.message);
        fullText = await ocrExtractor(base64Content);
    }

    if (!fullText.trim()) {
        throw new Error("Could not extract text from PDF using both PDF parser and OCR");
    }

    // Summarize using non-streaming LLM
    const summary = await summarizeText(fullText, onToken);

    return summary;
};
