import { createWorker } from 'tesseract.js';

export const ocrExtractor = async (base64Content) => {
    const buffer = Buffer.from(base64Content, 'base64');
    
    let worker;
    let extractedText = '';

    try {
        worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(buffer);
        extractedText = text;
    } catch (error) {
        console.error('Tesseract OCR failed:', error);
        throw new Error(`OCR extraction failed: ${error.message}`);
    } finally {
        if (worker) {
            await worker.terminate();
        }
    }

    return extractedText;
};