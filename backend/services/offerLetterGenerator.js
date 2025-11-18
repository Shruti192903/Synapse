import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

export const offerLetterGenerator = async (resumeText, userQuery) => {
    
    // Step 1: Extract candidate name and email
    const extractionPrompt = `From the following resume text, identify and extract the candidate's full name and their primary email address. Return the result in a JSON object. RESUME TEXT: ${resumeText}`;

    let candidateDetails;
    try {
        const extractionResponse = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
            generationConfig: { // FIX: Use generationConfig
                responseMimeType: "application/json",
            },
        });
        candidateDetails = JSON.parse(extractionResponse.text);

    } catch (e) {
        throw new Error('Could not extract candidate name and email from the document.');
    }
    
    const { name, email, jobTitle: extractedTitle, salary: extractedSalary } = candidateDetails;

    const titleMatch = userQuery.match(/(Software Engineer|Data Scientist|Product Manager|Analyst)/i)?.[0] || extractedTitle || 'Associate';
    const salaryMatch = userQuery.match(/(\$\d{1,3}(,\d{3})*)/)?.[0] || extractedSalary || '$80,000';
    
    const finalJobTitle = titleMatch;
    const finalSalary = salaryMatch;
    
    if (!name || !email) {
        throw new Error('Could not find both candidate name and email to generate the letter.');
    }

    // Step 2: Generate the Offer Letter HTML
    const htmlPrompt = `You are an expert HR documentation generator. Draft a professional, standard offer letter in clean, responsive HTML format. Use the following details: Name: ${name}, Position: ${finalJobTitle}, Salary: ${finalSalary}. Output ONLY the complete HTML code.`;

    let html;
    try {
        const htmlResponse = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: htmlPrompt }] }],
        });
        html = htmlResponse.text.trim().replace(/^```html\s*|```\s*$/g, '');
    } catch (e) {
        throw new Error('Failed to generate the offer letter HTML.');
    }
    
    return {
        candidate: { name, email, jobTitle: finalJobTitle, salary: finalSalary },
        html
    };
};