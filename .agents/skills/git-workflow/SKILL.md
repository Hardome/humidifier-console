---
name: git-workflow
description: Prepare Git commits, push branches, and create or update PRs. Use for requests involving commits, pushes, publishing changes, or pull requests.
---

# Git workflow

## General rules

- Never commit changes directly to `main`. Make every change on a task branch and merge it into `main` only through a pull request after review. Before committing, verify that the current branch is not `main`; if work is already on `main`, create a task branch first and keep the existing working tree and index intact.
- Commit and PR titles must be no longer than 72 characters.
- Describe completed changes in commit and PR titles: `Добавлен`, `Исправлена`, `Удалены`, `Обновлены`. Match gender and number to the subject.
- Use Russian by default unless the repository requires another language or format.
- Do not use Conventional Commits, emojis, or vague wording unless required by the project.
- A commit must contain only changes related to the task.
- Do not delete, overwrite, or include other people's or unrelated changes.
- Do not disable hooks or rewrite published history without explicit permission.

## Commit

1. Read the applicable `AGENTS.md` files.
2. Check the branch, `git status --short`, and staged and unstaged diffs. If the current branch is `main`, create and switch to a task branch before committing; do not commit on `main`.
3. Stage only files or hunks related to the task. Do not use unconditional `git add .`.
4. Run the required checks and hooks.
5. Before committing, check:
   - `git diff --cached`
   - `git diff --cached --check`
   - that no secrets, `.env` files, or temporary files are included.
6. Create a focused commit and check the final status.

Add a commit body only when needed to explain a non-trivial reason for the change.

## Push

- Push only if it is part of the user's request. Creating a PR implies publishing the branch.
- Check the remote, current branch, and upstream.
- First push:
  `git push --set-upstream <remote> <branch>`
- Subsequent pushes:
  `git push <remote> <branch>`
- Do not force push, amend published commits, or automatically rewrite history without explicit permission.
- If push fails, first determine and fix the cause.

## Pull request

1. Determine the correct repository, base, and head. Do not assume `main` is the base branch.
2. Review the full PR contents:
   - `git log <base>..HEAD`
   - `git diff <base>...HEAD`
3. If an open PR already exists for the head branch, update it instead of creating a duplicate.
4. Publish the required commits before creating the PR.
5. For GitHub, when using `gh pr create`, explicitly specify `--repo`, `--base`, `--head`, `--title`, and `--body-file`.
6. Create a draft if requested by the user or if the work is not ready for review.
7. After creation, verify the URL, base/head, title, and description.

## PR description

Write concise bullet points: one bullet per concrete change. Describe every change in its own bullet; a short phrase is enough if it conveys the point. Do not repeat the title or summarize commits one by one.

Describe the final result and its purpose for a reviewer who has not seen the conversation. Include implementation details only when they help assess correctness, a tradeoff, or a risk. Omit editing history, wording corrections, and explanations of how the PR itself is formatted. For instruction or skill changes, describe their purpose rather than enumerating individual writing rules.

Write the checks that were actually performed in a separate paragraph after the change list. Use grammatical agreement: `Проверка ... прошла` for one check, `Проверки ... прошли` for multiple checks.

```markdown
- Сохраняется выбранная роль при изменении участника проекта.
- Добавлена проверка отказа при недостаточных правах.

Проверки: тесты API и проверка типов прошли.
```

Follow the repository's required PR template if one exists.

## Response to the user

Keep the response concise and include:

- commit and branch;
- push result;
- PR link;
- any significant unresolved issues.

Do not claim that actions were performed if they were not actually performed.

### Additional rules

- If the formatter changed files, review the final diff again and stage only changes related to the task.
- If the index already contains other people's or unrelated staged changes, do not clear it entirely and do not include those changes in the new commit.
- If the PR for the head branch is already closed or merged, do not reopen it without an explicit user request.
