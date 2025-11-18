import { intentDetector } from './intentDetector.js';
import { pdfTextExtractor } from './pdfTextExtractor.js';
import { csvParser } from './csvParser.js';
import { ocrExtractor } from './ocrExtractor.js';
import { summarizeText } from './summarizeText.js';
import { dataAnalysis } from './dataAnalysis.js';
import { offerLetterGenerator } from './offerLetterGenerator.js';
import { claimVerifier } from './claimVerifier.js';
import { webSearchTool } from './webSearchTool.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

const agentState = {
    messages: [],
    scratchpad: {
        extractedText: null,
        extractedData: null,
        offerData: null,
    },
    action: null,
    data: null,
};

export const agentOrchestrator = async (payload, onToken) => {
    const { message, file, fileType } = payload;
    
    onToken('thought', 'Analyzing user intent...');
    
    let tool, argument;
    
if (file && (tool === 'general_query' || tool === 'web_search')) {
        onToken('thought', `\nFile detected. Overriding intent to perform file extraction.`);
        if (fileType === 'application/pdf') {
            tool = 'extract_pdf_text';
        } else if (fileType === 'text/csv') {
            tool = 'extract_csv_data';
        } else {
            tool = 'run_ocr';
        }
        argument = message; // Keep the original message as the argument
    }
    // ******************************************************************************************

    agentState.action = tool;

    try {
        onToken('thought', `\nIntent detected: **${tool}**. Executing primary action...`);

        switch (tool) {
            case 'extract_pdf_text':
            case 'run_ocr':
                if (!file) throw new Error('PDF/Image file is required for extraction.');
                
                onToken('thought', `\nExtracting text from ${fileType === 'application/pdf' ? 'PDF' : 'Image'}...`);
                
                const rawTextResult = (fileType === 'application/pdf' && tool !== 'run_ocr')
                    ? await pdfTextExtractor(file)
                    : await ocrExtractor(file);
                
                agentState.scratchpad.extractedText = rawTextResult;
                
                onToken('thought', '\nExtraction complete. Generating summary...');
                const summary = await summarizeText(rawTextResult, onToken);
                onToken('final_output', summary);

                break;

            case 'extract_csv_data':
                if (!file || fileType !== 'text/csv') throw new Error('CSV file is required for data parsing.');
                
                onToken('thought', '\nParsing CSV data...');
                const { rows, schema } = await csvParser(file);
                agentState.scratchpad.extractedData = { rows, schema };
                
                onToken('thought', `\nCSV parsed. Found ${rows.length} records. Analyzing trends...`);
                
                // Fall-through logic to analysis
                const { summary: analysisSummary, chartJson } = await dataAnalysis(rows, schema, argument, onToken);
                onToken('chart', chartJson);
                onToken('final_output', analysisSummary);
                
                break;
                
            case 'analyze_data':
                if (!agentState.scratchpad.extractedData) {
                     throw new Error('No dataset found in the workspace. Please upload a CSV or PDF first.');
                }
                const dataToAnalyze = agentState.scratchpad.extractedData.rows;
                const schemaToAnalyze = agentState.scratchpad.extractedData.schema;

                onToken('thought', '\nDataset loaded. Running requested analysis...');
                const { summary: chartSummary, chartJson: finalChart } = await dataAnalysis(dataToAnalyze, schemaToAnalyze, argument, onToken);
                onToken('chart', finalChart);
                onToken('final_output', chartSummary);

                break;
                
            case 'generate_offer_letter':
                if (!agentState.scratchpad.extractedText) {
                    throw new Error('Resume text is not available. Please upload a PDF resume first.');
                }
                onToken('thought', '\nGenerating offer letter draft...');
                const { candidate, html } = await offerLetterGenerator(agentState.scratchpad.extractedText, argument);
                
                agentState.scratchpad.offerData = { to: candidate.email, subject: `Job Offer: ${candidate.jobTitle}`, html };
                
                onToken('email_preview', {
                    to: candidate.email,
                    subject: `Job Offer: ${candidate.jobTitle}`,
                    html: html,
                    message: `Offer letter drafted for **${candidate.name}** at **${candidate.salary}**. Review the HTML preview below and click 'Send Email' to finalize.`,
                });
                
                break;

            case 'verify_claims':
                if (!agentState.scratchpad.extractedText) {
                    throw new Error('Document text is not available for claim verification. Please upload a PDF first.');
                }
                onToken('thought', '\nStarting claim verification process...');
                const verificationTable = await claimVerifier(agentState.scratchpad.extractedText, argument, onToken);
                
                onToken('table', {
                    caption: 'Claim Verification Results',
                    headers: ['Claim', 'External Result', 'Confidence (%)', 'Summary'],
                    rows: verificationTable.map(row => [row.claim, row.externalResult, row.confidenceScore, row.summary]),
                });
                onToken('final_output', "Verification complete. Table streamed above.");
                
                break;
                
            case 'web_search':
                onToken('thought', `\nSearching the web for: "${argument}"`);
                const result = await webSearchTool(argument, 5);
                
                const finalSearchText = `**Web Search Result for:** *${argument}*\n\n> ${result.snippet}\n\n**Source:** [${result.url}](${result.url})`;
                
                onToken('text', finalSearchText);
                onToken('final_output', finalSearchText);

                break;

case 'general_query':
            default:
                onToken('thought', 'Executing general conversational response...');
                
                try {
                    // Fallback to a simple Gemini streaming call
                    const responseStream = await model.generateContentStream({
                        contents: [{ role: "user", parts: [{ text: message }] }],
                    });

                    // Ensure the stream is iterable before looping (the fix)
                    if (responseStream && typeof responseStream[Symbol.asyncIterator] === 'function') {
                        for await (const chunk of responseStream) {
                            const token = chunk.text;
                            if (token) {
                                onToken('text', token);
                            }
                        }
                    } else {
                        throw new Error("Gemini stream failed to return an iterable object.");
                    }

                } catch (streamError) {
                    // If the stream fails here, send a definitive error
                    onToken('error', `Gemini Streaming Failed: ${streamError.message}`);
                    console.error('Gemini Streaming Failed:', streamError);
                }
                
                onToken('final_output', "General query complete.");
                break;
        }

    } catch (error) {
        console.error(`Tool ${tool} failed:`, error);
        onToken('error', `An error occurred during **${tool}**: ${error.message}`);
    } 
    // Note: Controller handles final res.end()
};