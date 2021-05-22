# Notion Reddit Sync
Sync you Reddit saved posts with Notion

## Running locally

### 1. Setup your local project

```zsh
# Clone this repository locally
git clone https://github.com/j-waters/reddit-notion-sync.git

# Switch into this project
cd reddit-notion-sync

# Install the dependencies
yarn install
```

### 2. Set your environment variables in a `.env` file

```zsh
NOTION_KEY=<your-notion-api-key>
NOTION_DATABASE_ID=<notion-database-id>
REDDIT_CLIENT_ID=<your-reddit-app-client-id>
REDDIT_CLIENT_SECRET=<your-reddit-app-client-secret>
REDDIT_REFRESH_TOKEN=<your-reddit-app-refresh-token>
```

You can create your Notion API key [here](https://www.notion.com/my-integrations).

You can get Reddit API keys and refresh token by downloading [this helper](https://github.com/not-an-aardvark/reddit-oauth-helper).
Make sure you have the scope `history identity read save`.

### 3. Set up table
You'll need to create a table with the following properties:

| Name        | Type   | Required? |
|-------------|--------|-----------|
| Reddit Link | url    | yes       |
| Name        | title  | yes       |
| Subreddit   | string | no        |

### 4. Build and run

```zsh
tsc --build
node dist/index.js 
```
