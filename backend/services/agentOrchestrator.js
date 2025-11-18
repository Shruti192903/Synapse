import { intentDetector } from './intentDetector.js';
import { pdfTextExtractor } from './pdfTextExtractor.js';
import { csvParser } from './csvParser.js';
import { ocrExtractor } from './ocrExtractor.js';
import { summarizeText } from './summarizeText.js';
import { dataAnalysis } from './dataAnalysis.js';
import { offerLetterGenerator } from './offerLetterGenerator.js';
import { claimVerifier } from './claimVerifier.js';
import { webSearchTool } from './webSearchTool.js';
import dotenv from 'dotenv';
// REMOVED: GoogleGenerativeAI import

dotenv.config();

// Note: LLM calls are now handled entirely via summarizeText, intentDetector

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
    
    try {
        ({ tool, argument } = await intentDetector(message, fileType));
    } catch (e) {
        console.warn(`Intent detection failed: ${e.message}. Checking for file override.`);
        tool = 'general_query';
        argument = message;
    }
    
    // *** CRITICAL PRIORITY FIX: Force file analysis if a file is uploaded ***
    if (file && (tool === 'general_query' || tool === 'web_search')) {
            onToken('thought', `\nFile detected. Overriding intent to perform file extraction.`);
            if (fileType === 'application/pdf') {
                tool = 'extract_pdf_text';
            } else if (fileType === 'text/csv') {
                tool = 'extract_csv_data';
            } else {
                tool = 'run_ocr';
            }
            argument = message;
        }
        
        agentState.action = tool;

    try {
        onToken('thought', `\nIntent detected: **${tool}**. Executing primary action...`);

        switch (tool) {
            case 'extract_pdf_text':
                        case 'run_ocr':
                            if (!file) throw new Error('PDF/Image file is required for extraction.');
                            
                            onToken('thought', `\nExtracting text from ${fileType === 'application/pdf' ? 'PDF' : 'Image'}...`);
                            
                            // --- CRITICAL CHANGE: Pass the file name ---
                            const rawTextResult = await pdfTextExtractor(file, payload.fileName); // PASS FILE NAME HERE
                            
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
                // LLM call for drafting is now implicitly handled by the general LLM service
                const candidate = { name: "Candidate Name", email: "test@example.com", jobTitle: "Software Engineer", salary: "$120,000" }; // Placeholder logic
                const html = "<h1>Offer Letter HTML Placeholder</h1>"; // Placeholder logic
                
                agentState.scratchpad.offerData = { to: candidate.email, subject: `Job Offer: ${candidate.jobTitle}`, html };
                
                onToken('email_preview', {
                    to: candidate.email,
                    subject: `Job Offer: ${candidate.jobTitle}`,
                    html: html,
                    message: `Offer letter drafted for **${candidate.name}**. Review the HTML preview below and click 'Send Email' to finalize. (LLM call simplified)`,
                });
                
                break;

            case 'verify_claims':
                // Note: claimVerifier.js must be updated to use OLLAMA/summarizeText for its LLM calls internally
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
                
                const finalSearchText = `**Web Search Result for:** *${result.snippet}*\n\n**Source:** [${result.url}](${result.url})`;
                
                onToken('text', finalSearchText);
                onToken('final_output', finalSearchText);

                break;

            case 'general_query':
            default:
                onToken('thought', 'Executing general conversational response...');
                const generalResponse = await summarizeText(message, onToken, "You are a helpful and concise assistant.");
                
                onToken('final_output', generalResponse);
                break;
        }

    } catch (error) {
        console.error(`Tool ${tool} failed:`, error);
        onToken('error', `A critical error occurred during **${tool}**: ${error.message}`);
    } 
};