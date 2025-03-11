import swaggerJsDoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hobit Admin API',
      version: '0.1.0',
      description: 'HoBIT Admin API Docs',
    },
  },
  apis: ['./src/docs/swaggerDocs.yaml'],
};

export const swaggerDocs = swaggerJsDoc(swaggerOptions);