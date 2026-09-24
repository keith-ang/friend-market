import { randomInt } from "node:crypto";

const ADJECTIVES = [
  "bold", "brave", "bright", "calm", "clever", "cosy", "crisp", "eager",
  "fancy", "fuzzy", "gentle", "happy", "jolly", "lucky", "mellow", "merry",
  "mighty", "nifty", "plucky", "proud", "quick", "quiet", "rapid", "shiny",
  "silly", "sleepy", "snappy", "sunny", "swift", "tidy", "witty", "zesty",
];

const ANIMALS = [
  "badger", "beaver", "bison", "camel", "cobra", "crane", "dingo", "eagle",
  "falcon", "ferret", "gecko", "heron", "hippo", "koala", "lemur", "llama",
  "lynx", "moose", "newt", "otter", "owl", "panda", "parrot", "pelican",
  "puffin", "quokka", "raven", "robin", "seal", "sloth", "tiger", "walrus",
];

const pick = (words: string[]) => words[randomInt(words.length)];

/** A readable invite code like "tidy-otter-4821" (~9 million combinations). */
export function generateInviteCode(): string {
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${randomInt(1000, 10000)}`;
}

export function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}
