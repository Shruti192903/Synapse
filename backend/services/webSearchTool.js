import dotenv from 'dotenv';

// FIX: Use dynamic import to reliably load the exports, as static named imports fail
// The 'tools' module is not guaranteed to be exported, but the root module is.
const { TavilySearchAPI, GoogleCustomSearch } = await import('@langchain/community');

dotenv.config();

/**
 * Searches the web using either Tavily or Google Custom Search API.
 * @param {string} query - The search query.
 * @param {number} numResults - The number of results to fetch.
 * @returns {Promise<{snippet: string, url: string}>} The best search result.
 */
export const webSearchTool = async (query, numResults = 3) => {
    
    // Prioritize Tavily if key is available
    if (process.env.TAVILY_API_KEY) {
        try {
            const tavily = new TavilySearchAPI(process.env.TAVILY_API_KEY);
            const rawResults = await tavily.call(query);
            const results = JSON.parse(rawResults); 

            if (results && results.length > 0) {
                return {
                    snippet: results[0].content,
                    url: results[0].url,
                };
            }
        } catch (e) {
            console.warn(`Tavily search failed: ${e.message}. Falling back to Google Custom Search.`);
        }
    }

    // Fallback to Google Custom Search API
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
        try {
            // Use the imported class
            const googleSearch = new GoogleCustomSearch({
                apiKey: process.env.GOOGLE_SEARCH_API_KEY,
                cx: process.env.GOOGLE_SEARCH_CX,
            });
            
            const results = await googleSearch.call(query);
            const parsedResults = JSON.parse(results);

            if (parsedResults.length > 0) {
                return {
                    snippet: parsedResults[0].snippet,
                    url: parsedResults[0].link,
                };
            }
        } catch (e) {
            console.error(`Google Custom Search API failed: ${e.message}.`);
        }
    }

    // Final fallback
    return {
        snippet: 'Web search tool is currently unavailable or returned no results.',
        url: '',
    };
};