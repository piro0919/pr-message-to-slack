import * as core from "@actions/core";
import * as github from "@actions/github";
import axios from "axios";
import { promises as fs } from "fs";

type PullRequestPayload = NonNullable<
  typeof github.context.payload.pull_request
>;

const notify_review_request = async (
  payload_pull_request: PullRequestPayload,
  webhook_url: string
) => {
  const reviewers = payload_pull_request.requested_reviewers;
  const title = payload_pull_request.title;
  const html_url = payload_pull_request.html_url;

  if (!html_url) {
    throw new Error("Could not retrieve PR URL.");
  }

  if (!Array.isArray(reviewers) || reviewers.length === 0) {
    console.log("Could not retrieve 'reviewers'.");
    return;
  }

  const github_slack_id_map = await load_slack_id_map();

  let text = "";

  reviewers.forEach((reviewer) => {
    const github_username = reviewer.login;

    if (typeof github_username !== "string") {
      return;
    }

    let slack_id = github_slack_id_map[github_username];

    if (typeof slack_id !== "string") {
      // If Slack member ID is not specified, use GitHub username instead.
      slack_id = github_username;
    }

    text = text.concat(`<@${slack_id}> `);
  });

  if (typeof title === "string") {
    text = text.concat(`\n*Review requested: * <${html_url}|${title}>`);
  } else {
    text = text.concat(`\n*Review requested: * ${html_url}`);
  }

  await axios.post(webhook_url, { text });
};

const notify_unlocked = async (
  payload_pull_request: PullRequestPayload,
  webhook_url: string
) => {
  const assignees = payload_pull_request.assignees;
  const title = payload_pull_request.title;
  const html_url = payload_pull_request.html_url;

  if (!html_url) {
    throw new Error("Could not retrieve PR URL.");
  }

  if (!Array.isArray(assignees) || assignees.length === 0) {
    console.log("Could not retrieve 'assignees'.");
    return;
  }

  const github_slack_id_map = await load_slack_id_map();

  let text = "";

  assignees.forEach((assignee) => {
    const github_username = assignee.login;

    if (typeof github_username !== "string") {
      return;
    }

    let slack_id = github_slack_id_map[github_username];

    if (typeof slack_id !== "string") {
      // If Slack member ID is not specified, use GitHub username instead.
      slack_id = github_username;
    }

    text = text.concat(`<@${slack_id}> `);
  });

  if (typeof title === "string") {
    text = text.concat(`\n*PR is unlocked: * <${html_url}|${title}>`);
  } else {
    text = text.concat(`\n*PR is unlocked: * ${html_url}`);
  }

  await axios.post(webhook_url, { text });
};

const load_slack_id_map = async () => {
  let github_slack_id_map: { [github_username: string]: unknown } = {};
  try {
    github_slack_id_map = github_slack_id_map = JSON.parse(
      await fs.readFile(".github/slack-id.json", "utf8")
    );
  } catch (e) {
    // TODO: Add error handling other than ENOENT.
  }
  return github_slack_id_map;
};

const main = async () => {
  try {
    const action = github.context.payload.action;
    const payload_pull_request = github.context.payload.pull_request;

    if (!payload_pull_request) {
      console.log("Only supports 'pull_request' event.");
      return;
    }

    const url = process.env.PR_MESSAGE_SLACK_WEBHOOK_URL; // https://hooks.slack.com/...
    if (!url) {
      throw new Error("PR_MESSAGE_SLACK_WEBHOOK_URL is not set.");
    }

    switch (action) {
      case "review_requested": {
        await notify_review_request(payload_pull_request, url);
        break;
      }
      case "unlocked": {
        await notify_unlocked(payload_pull_request, url);
        break;
      }
      default: {
        console.log("'types' only supports 'review_requested'.");
      }
    }
  } catch (e) {
    core.setFailed(e instanceof Error ? e.message : JSON.stringify(e));
  }
};

main();
