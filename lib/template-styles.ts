"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarTaskBackgroundSettings } from "@/lib/calendar-task-background-types";
import type { SidebarBackgroundSettings } from "@/lib/sidebar-background-types";
import {
  buildTemplateStyleInputFromSettings,
  getDefaultTemplateStyleInput,
  type TemplateStyleRecord,
  type TemplateStylesResponse,
} from "@/lib/template-style-types";

export type { TemplateStyleRecord } from "@/lib/template-style-types";

async function fetchTemplateStyles() {
  const response = await fetch("/api/template-styles", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load template styles");
  }

  const payload = (await response.json()) as TemplateStylesResponse;
  if (!Array.isArray(payload.styles)) {
    throw new Error("Invalid template styles response");
  }

  return payload;
}

export function useTemplateStyles() {
  const [styles, setStyles] = useState<TemplateStyleRecord[]>([]);
  const [activeStyleId, setActiveStyleId] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await fetchTemplateStyles();
    setStyles(data.styles);
    setActiveStyleId(data.activeStyleId);
    setSelectedStyleId((current) => {
      if (current && data.styles.some((style) => style.id === current)) {
        return current;
      }
      if (
        data.activeStyleId &&
        data.styles.some((style) => style.id === data.activeStyleId)
      ) {
        return data.activeStyleId;
      }
      return data.styles[0]?.id ?? null;
    });
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await refresh();
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError("Could not load saved template styles.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const activateStyle = useCallback(async (id: string) => {
    const response = await fetch(`/api/template-styles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate" }),
    });

    if (!response.ok) {
      throw new Error("Failed to activate template style");
    }

    setActiveStyleId(id);
    setSelectedStyleId(id);
  }, []);

  const createStyle = useCallback(
    async (
      name: string,
      sidebar: SidebarBackgroundSettings,
      calendar: CalendarTaskBackgroundSettings,
    ) => {
      const input = buildTemplateStyleInputFromSettings(name, sidebar, calendar);
      if (!input) {
        throw new Error("Invalid template style settings");
      }

      setIsWorking(true);
      setError(null);

      try {
        const response = await fetch("/api/template-styles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error("Failed to create template style");
        }

        const payload = await response.json();
        await refresh();
        if (payload.style?.id) {
          setSelectedStyleId(payload.style.id);
          await activateStyle(payload.style.id);
        }
        setSuccessMessage("Template saved.");
        return payload.style as TemplateStyleRecord;
      } catch (createError) {
        console.error(createError);
        setError("Could not save template style.");
        throw createError;
      } finally {
        setIsWorking(false);
      }
    },
    [refresh, activateStyle],
  );

  const updateStyle = useCallback(
    async (
      id: string,
      name: string,
      sidebar: SidebarBackgroundSettings,
      calendar: CalendarTaskBackgroundSettings,
    ) => {
      const input = buildTemplateStyleInputFromSettings(name, sidebar, calendar);
      if (!input) {
        throw new Error("Invalid template style settings");
      }

      setIsWorking(true);
      setError(null);

      try {
        const response = await fetch(`/api/template-styles/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error("Failed to update template style");
        }

        await refresh();
        setSuccessMessage("Template updated.");
      } catch (updateError) {
        console.error(updateError);
        setError("Could not update template style.");
        throw updateError;
      } finally {
        setIsWorking(false);
      }
    },
    [refresh],
  );

  const copyStyle = useCallback(
    async (id: string, name?: string) => {
      setIsWorking(true);
      setError(null);

      try {
        const response = await fetch(`/api/template-styles/${id}/copy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(name ? { name } : {}),
        });

        if (!response.ok) {
          throw new Error("Failed to copy template style");
        }

        const payload = await response.json();
        await refresh();
        if (payload.style?.id) {
          setSelectedStyleId(payload.style.id);
        }
        setSuccessMessage("Template copied.");
        return payload.style as TemplateStyleRecord;
      } catch (copyError) {
        console.error(copyError);
        setError("Could not copy template style.");
        throw copyError;
      } finally {
        setIsWorking(false);
      }
    },
    [refresh],
  );

  const deleteStyle = useCallback(
    async (id: string) => {
      setIsWorking(true);
      setError(null);

      try {
        const response = await fetch(`/api/template-styles/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete template style");
        }

        await refresh();
        setSuccessMessage("Template deleted.");
      } catch (deleteError) {
        console.error(deleteError);
        setError("Could not delete template style.");
        throw deleteError;
      } finally {
        setIsWorking(false);
      }
    },
    [refresh],
  );

  const createBlankStyle = useCallback(async (name: string) => {
    const defaults = getDefaultTemplateStyleInput(name);
    setIsWorking(true);
    setError(null);

    try {
      const response = await fetch("/api/template-styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(defaults),
      });

      if (!response.ok) {
        throw new Error("Failed to create blank template style");
      }

      const payload = await response.json();
      await refresh();
      if (payload.style?.id) {
        setSelectedStyleId(payload.style.id);
      }
      setSuccessMessage("Blank template created.");
      return payload.style as TemplateStyleRecord;
    } catch (createError) {
      console.error(createError);
      setError("Could not create blank template.");
      throw createError;
    } finally {
      setIsWorking(false);
    }
  }, [refresh]);

  return {
    styles,
    activeStyleId,
    selectedStyleId,
    setSelectedStyleId,
    isLoading,
    isWorking,
    error,
    successMessage,
    refresh,
    createStyle,
    updateStyle,
    copyStyle,
    deleteStyle,
    activateStyle,
    createBlankStyle,
  };
}
