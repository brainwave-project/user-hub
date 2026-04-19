import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'UserHub API',
      version:     '1.0.0',
      description: 'User lifecycle, account state machine, and role management.',
    },
    servers: [{ url: '/api', description: 'UserHub via Kong' }],
    tags: [{ name: 'Users', description: 'User management endpoints' }],
  },
  // Scan handlers — JSDoc @swagger blocks live here
  apis: ['./src/transport/http/handlers/*.ts', './src/transport/http/router.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export function setupSwagger(app: Express): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  // Also expose the raw spec for tooling (Postman, Kong deck sync, etc.)
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
}
