import { createLLM, createVectorStore } from "../config/providers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Document } from "@langchain/core/documents";

// Formats retrieved Document objects into a single context string
const formatDocs = (docs: Document[]) =>
  docs
    .map(
      (d, i) =>
        `[${i + 1}] (${d.metadata?.source ?? "unknown"})\n${d.pageContent}`,
    )
    .join("\n\n");

export async function createRAGChain(): Promise<any> {
  // Create retriever (which creates vector store and embeddings)
  const llm = createLLM();
  const vectorStore = await createVectorStore();
  const retriever = vectorStore.asRetriever(5);

  // Create prompt template that instructs the LLM to use retrieved context
  const prompt = ChatPromptTemplate.fromTemplate(`
    You are an expert IT incident analyst. Answer the question based on the
    provided context from runbooks and documentation.
    If the context doesn't contain enough information, say so clearly. Always
    cite which document(s) you're referencing.

    Context:
    {context}
    Question: {input}
  `);

  // LCEL(LangChain Expression Language) chain — retrieve → format → prompt → LLM → parse
  const ragChain = RunnableSequence.from([
    {
      context: retriever.pipe((docs) => {
        return formatDocs(docs);
      }),
      input: new RunnablePassthrough(),
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);
  return ragChain;
}
