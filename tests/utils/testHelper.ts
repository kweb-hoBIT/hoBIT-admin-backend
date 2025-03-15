import request from "supertest";
import { expect } from "@jest/globals";

export async function checkApiResponse(
  app: any,
  endpoint: string,
  method: "get" | "post" | "put" | "delete" = "get",
  expectedStatus: number = 200,
  body?: object
) {
  const response = await request(app)[method](endpoint).send(body);
  expect(response.status).toBe(expectedStatus);
  return response.body;
}
