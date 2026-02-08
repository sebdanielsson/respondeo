import { ApiReference } from "@scalar/nextjs-api-reference";
import { openApiSpec } from "@/lib/openapi";

export const GET = ApiReference({
  content: openApiSpec,
  theme: "kepler",
  pageTitle: "Respondeo API Documentation",
});
