#!/usr/bin/env node
/**
 * Stop nudge: if sisu/ has uncommitted source and this is the first Stop
 * of the turn, remind the model to commit a completed step. Does not
 * hard-block every dirty tree (that would become commit-every-turn).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const IGNORE = [
  "node_modules",
  "artifacts",
  "cache",
  "typechain-types",
  "typechain",
  "coverage",
  ".next",
  ".env",
];

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function findSisuRoot(workspace, cwd) {
  const candidates = [
    path.join(workspace || "", "sisu"),
    cwd,
    workspace,
    path.resolve(cwd || ".", "sisu"),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, ".git")) && fs.existsSync(path.join(dir, "hardhat.config.ts"))) {
      return dir;
    }
  }
  return null;
}

function isIgnored(rel) {
  const n = rel.replace(/\\/g, "/");
  return IGNORE.some((p) => n === p || n.startsWith(p + "/") || n.includes("/" + p + "/"));
}

function dirtySource(sisu) {
  const r = spawnSync("git", ["-C", sisu, "status", "--porcelain", "-u"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) return [];
  return (r.stdout || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((rel) => rel && !isIgnored(rel));
}

const raw = readStdin();
let event = {};
try {
  event = JSON.parse(raw || "{}");
} catch {
  process.exit(0);
}

if (event.stopHookActive) process.exit(0);
const reason = event.reason || event.stopReason;
if (reason && reason !== "end_turn") process.exit(0);

const sisu = findSisuRoot(event.workspaceRoot, event.cwd);
if (!sisu) process.exit(0);

const files = dirtySource(sisu);
if (files.length === 0) process.exit(0);

const preview = files.slice(0, 8).join(", ");
const extra = files.length > 8 ? ` (+${files.length - 8} more)` : "";

const additionalContext =
  `sisu/ has uncommitted source (${files.length}): ${preview}${extra}. ` +
  `If this turn completed a feature, fix, or build-order step, run the tests gate and spawn the commit agent. ` +
  `If this is WIP, you may stop without committing. Never git push.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext,
    },
  })
);
process.exit(0);
