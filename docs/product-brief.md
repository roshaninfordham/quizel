# Product Brief

## Name

QuizRush Arena

## One-Liner

A live audience activation game for technical events and learning rooms.

## Memory Sentence

One QR. Custom quizzes. Live bracket. Shareable scorecards.

## Problem

DevRel demos, hackathons, bootcamps, classrooms, sponsor booths, and team trainings struggle to make the whole audience actively participate. Most tools are passive polls, slow Q&A, or ordinary quiz screens.

## Solution

QuizRush Arena turns the room into a synchronized multiplayer race. Everyone joins instantly from a phone, types a topic, receives a participant-scoped private quiz, answers ten rapid questions, and watches the projector roster, leaderboard, and live bracket move from committed SpacetimeDB state.

## Technical Claim

Every join, expertise signal, answer, score, rank jump, and replay event is reducer-owned state. The projector and phones subscribe to authoritative state instead of trusting client-local calculations. Latency claims are measured live as p95 metrics, not guessed.

## Why AI

AI routes crowd expertise intent, generates the question pack, reviews fairness/safety, and summarizes the match. It is a live content pipeline with validation and fallback.

## Target Categories

- Best Game
- Best Use of SpacetimeDB
- Best Realtime / Multiplayer App
- Best AI Agentic App
- Best UI/UX, if polished
