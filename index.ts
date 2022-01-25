import * as core from "@actions/core";
import * as github from "@actions/github";
import axios from "axios";
import { promises as fs } from "fs";

const main = async () => {
  try {
    const action = github.context.payload.action;

    const payload_pull_request = github.context.payload.pull_request;

    const reviewers = payload_pull_request?.requested_reviewers;
    const title = payload_pull_request?.title;
    const html_url = payload_pull_request?.html_url;

    const url = process.env.PR_MESSAGE_SLACK_WEBHOOK_URL; // https://hooks.slack.com/...
    if (!url) {
      throw new Error("PR_MESSAGE_SLACK_WEBHOOK_URL is not set.");
    }

    if (!html_url) {
      throw new Error("Could not retrieve PR URL.");
    }

    if (action !== "review_requested") {
      console.log("'types' only supports 'review_requested'.");
      return;
    }

    if (!Array.isArray(reviewers) || reviewers.length === 0) {
      console.log("Could not retrieve 'reviewers'.");
      return;
    }

    let github_slack_id_map: { [github_username: string]: unknown } = {};
    try {
      github_slack_id_map = JSON.parse(
        await fs.readFile(".github/slack-id.json", "utf8")
      );
    } catch (e) {
      // TODO: Add error handling other than ENOENT.
    }

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

    axios.post(url, { text });
  } catch (e) {
    core.setFailed(e instanceof Error ? e.message : JSON.stringify(e));
  }
};

main();
