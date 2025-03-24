export type SwaggerRequest = {};

export type SwaggerResponse = {
  statusCode: number;
  message: string;
  data: {
    openapi: string;
    info: {
      title: string;
      description: string;
      version: string;
    };
    paths: {
      [key: string]: {
        get: {
          summary: string;
          responses: {
            [key: string]: {
              description: string;
            };
          };
        };
      };
    };
    components: {
      schemas: {
        User: {
          type: string;
          properties: {
            id: { type: string };
            name: { type: string };
          };
        };
      };
    };
  };
};

