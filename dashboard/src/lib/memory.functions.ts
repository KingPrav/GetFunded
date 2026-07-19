import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MemoryCategoryEnum = z.enum([
  "background",
  "skill",
  "motivation",
  "risk",
  "network",
  "preference",
  "milestone",
  "signal",
]);

const AddMemoryInput = z.object({
  founder_key: z.string().min(1),
  category: MemoryCategoryEnum,
  source: z.string().min(1),
  content: z.string().min(2).max(4000),
  summary: z.string().max(500).optional(),
  confidence: z.number().int().min(0).max(100).default(70),
  metadata: z.record(z.string(), z.unknown()).default({}),
  pinned: z.boolean().default(false),
});

const ListMemoryInput = z.object({
  founder_key: z.string().min(1),
});

const SearchMemoryInput = z.object({
  founder_key: z.string().min(1),
  query: z.string().min(2),
  match_count: z.number().int().min(1).max(20).default(8),
});

const TogglePinInput = z.object({ id: z.string().uuid(), pinned: z.boolean() });
const DeleteMemoryInput = z.object({ id: z.string().uuid() });

export const addMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AddMemoryInput.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    let embedding: number[] | null = null;
    if (apiKey) {
      try {
        const { embedText } = await import("./ai-gateway.server");
        embedding = await embedText(apiKey, `${data.category}: ${data.content}`);
      } catch (err) {
        console.error("embed failed", err);
      }
    }
    const { data: row, error } = await context.supabase
      .from("founder_memory")
      .insert({
        user_id: context.userId,
        founder_key: data.founder_key,
        category: data.category,
        source: data.source,
        content: data.content,
        summary: data.summary ?? null,
        confidence: data.confidence,
        metadata: data.metadata as never,
        pinned: data.pinned,
        embedding: embedding as unknown as string | null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activities").insert({
      user_id: context.userId,
      founder_key: data.founder_key,
      kind: "memory.added",
      meta: { category: data.category, source: data.source },
    });
    return row;
  });

export const listMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListMemoryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("founder_memory")
      .select("id, category, source, content, summary, confidence, metadata, pinned, created_at")
      .eq("founder_key", data.founder_key)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const searchMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SearchMemoryInput.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    const { embedText } = await import("./ai-gateway.server");
    const vec = await embedText(apiKey, data.query);
    const { data: rows, error } = await context.supabase.rpc("match_founder_memory", {
      _user_id: context.userId,
      _founder_key: data.founder_key,
      _query: vec as unknown as string,
      _match_count: data.match_count,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const togglePinMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TogglePinInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("founder_memory")
      .update({ pinned: data.pinned })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteMemoryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("founder_memory").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
