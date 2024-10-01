"use client";

import axios, { AxiosError } from "axios";
import { getServerBaseUrl } from "./server-url";
import { toast } from "sonner";
import {
  useMutation,
  UseMutationOptions,
  useQuery,
  UseQueryOptions,
} from "@tanstack/react-query";
import { useEffect } from "react";

type Error = AxiosError<{ error: string }>;

type Query<D> = {
  endpoint: string;
  method: "POST" | "GET" | "PATCH" | "PUT" | "DELETE";
  data?: D;
  params?: D;
};

type ServerMutation<R, V = void> = UseMutationOptions<
  R | undefined,
  Error,
  V,
  unknown
> & {
  endpoint: string;
  method: "POST" | "GET" | "PATCH" | "PUT" | "DELETE";
};

type ServerQuery<R, V> = UseQueryOptions<
  R | undefined,
  Error,
  R | undefined
> & {
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "GET" | "DELETE";
  params?: V;
  data?: V;
  muteError?: boolean;
};

/**
 * Create axios query to the server
 * - First generic: Return type
 * - Second generic: Params/Data type
 */

export const buildQuery = async <T, D>({
  endpoint,
  method,
  data,
  params,
}: Query<D>): Promise<T | undefined> => {
  const res = await axios<T>({
    url: getServerBaseUrl() + endpoint,
    method,
    data,
    params,
  });

  const response = handleResponse<T>(res.data);
  return response.data;
};

/**
 * Create mutation hook to the server
 * - First generic: Return type
 * - Second generic: Params/Data type
 */

export const useServerMutation = <R = void, V = void>({
  endpoint,
  method,
  ...options
}: ServerMutation<R, V>) => {
  return useMutation<R | undefined, Error, V>({
    onError: (error) => {
      toast.error(handleError(error.request?.data));
    },
    mutationFn: async (variables) => {
      return buildQuery<R, V>({
        endpoint: endpoint,
        method: method,
        data: variables,
      });
    },
    ...options,
  });
};

/**
 * Create query hook to the server
 * - First generic: Return type
 * - Second generic: Params/Data type
 */

export const useServerQuery = <R, V = any>({
  endpoint,
  method,
  params,
  data,
  muteError,
  ...options
}: ServerQuery<R | undefined, V>) => {
  const props = useQuery<R | undefined, Error>({
    queryFn: async () => {
      return buildQuery<R, V>({
        endpoint: endpoint,
        method: method,
        params: params,
        data: data,
      });
    },
    ...options,
  });

  useEffect(() => {
    if (!muteError && props.isError) {
      console.log("Server error", props.error);
      toast.error(handleError(props.error?.response?.data));
    }
  }, [props.error, props.isError, muteError]);
};

const handleError = (data: any): string => {
  if (typeof data === "string") return "Server Error" + data;

  const err = data?.error as string;

  if (!err) return "Unknown error";

  if (err.includes("Too many requests")) {
    return "Anilist: Too many requests, please wait a moment and try again";
  }

  try {
    const graphqlErr = JSON.parse(err);
    console.log("Anilist error", graphqlErr);

    if (
      graphqlErr.graphqlErrors &&
      graphqlErr.graphqlErrors.length > 0 &&
      !!graphqlErr.graphqlErrors[0]?.message
    ) {
      return "Anilist error: " + graphqlErr.graphqlErrors[0]?.message;
    }

    return "Anilist error";
  } catch (e) {
    return "Error: " + err;
  }
};

const handleResponse = <T>(
  res: unknown
): { data: T | undefined; error: string | undefined } => {
  if (
    typeof res === "object" &&
    !!res &&
    "error" in res &&
    typeof res.error === "string"
  ) {
    return { data: undefined, error: res.error };
  }
  if (typeof res === "object" && !!res && "data" in res) {
    return { data: res.data as T, error: undefined };
  }

  return { data: undefined, error: "No response from the server" };
};
