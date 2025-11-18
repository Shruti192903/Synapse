import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const AZURE_DI_ENDPOINT = process.env.AZURE_DI_ENDPOINT || '';
const AZURE_DI_KEY = process.env.AZURE_DI_KEY || '';
const API_VERSION = '2023-07-31';
const MODEL_ID = process.env.AZURE_DI_MODEL || 'prebuilt-layout';

export const ocrExtractor = async (base64Content) => {
    if (!AZURE_DI_ENDPOINT || !AZURE_DI_KEY) {
        throw new Error("Azure Document Intelligence keys or endpoint are not configured.");
    }

    const buffer = Buffer.from(base64Content, 'base64');

    const analyzeUrl = `${AZURE_DI_ENDPOINT}/formrecognizer/documentModels/${MODEL_ID}:analyze?api-version=${API_VERSION}`;

    const analyzeResponse = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
            "Ocp-Apim-Subscription-Key": AZURE_DI_KEY,
            "Content-Type": "application/octet-stream"
        },
        body: buffer
    });

    if (analyzeResponse.status !== 202) {
        const errorText = await analyzeResponse.text();
        throw new Error(`Document analysis failed: ${errorText}`);
    }

    const resultUrl = analyzeResponse.headers.get('Operation-Location');
    if (!resultUrl) throw new Error("No Operation-Location returned from Azure DI");

    let resultData;
    let retries = 0;
    const maxRetries = 15;
    const delay = 2000;

    do {
        await new Promise(resolve => setTimeout(resolve, delay));
        const pollResponse = await fetch(resultUrl, {
            headers: { "Ocp-Apim-Subscription-Key": AZURE_DI_KEY }
        });
        resultData = await pollResponse.json();
        retries++;
        if (retries > maxRetries) throw new Error("Max retries reached for Azure DI analysis");
    } while (resultData.status === 'running');

    if (resultData.status === 'failed') {
        throw new Error(`Azure DI analysis failed: ${resultData.error?.message}`);
    }

    return resultData.analyzeResult?.pages
        .flatMap(page => page.lines.map(line => line.content))
        .join('\n') || "No text detected";
};
