-- CreateTable
CREATE TABLE "Group" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "tokenHash" TEXT NOT NULL PRIMARY KEY,
    "memberId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "closesAt" DATETIME,
    "creatorId" INTEGER NOT NULL,
    "outcome" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Prediction_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prediction_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "predictionId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bet_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bet_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_code_key" ON "Group"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Member_groupId_name_key" ON "Member"("groupId", "name");

-- CreateIndex
CREATE INDEX "Prediction_groupId_idx" ON "Prediction"("groupId");

-- CreateIndex
CREATE INDEX "Bet_predictionId_idx" ON "Bet"("predictionId");

-- CreateIndex
CREATE INDEX "Bet_memberId_idx" ON "Bet"("memberId");
