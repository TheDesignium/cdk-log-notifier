import * as zlib from 'zlib';
import * as https from 'https';
import type * as http from 'http';

if (process.env.SLACK_INCOMING_WEBHOOK_URL === undefined) throw 'SLACK_INCOMING_WEBHOOK_URL is not set.';
const slackIncomingWebhookUrl = process.env.SLACK_INCOMING_WEBHOOK_URL;

interface CloudWatchLogsEvent {
  awslogs: {
    data: string;
  };
}

interface LogData {
  logEvents: {
    id: string;
    timestamp: number;
    message: string;
  }[];
  logGroup: string;
  logStream: string;
  messageType: string;
}

function isLogData(v: any): v is LogData {
  if (!Array.isArray(v.logEvents)) return false;
  for (const logEvent of v.logEvents) {
    if (typeof logEvent.id !== 'string') return false;
    if (typeof logEvent.timestamp !== 'number') return false;
    if (typeof logEvent.message !== 'string') return false;
  }
  if (typeof v.logGroup !== 'string') return false;
  if (typeof v.logStream !== 'string') return false;
  if (typeof v.messageType !== 'string') return false;
  return true;
}

export const handler = async (event: CloudWatchLogsEvent) => {
  console.log('Received Event:', JSON.stringify(event));

  const logData = JSON.parse(zlib.gunzipSync(Buffer.from(event.awslogs.data, 'base64')).toString());

  if (!isLogData(logData)) {
    console.warn('Unregocgnizable message is received. Ignoreing.');
    return;
  }

  for (const logEvent of logData.logEvents) {
    let msg = logEvent.message;
    try {
      const jsonRegex = /{.*}/;
      const mayJson = msg.match(jsonRegex)?.[0];
      if (!mayJson) throw '';
      const json = JSON.parse(mayJson);
      msg = msg.replace(jsonRegex, JSON.stringify(json, null, 2));
    } catch (e) { }

    const resp = await fetch(slackIncomingWebhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": `${logData.logGroup}\n\`\`\`${msg}\n\`\`\``,
            },
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "plain_text",
                "text": new Date(logEvent.timestamp).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                  month: 'numeric',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                  second: 'numeric',
                }),
              },
              {
                "type": "mrkdwn",
                "text": `<https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=${process.env.AWS_REGION}#logsV2:log-groups/log-group/${encodeURIComponent(logData.logGroup)}/log-events/${encodeURIComponent(logData.logStream)}|See in CloudWatch>`,
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      console.error(`Posting message failed: status ${resp.status}; ${await resp.text()}`);
    }
  }
};

async function fetch(url: string, props: https.RequestOptions & { body: string }) {
  const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = https.request(url, props, resolve);
    req.on('error', reject);
    req.end(props.body);
  });

  const bodyPromise = new Promise((resolve) => {
    let body = '';
    res.on('data', dat => body += dat);
    res.on('end', () => resolve(body));
  });

  return {
    ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
    status: res.statusCode,
    text: () => bodyPromise,
  };
}
