-- CreateTable
CREATE TABLE "LlmCall" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT,
    "traceId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,8) NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "stopReason" TEXT,
    "error" TEXT,

    CONSTRAINT "LlmCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmCall_createdAt_idx" ON "LlmCall"("createdAt");

-- CreateIndex
CREATE INDEX "LlmCall_conversationId_idx" ON "LlmCall"("conversationId");

