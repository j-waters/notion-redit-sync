import { Client } from "@notionhq/client";

import { config } from "dotenv";

import snoowrap from "snoowrap";
import { RequestParameters } from "@notionhq/client/build/src/Client";
import {
    Page,
    PaginatedList,
    SelectProperty,
    URLPropertyValue
} from "@notionhq/client/build/src/api-types";
import {
    DatabasesRetrieveResponse,
    InputPropertyValueMap
} from "@notionhq/client/build/src/api-endpoints";

config();

const notion = new Client({ auth: process.env.NOTION_KEY });

const databaseId = process.env.NOTION_DATABASE_ID;

const reddit = new snoowrap({
    userAgent: "notion-reddit-sync",
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.REDDIT_REFRESH_TOKEN
});

function checkDatabaseId(
    databaseId: string | undefined
): asserts databaseId is string {
    if (databaseId == undefined) {
        console.error("Please set database ID");
        process.exit(1);
    }
}

function getSelectId(select: SelectProperty, name: string) {
    return select.select.options.find(value => value.name == name)?.id ?? name;
}

function generateProperties(
    database: DatabasesRetrieveResponse,
    post: snoowrap.Comment | snoowrap.Submission
) {
    const redditUrl = `reddit.com${post.permalink}`;

    const title = "title" in post ? post.title : post.body.slice(0, 25);

    const properties: InputPropertyValueMap = {
        "Reddit Link": {
            type: "url",
            url: redditUrl,
            id: database.properties["Reddit Link"].id
        },
        Name: {
            type: "title",
            title: [
                {
                    type: "text",
                    text: {
                        content: title
                    }
                }
            ],
            id: database.properties["Name"].id
        }
    };

    if ("Subreddit" in database.properties) {
        const name = post.subreddit_name_prefixed;
        // Currently cannot add new selects, see https://github.com/makenotion/notion-sdk-js/issues/90
        // const select = database.properties["Subreddit"] as SelectProperty;
        // properties["Subreddit"] = {
        //     type: "select",
        //     select: {
        //         name: name,
        //         color: "default",
        //         // @ts-ignore
        //         id: null
        //     },
        //     id: database.properties["Subreddit"].id
        // };
        properties["Subreddit"] = {
            type: "rich_text",
            rich_text: [
                {
                    type: "text",
                    text: {
                        content: name
                    }
                }
            ],
            id: database.properties["Subreddit"].id
        };
    }

    return properties;
}

const updateExisting = true;

async function syncSavedWithDatabase() {
    checkDatabaseId(databaseId);

    const existingPosts = await getSavedFromDatabase();
    let savedPosts = await reddit.getMe().getSavedContent();

    const database = await notion.databases.retrieve({
        database_id: databaseId
    });

    if (
        !("Reddit Link" in database.properties) ||
        database.properties["Reddit Link"].type != "url"
    ) {
        console.error("Database must have the url property `Reddit Link`");
        process.exit(1);
    }

    while (true) {
        for (const savedPost of savedPosts) {
            const redditUrl = `reddit.com${savedPost.permalink}`;
            const existingPage = existingPosts[redditUrl];
            if (!existingPage) {
                const createdPage = await notion.pages.create({
                    parent: { database_id: databaseId },
                    properties: generateProperties(database, savedPost)
                });
                console.log("Created page", createdPage);
            } else if (updateExisting) {
                const existingPage = existingPosts[redditUrl];
                console.log("Updating page", redditUrl);
                await notion.pages.update({
                    page_id: existingPage.id,
                    properties: Object.assign(
                        existingPage.properties,
                        generateProperties(database, savedPost)
                    )
                });
            }
        }

        if (savedPosts.isFinished.valueOf()) {
            break;
        }
        savedPosts = await savedPosts.fetchMore({ append: false, amount: 25 });
    }
}

// Get a paginated list of posts currently in a the database.
async function getSavedFromDatabase() {
    const posts: Record<string, Page> = {};

    async function getPageOfPosts(cursor: string | null) {
        let requestPayload: RequestParameters;
        // Create the request payload based on the presence of a start_cursor
        if (cursor == null) {
            requestPayload = {
                path: "databases/" + databaseId + "/query",
                method: "post"
            };
        } else {
            requestPayload = {
                path: "databases/" + databaseId + "/query",
                method: "post",
                body: {
                    start_cursor: cursor
                }
            };
        }

        // While there are more pages left in the query, get pages from the database.
        const currentPages = await notion.request<PaginatedList<Page>>(
            requestPayload
        );

        for (const page of currentPages.results) {
            const redditUrl = (page.properties[
                "Reddit Link"
            ] as URLPropertyValue)?.url;
            if (redditUrl) {
                posts[redditUrl] = page;
            }
        }
        if (currentPages.has_more) {
            await getPageOfPosts(currentPages.next_cursor);
        }
    }
    await getPageOfPosts(null);
    return posts;
}

syncSavedWithDatabase();
