import { pathToFileURL } from 'url';

/**
 * Adapter to run a Netlify Function in Express
 * @param {Function} handler - The exported handler from a Netlify Function file
 * @returns {Function} Express middleware (req, res, next)
 */
export const netlifyToExpress = (handler) => async (req, res, next) => {
    try {
        // Construct the Netlify 'event' object
        // Netlify event includes: path, httpMethod, headers, queryStringParameters, body, isBase64Encoded
        const event = {
            path: req.path,
            httpMethod: req.method,
            headers: req.headers,
            queryStringParameters: req.query,
            body: JSON.stringify(req.body || {}), // Body as string
            isBase64Encoded: false,
        };

        // Construct the Netlify 'context' object (minimal for now)
        const context = {
            callbackWaitsForEmptyEventLoop: true,
            functionName: 'handler',
            functionVersion: '1.0',
            invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:handler',
            memoryLimitInMB: '1024',
            awsRequestId: '12345678-1234-1234-1234-123456789012',
            logGroupName: '/aws/lambda/handler',
            logStreamName: '2023/10/26/[$LATEST]abc123def456',
            identity: {},
            clientContext: {},
        };

        // Call the Netlify function handler
        const response = await handler(event, context);

        if (!response) {
            console.error('Function returned no response');
            return res.status(500).send('Internal Server Error');
        }

        // Apply headers
        if (response.headers) {
            Object.keys(response.headers).forEach((key) => {
                res.setHeader(key, response.headers[key]);
            });
        }

        // Apply status code
        res.status(response.statusCode || 200);

        // Send body
        res.send(response.body);

    } catch (error) {
        console.error('Error in Netlify Adapter:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
