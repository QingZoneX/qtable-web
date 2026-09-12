import { ApolloClient, InMemoryCache, HttpLink, split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors";
import { createClient } from "graphql-ws";
import { getLanguage } from "./i18nRuntime";
import { handleAuthExpired, useAuthStore } from "../store/authStore";

const resolveApiBaseUrl = (): string => {
  const raw = (import.meta.env.VITE_API_URL as string | undefined) || "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const apiBaseUrl = resolveApiBaseUrl();
const graphqlBaseUrl = apiBaseUrl ? `${apiBaseUrl}/graphql` : "/graphql";

const resolveWsUrl = (): string => {
  if (apiBaseUrl) {
    const wsBase = apiBaseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    return `${wsBase}/ws`;
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
};

const httpLink = new HttpLink({
  uri: (operation) => {
    const operationName = operation.operationName || "anonymous";
    return `${graphqlBaseUrl}/${encodeURIComponent(operationName)}`;
  },
});

const authLink = setContext((_, { headers }) => {
  const token = useAuthStore.getState().token;
  return {
    headers: {
      ...headers,
      "Accept-Language": getLanguage(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const unauthorizedMessagePattern =
  /unauthorized|invalid token|token expired|expired signature|jwt/i;

const errorLink = onError(({ error }) => {
  const graphQLUnauthorized = CombinedGraphQLErrors.is(error)
    ? error.errors.some((item: { message?: string }) =>
        unauthorizedMessagePattern.test(item.message || ""),
      )
    : false;
  const statusCode = ServerError.is(error) ? error.statusCode : undefined;
  if (graphQLUnauthorized || statusCode === 401) {
    void handleAuthExpired();
  }
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: resolveWsUrl(),
    keepAlive: 12000,
    retryAttempts: Infinity,
    shouldRetry: () => true,
    connectionParams: () => {
      const token = useAuthStore.getState().token;
      return {
        "Accept-Language": getLanguage(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    },
  }),
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  authLink.concat(errorLink).concat(httpLink),
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
