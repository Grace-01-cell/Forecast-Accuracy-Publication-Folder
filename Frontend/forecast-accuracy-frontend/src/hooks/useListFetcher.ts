// src/hooks/useListFetcher.ts
import { useState, useEffect } from "react";
import { API_BASE_URL } from "../api";

export const useListFetcher = (endpoint: string) => {
  const [list, setList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchList = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`);
        if (!response.ok) throw new Error(`Failed to load ${endpoint}`);

        const data = await response.json();
        setList(data.items);
      } catch (error) {
        console.error(`Error loading ${endpoint}:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchList();
  }, [endpoint]);

  return { list, isLoading };
};
