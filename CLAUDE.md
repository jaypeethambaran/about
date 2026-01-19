# CLAUDE.md - AI Assistant Guide

This document provides comprehensive guidance for AI assistants working with the `about` repository.

## Repository Overview

**Repository Name:** `about`
**Owner:** jaypeethambaran
**Purpose:** Personal profile and information repository

This repository serves as a personal "about me" space, potentially containing:
- Personal information and biography
- Professional background and experience
- Projects and portfolio items
- Contact information
- Skills and expertise
- Links to other profiles and resources

## Repository Structure

```
about/
├── CLAUDE.md           # This file - AI assistant guidance
├── README.md           # Main profile/about content (to be created)
├── assets/             # Images, documents, and other media
│   ├── images/         # Profile pictures, screenshots, etc.
│   └── documents/      # PDFs, resumes, etc.
├── projects/           # Project showcases and descriptions
└── .gitignore          # Git ignore rules
```

**Note:** As this is a new repository, most files and directories will need to be created based on user requirements.

## Development Workflow

### Branch Strategy

- **Main Branch:** `main` (default branch for production-ready content)
- **Feature Branches:** Use descriptive branch names following the pattern:
  - `feature/description` - For new content or features
  - `update/description` - For updating existing content
  - `fix/description` - For corrections and fixes
  - `claude/*` - Branches created by AI assistants (auto-generated with session IDs)

### Git Operations

#### Creating Commits
1. Stage relevant changes: `git add <files>`
2. Commit with descriptive messages following conventional commit format:
   ```
   type: brief description

   Optional detailed explanation of what changed and why
   ```

   Commit types:
   - `feat:` - New content or features
   - `update:` - Updates to existing content
   - `fix:` - Corrections and bug fixes
   - `docs:` - Documentation changes
   - `style:` - Formatting, no content change
   - `refactor:` - Restructuring without content change

3. Push to the appropriate branch:
   ```bash
   git push -u origin <branch-name>
   ```

#### Pull Requests
When creating PRs:
1. Ensure branch is up to date with main
2. Use clear, descriptive PR titles
3. Include a summary of changes
4. Add relevant context in the PR description
5. Reference any related issues

### Network Retry Policy
For git operations (push, fetch, pull):
- Retry up to 4 times on network failures
- Use exponential backoff: 2s, 4s, 8s, 16s
- Example: `git push` → wait 2s if failed → retry → wait 4s if failed → retry, etc.

## Content Guidelines

### Writing Style
- **Tone:** Professional yet personable
- **Voice:** First person (I, my) for personal content
- **Clarity:** Clear, concise, and easy to understand
- **Accuracy:** Ensure all information is accurate and up-to-date
- **Privacy:** Be mindful of sensitive personal information

### Formatting Standards
- Use Markdown for all text content
- Follow GitHub Flavored Markdown (GFM) specification
- Use proper heading hierarchy (# → ## → ### → ####)
- Include line breaks between sections for readability
- Use code blocks with language specifiers when showing code
- Optimize images before committing (reasonable file sizes)

### File Naming Conventions
- Use lowercase with hyphens: `project-name.md`
- Be descriptive: `web-development-portfolio.md` not `portfolio.md`
- Use standard extensions: `.md`, `.jpg`, `.png`, `.pdf`
- Avoid spaces and special characters in filenames

## Key Conventions for AI Assistants

### Before Making Changes
1. **Always read existing files first** before proposing changes
2. **Ask clarifying questions** if requirements are ambiguous
3. **Check git status** to understand current repository state
4. **Review recent commits** to understand context and patterns

### Content Creation
- **Personal Information:** Always confirm with user before adding sensitive details
- **External Links:** Verify links are correct and accessible
- **Images:** Ask about image preferences (size, format, content)
- **Tone:** Match the user's preferred writing style and tone
- **Completeness:** Ensure content is thorough but not overwhelming

### Code and Technical Content
- Use appropriate syntax highlighting in code blocks
- Include comments for complex examples
- Provide context for technical decisions
- Keep examples relevant and practical
- Test any code snippets before including them

### Version Control Best Practices
1. **Commit Frequency:** Make logical, atomic commits
2. **Commit Messages:** Clear, descriptive, following conventional format
3. **Branch Management:** Work on designated feature branches
4. **Push Safety:** Only push to authorized branches (claude/* branches)
5. **No Force Pushing:** Avoid `git push --force` unless explicitly requested
6. **Clean History:** Keep commits organized and meaningful

### Tool Usage Preferences
- **Read files** with Read tool (not `cat`)
- **Edit files** with Edit tool (not `sed`)
- **Search content** with Grep tool (not `grep` command)
- **Find files** with Glob tool (not `find` command)
- **Complex searches** use Task tool with Explore agent
- **Parallel operations** when tasks are independent

### Task Management
Use TodoWrite tool for:
- Multi-step tasks (3+ steps)
- Complex implementations
- Tracking progress on user requests
- Breaking down large tasks

Update todo status:
- Mark `in_progress` before starting work
- Mark `completed` immediately after finishing
- Keep only ONE task `in_progress` at a time
- Remove obsolete tasks

### Security and Privacy
- **Never commit** sensitive information (API keys, passwords, personal data)
- **Review carefully** before committing personal details
- **Ask first** when uncertain about privacy implications
- **Use .gitignore** for sensitive local files
- **Respect privacy** in commit messages and documentation

### Quality Assurance
Before completing tasks:
- Proofread all content for grammar and spelling
- Verify all links are functional
- Check formatting renders correctly in Markdown
- Ensure images display properly
- Test any interactive elements
- Validate file paths and references

## Common Tasks

### Creating a New Project Entry
1. Create file in `projects/` directory
2. Use template structure:
   ```markdown
   # Project Name

   ## Overview
   Brief description

   ## Technologies
   - Tech 1
   - Tech 2

   ## Links
   - [Live Demo](url)
   - [Repository](url)

   ## Screenshots
   ![Screenshot](../assets/images/project-screenshot.png)
   ```
3. Add project image to `assets/images/`
4. Update main README if needed
5. Commit with message: `feat: add [project name] to portfolio`

### Updating Personal Information
1. Read existing README.md or profile file
2. Make requested changes using Edit tool
3. Verify accuracy with user
4. Commit with message: `update: [what was updated]`
5. Push to feature branch

### Adding Media Assets
1. Confirm file format and size requirements
2. Save to appropriate `assets/` subdirectory
3. Update references in Markdown files
4. Commit both asset and references together
5. Use descriptive commit message

## File Templates

### README.md Template
```markdown
# About [Name]

## Introduction
Brief intro paragraph

## Professional Background
Career summary and current role

## Skills & Expertise
- Skill area 1
- Skill area 2
- Skill area 3

## Featured Projects
Highlight of notable projects

## Contact
Ways to get in touch

## Links
- [LinkedIn](url)
- [GitHub](url)
- [Website](url)
```

### .gitignore Template
```
# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
*.swp
*.swo

# Sensitive information
secrets/
private/
*.key
*.pem

# Large files
*.psd
*.ai
```

## Troubleshooting

### Common Issues

**Push fails with 403 error:**
- Verify branch name starts with `claude/` and ends with session ID
- Check remote URL is correct
- Retry with exponential backoff

**Merge conflicts:**
1. Fetch latest from main: `git fetch origin main`
2. Review conflicts carefully
3. Ask user for guidance on resolution
4. Test after resolving

**Large file issues:**
- Optimize images before committing
- Use compressed formats (WebP, optimized PNG/JPG)
- Consider external hosting for very large files
- Add large files to .gitignore if necessary

## Best Practices Summary

### DO:
✅ Read files before editing
✅ Ask questions when uncertain
✅ Use descriptive commit messages
✅ Follow markdown formatting standards
✅ Verify links and references
✅ Protect privacy and sensitive information
✅ Use appropriate tools for each task
✅ Track complex tasks with TodoWrite
✅ Test content before committing
✅ Work on designated feature branches

### DON'T:
❌ Commit sensitive personal information
❌ Force push without explicit permission
❌ Make assumptions about personal details
❌ Skip reading existing files
❌ Create unnecessary files
❌ Use bash commands when specialized tools exist
❌ Batch multiple todo completions
❌ Push to unauthorized branches
❌ Include time estimates in plans
❌ Over-engineer simple tasks

## Repository-Specific Notes

### Current State
- **Status:** New repository, no initial commits
- **Branch:** `claude/claude-md-mkl0nmaerlflj5zu-l7MlZ` (current working branch)
- **Content:** To be developed based on user requirements

### Next Steps
Typical first steps for this repository:
1. Create initial README.md with basic profile information
2. Set up directory structure (assets/, projects/)
3. Create .gitignore file
4. Add initial content based on user preferences
5. Create first commit and push to branch
6. Create pull request to main branch

### User Preferences
*(To be filled in as preferences are discovered)*
- Writing style: TBD
- Technical depth: TBD
- Privacy level: TBD
- Focus areas: TBD

## Resources

### Markdown Reference
- [GitHub Flavored Markdown](https://github.github.com/gfm/)
- [Markdown Guide](https://www.markdownguide.org/)

### Git Best Practices
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Branching Strategy](https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows)

---

**Last Updated:** 2026-01-19
**Version:** 1.0.0
**Maintained by:** AI assistants working with repository owner
