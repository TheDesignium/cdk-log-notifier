# cdk-log-notifier: Filter CloudWatch logs and post to Slack.

The AWS CDK Construct to build a system that gather CloudWatch logs, filter and post to Slack.

![screenshot](https://i.imgur.com/Qx2A9n2.png)

## Example Usage

Watch the all logs contains "ERROR" from Lambda functions.

```typescript
const logNotifier = new LogNotifier(this, 'logNotifier', {
  filterPattern: logs.FilterPattern.allTerms('ERROR'),
  slackIncomingWebhookUrl: 'https://hooks.slack.com/...', // Use yours.
});

logNotifier.watch(lambdaFunc1.logGroup);
logNotifier.watch(lambdaFunc2.logGroup);
```

## Installation

```sh
npm i @thedesignium/cdk-log-notifier
```

## API Reference

### Class: `LogNotifier`

```typescript
new LogNotifier(scope: cdk.Construct, id: string, props: LogNotifierProps)
```

The properties in `props`:

- `filterPattern`: The [FilterPattern object in aws-cloudwatch module](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-logs.FilterPattern.html). The logs is filtered as specified here. *Required.*
- `slackIncomingWebhookUrl`: The [Incoming Webhook URL](https://api.slack.com/messaging/webhooks) of Slack. Create for the Slack channel the logs should be posted. *Required.*
- `dateTimeFormatOptions`: The [arguments of the DateTimeFormat constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#parameters), used to format the datetime which shown at the bottom of the Slack message. If omitted, it's formatted like `12/20, 3:00:00 AM UTC`. *Optional.*

  Example:

  ```typescript
    dateTimeFormatOptions: {
      locales: 'ja-JP',
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }
  ```

#### Static Method: `fromAttributes`

```typescript
LogNotifier.fromAttributes(scope: cdk.Construct, id: string, attrs: LogNotifierAttributes): LogNotifier
```

Instantiate from the attributes. Put the value of `logNotifier.attributes` as `attrs` parameter.

#### Method: `watch`

```typescript
logNotifier.watch(logGroup: logs.LogGroup): void
```

Add the log group to watch list to notify. The logs in the watched log groups are filtered by the filterPattern and posted to Slack.

#### Property: `attributes`

```typescript
attributes: LogNotifierAttributes
```

To use with `LogNotifier.fromAttributes()`.

## Containing Resources

- [logs.SubscriptionFilter](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-logs.SubscriptionFilter.html)
- [lambda.Function](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-lambda.Function.html)

## Limitation

The `watch()` method attaches a [Subscription](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Subscriptions.html) to the subject logGroup. The number of subscription can be attached to a logGroup, however, is only one. So it'll fail if the logGroup has another subscription already. Similary, the watched logGroup can't be attached another subscription nor watched from another LogNotifier.

## Motivation

There were 2 requirements:

1. Notice the all logs produced by `console.error()`(not only the crash report such InvocationError)
2. Jump easily to CloudWatch via link

We tried `Lambda's error metric + CloudWatch Alarm + Chatbot` and `CloudWatch Metrics Filter + CloudWatch Alarm + Chatbot`, but the former system don't satisfy [1] and the latter system don't satisfy [2]. That's why we need this.

## FAQ

### Running project tests

To execute tests locally, run the following commands:

```bash
npm install
npm run test
```

To update test snapshots, run:

```bash
npm run test -- -u
```

### Cross Stack?

Possible. Export all values in `LogNotifier.prototype.attributes`, import it and use `LogNotifier.fromAttributes()` in another Stack.

### How can I customize the Slack bot icon or name?

You can set at [Slack App setting page](https://api.slack.com/apps), or Incoming Webhook configuration page if you use [Legacy Incoming Webhook](https://api.slack.com/legacy/custom-integrations/incoming-webhooks).

### No support for other languages than TypeScript?

Supports Python, Java, Go and .NET.
