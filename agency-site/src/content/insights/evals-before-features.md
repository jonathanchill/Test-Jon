---
title: "Write the evals before the feature"
description: "The single engineering habit that separates AI features people trust from ones they switch off."
date: 2026-09-08
author: "Founder name"
readingTime: 6
tags: ["AI Development", "Engineering"]
---
If you only take one practice from how we build AI features, take this one: write the evaluation set before you write the prompt.

An eval set is a few dozen to a few hundred real inputs with the answers a domain expert would accept. It gives you a score, which means you can compare models, prompts and retrieval settings objectively, catch regressions when a provider updates a model, and show stakeholders a number instead of a vibe.

## What goes in

- Real inputs, including the ugly ones.
- Expected outputs or a rubric for judging them.
- A handful of adversarial cases: prompt injection, out-of-scope questions, requests for data the user should not see.

## What it buys you

Confidence to ship, and a safety net every time anything changes.
