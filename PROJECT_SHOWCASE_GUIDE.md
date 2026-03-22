# How to Auto-Showcase a Project on Your Portfolio

To have a GitHub repo automatically appear on your portfolio site, add a `project.json` file to the **root** of that repo.

## Step 1: Create `project.json` in your repo

Add a file called `project.json` to the root of any repo you want featured. Example:

```json
{
  "title": "FRIDAY - AI Chat Interface",
  "description": "Fully serverless AI chatbot with 20+ model support, file attachments, and real-time streaming on AWS.",
  "image": "https://raw.githubusercontent.com/Vaishak/friday/main/screenshot.png",
  "tags": ["AWS", "Serverless", "AI", "Bedrock", "Lambda"],
  "live_url": "https://your-demo-url.com",
  "metrics": [
    { "value": "20+", "label": "AI Models" },
    { "value": "$0", "label": "Infra Cost" }
  ],
  "featured": true,
  "order": 1
}
```

## Fields

| Field         | Required | Description                                              |
|---------------|----------|----------------------------------------------------------|
| `title`       | Yes      | Project name shown on the card                           |
| `description` | Yes      | Short description (1-2 sentences)                        |
| `image`       | No       | Screenshot URL (use raw GitHub URL for repo images)      |
| `tags`        | Yes      | Array of tech tags                                       |
| `live_url`    | No       | Link to live demo                                        |
| `metrics`     | No       | Array of `{value, label}` objects for stats              |
| `featured`    | No       | Set `true` to pin at top                                 |
| `order`       | No       | Lower number = shows first (default: 99)                 |

## Step 2: Add a screenshot

For the `image` field, either:
- Add a screenshot to your repo (e.g., `screenshot.png`) and use the raw URL:
  `https://raw.githubusercontent.com/Vaishak/REPO_NAME/main/screenshot.png`
- Or use any public image URL

## Step 3: Wait for auto-update

The GitHub Action runs **weekly** (every Sunday) and also on manual trigger.
To trigger manually: Go to your portfolio repo → Actions → "Update Projects from GitHub" → Run workflow.

## That's it!

Any repo with a valid `project.json` will automatically appear in your portfolio's projects section.
Repos without `project.json` are ignored. Remove the file to hide a project.
