import Papa from 'papaparse';

const inferSchema = (data) => {
    if (!data || data.length === 0) return [];

    const headers = Object.keys(data[0]);
    const schema = headers.map(header => {
        let type = 'string';
        let isNumerical = true;

        for (let i = 0; i < Math.min(data.length, 100); i++) {
            const value = data[i][header];

            if (value !== null && value !== undefined && value !== '' && isNaN(parseFloat(value))) {
                isNumerical = false;
                break;
            }
        }

        if (isNumerical) {
            type = 'number';
        }

        return { field: header, type };
    });

    return schema;
};

export const csvParser = async (base64Content) => {
    const csvString = Buffer.from(base64Content, 'base64').toString('utf8');

    return new Promise((resolve, reject) => {
        Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.error('PapaParse errors:', results.errors);
                }
                const schema = inferSchema(results.data);
                resolve({
                    rows: results.data,
                    schema,
                });
            },
            error: (error) => {
                reject(new Error(`CSV parsing error: ${error.message}`));
            }
        });
    });
};