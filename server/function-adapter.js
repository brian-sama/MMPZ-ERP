/**
 * Adapter to run function-style handlers in Express.
 * It converts Express req/res into an event/context shape.
 */
export const functionToExpress = (handler) => async (req, res) => {
    try {
        const event = {
            path: req.originalUrl ? req.originalUrl.split('?')[0] : req.path,
            httpMethod: req.method,
            headers: req.headers,
            queryStringParameters: req.query,
            pathParameters: req.params,
            body: JSON.stringify(req.body || {}),
            isBase64Encoded: false,
        };

        const context = {
            functionName: 'handler',
            functionVersion: '1.0',
            callbackWaitsForEmptyEventLoop: true,
        };

        const response = await handler(event, context);
        if (!response) {
            return res.status(500).json({ error: 'Function returned no response' });
        }

        if (response.headers) {
            Object.entries(response.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
            });
        }

        res.status(response.statusCode || 200);
        if (response.body === undefined || response.body === null || response.body === '') {
            return res.send('');
        }
        return res.send(response.body);
    } catch (error) {
        console.error('Function adapter error:', error);
        const body = { error: 'Internal Server Error' };
        if (process.env.NODE_ENV !== 'production') {
            body.details = error.message;
        }
        return res.status(500).json(body);
    }
};
